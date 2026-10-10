"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import {
  Compass,
  AlertTriangle,
  Activity,
  Maximize2,
  Minimize2,
  EyeOff,
  CheckCircle2
} from "lucide-react";

interface Cane3DVisualizerProps {
  rawTiltDeg: number | null;
  mpuConnected: boolean;
  frontConnected?: boolean;
  downConnected?: boolean;
  isSimMode?: boolean;
  theme?: "dark" | "light";
  onToggleHide?: () => void;
}

export default function Cane3DVisualizer({
  rawTiltDeg,
  mpuConnected,
  frontConnected = false,
  downConnected = false,
  isSimMode = false,
  theme = "dark",
  onToggleHide
}: Cane3DVisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const yawGroupRef = useRef<THREE.Group | null>(null);
  const pitchGroupRef = useRef<THREE.Group | null>(null);
  const rollGroupRef = useRef<THREE.Group | null>(null);
  const caneGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [activeView, setActiveView] = useState<"iso" | "side" | "front" | "top">("iso");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Orbit camera spherical coordinates
  const cameraSphericalRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 4.8
  });
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Current interpolated rotations (radians)
  const currentRotationRef = useRef<{ pitch: number; roll: number; yaw: number }>({
    pitch: 0,
    roll: 0,
    yaw: 0
  });

  const targetRotationRef = useRef<{ pitch: number; roll: number; yaw: number }>({
    pitch: 0,
    roll: 0,
    yaw: 0
  });

  // Calculate target rotation from rawTiltDeg
  useEffect(() => {
    if (mpuConnected && rawTiltDeg !== null) {
      targetRotationRef.current = {
        pitch: THREE.MathUtils.degToRad(rawTiltDeg),
        roll: 0,
        yaw: 0
      };
    } else {
      targetRotationRef.current = {
        pitch: 0,
        roll: 0,
        yaw: 0
      };
    }
  }, [mpuConnected, rawTiltDeg]);

  // Update camera position from spherical coordinates
  const updateCameraFromSpherical = () => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraSphericalRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(0, 1.0, 0);
  };

  // View presets
  const applyViewPreset = (view: "iso" | "side" | "front" | "top") => {
    setActiveView(view);
    const s = cameraSphericalRef.current;
    if (view === "iso") {
      s.theta = Math.PI / 4;
      s.phi = Math.PI / 3;
      s.radius = 4.8;
    } else if (view === "side") {
      s.theta = Math.PI / 2;
      s.phi = Math.PI / 2.3;
      s.radius = 4.2;
    } else if (view === "front") {
      s.theta = 0;
      s.phi = Math.PI / 2.3;
      s.radius = 4.2;
    } else if (view === "top") {
      s.theta = 0;
      s.phi = 0.05;
      s.radius = 4.5;
    }
    updateCameraFromSpherical();
  };

  // Escape key exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Three.js Scene Initialization
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraFromSpherical();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(4, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    // Floor & Grid
    const gridHelper = new THREE.GridHelper(6, 24, 0x10b981, 0x3f3f46);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const floorGeo = new THREE.CircleGeometry(2.8, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.002;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Plumb Line (Garis tegak lurus ideal 0° vertikal)
    const plumbPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.4, 0)];
    const plumbGeo = new THREE.BufferGeometry().setFromPoints(plumbPoints);
    const plumbMat = new THREE.LineDashedMaterial({
      color: 0xa1a1aa,
      dashSize: 0.08,
      gapSize: 0.05
    });
    const plumbLine = new THREE.Line(plumbGeo, plumbMat);
    plumbLine.computeLineDistances();
    scene.add(plumbLine);

    // Hierarki Pivot
    const yawGroup = new THREE.Group();
    yawGroupRef.current = yawGroup;
    scene.add(yawGroup);

    const pitchGroup = new THREE.Group();
    pitchGroupRef.current = pitchGroup;
    yawGroup.add(pitchGroup);

    const rollGroup = new THREE.Group();
    rollGroupRef.current = rollGroup;
    pitchGroup.add(rollGroup);

    const caneRoot = new THREE.Group();
    caneGroupRef.current = caneRoot;
    rollGroup.add(caneRoot);

    // 1. Rubber Foot Tip
    const tipGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.1, 16);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9, metalness: 0.1 });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.y = 0.05;
    tipMesh.castShadow = true;
    caneRoot.add(tipMesh);

    // 2. Aluminium Shaft
    const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.8, 20);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.75, roughness: 0.25 });
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    shaftMesh.position.y = 1.0;
    shaftMesh.castShadow = true;
    caneRoot.add(shaftMesh);

    // 3. Ergonomic Handle Grip
    const handleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.28, 16);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8, metalness: 0.2 });
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.rotation.x = Math.PI / 2;
    handleMesh.position.set(0, 1.45, 0.12);
    handleMesh.castShadow = true;
    caneRoot.add(handleMesh);

    // 4. Forearm Upper Stem & Cuff
    const cuffStemGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.45, 16);
    const cuffStemMesh = new THREE.Mesh(cuffStemGeo, shaftMat);
    cuffStemMesh.position.set(0, 1.7, 0.03);
    cuffStemMesh.rotation.x = -Math.PI / 18;
    caneRoot.add(cuffStemMesh);

    const cuffTorusGeo = new THREE.TorusGeometry(0.11, 0.02, 12, 32, (Math.PI * 4) / 3);
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.6, metalness: 0.3 });
    const cuffMesh = new THREE.Mesh(cuffTorusGeo, cuffMat);
    cuffMesh.rotation.x = Math.PI / 2;
    cuffMesh.rotation.z = -Math.PI / 6;
    cuffMesh.position.set(0, 1.9, 0.05);
    caneRoot.add(cuffMesh);

    // 5. Ultrasonic Sensors (Depan & Bawah)
    const sensorMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.5 });
    const frontBoxGeo = new THREE.BoxGeometry(0.11, 0.06, 0.04);
    const frontBox = new THREE.Mesh(frontBoxGeo, sensorMat);
    frontBox.position.set(0, 1.15, 0.045);
    caneRoot.add(frontBox);

    const eyeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: frontConnected ? 0x10b981 : 0x71717a,
      metalness: 0.9,
      roughness: 0.1
    });
    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.rotation.x = Math.PI / 2;
    eye1.position.set(-0.032, 1.15, 0.066);
    caneRoot.add(eye1);

    const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
    eye2.rotation.x = Math.PI / 2;
    eye2.position.set(0.032, 1.15, 0.066);
    caneRoot.add(eye2);

    const downBox = new THREE.Mesh(frontBoxGeo, sensorMat);
    downBox.position.set(0, 0.35, 0.045);
    downBox.rotation.x = Math.PI / 4;
    caneRoot.add(downBox);

    const eyeDownMat = new THREE.MeshStandardMaterial({
      color: downConnected ? 0x0ea5e9 : 0x71717a,
      metalness: 0.9,
      roughness: 0.1
    });
    const eyeDown1 = new THREE.Mesh(eyeGeo, eyeDownMat);
    eyeDown1.position.set(-0.032, 0.34, 0.065);
    eyeDown1.rotation.x = (Math.PI * 3) / 4;
    caneRoot.add(eyeDown1);

    const eyeDown2 = new THREE.Mesh(eyeGeo, eyeDownMat);
    eyeDown2.position.set(0.032, 0.34, 0.065);
    eyeDown2.rotation.x = (Math.PI * 3) / 4;
    caneRoot.add(eyeDown2);

    // 6. Sensor IMU MPU6050 Assembly (~70 cm dari bawah di muka depan +Z)
    const imuMountGroup = new THREE.Group();
    imuMountGroup.position.set(0, 0.70, 0);
    caneRoot.add(imuMountGroup);

    const breadboardGeo = new THREE.BoxGeometry(0.065, 0.12, 0.012);
    const breadboardMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.35, metalness: 0.1 });
    const breadboardMesh = new THREE.Mesh(breadboardGeo, breadboardMat);
    breadboardMesh.position.set(0, 0, 0.036);
    imuMountGroup.add(breadboardMesh);

    const mpuPcbGeo = new THREE.BoxGeometry(0.045, 0.065, 0.005);
    const mpuPcbMat = new THREE.MeshStandardMaterial({
      color: mpuConnected ? 0x0284c7 : 0x475569,
      roughness: 0.25,
      metalness: 0.4
    });
    const mpuPcbMesh = new THREE.Mesh(mpuPcbGeo, mpuPcbMat);
    mpuPcbMesh.position.set(0, 0.015, 0.046);
    imuMountGroup.add(mpuPcbMesh);

    const mpuChipGeo = new THREE.BoxGeometry(0.018, 0.018, 0.004);
    const mpuChipMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2, metalness: 0.9 });
    const mpuChipMesh = new THREE.Mesh(mpuChipGeo, mpuChipMat);
    mpuChipMesh.position.set(0, 0.015, 0.051);
    imuMountGroup.add(mpuChipMesh);

    const ledGeo = new THREE.BoxGeometry(0.006, 0.006, 0.004);
    const ledMat = new THREE.MeshBasicMaterial({ color: mpuConnected ? 0xef4444 : 0x71717a });
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.position.set(0.014, 0.038, 0.051);
    imuMountGroup.add(ledMesh);

    // 7. Sensor Air Konduktif (Plat Garpu di dasar dekat tip)
    const waterPlateGeo = new THREE.BoxGeometry(0.04, 0.08, 0.006);
    const waterPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3, metalness: 0.6 });
    const waterPlate = new THREE.Mesh(waterPlateGeo, waterPlateMat);
    waterPlate.position.set(0, 0.14, 0.035);
    caneRoot.add(waterPlate);

    // Render Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const target = targetRotationRef.current;
      const cur = currentRotationRef.current;
      const factor = 0.2;

      cur.pitch += (target.pitch - cur.pitch) * factor;
      cur.roll += (target.roll - cur.roll) * factor;
      cur.yaw += (target.yaw - cur.yaw) * factor;

      if (yawGroupRef.current) {
        yawGroupRef.current.rotation.y = cur.yaw;
      }
      if (pitchGroupRef.current) {
        pitchGroupRef.current.rotation.x = cur.pitch;
      }
      if (rollGroupRef.current) {
        rollGroupRef.current.rotation.z = cur.roll;
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // Mouse Controls (Orbit Camera)
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - prevMousePosRef.current.x;
    const deltaY = e.clientY - prevMousePosRef.current.y;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    const s = cameraSphericalRef.current;
    s.theta -= deltaX * 0.008;
    s.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.02, s.phi - deltaY * 0.008));
    updateCameraFromSpherical();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const s = cameraSphericalRef.current;
    s.radius = Math.max(2.5, Math.min(8.0, s.radius + e.deltaY * 0.004));
    updateCameraFromSpherical();
  };

  // Status Keselamatan
  const safetyStatus = useMemo(() => {
    const angle = rawTiltDeg ?? 0;
    if (angle >= 60) {
      return {
        label: "BAHAYA JATUH (SOS >60°)",
        color: "bg-rose-500/20 text-rose-500 border-rose-500/40",
        icon: AlertTriangle
      };
    }
    if (angle >= 30) {
      return {
        label: "MERABA TURUNAN (30°-60°)",
        color: "bg-amber-500/20 text-amber-500 border-amber-500/40",
        icon: Compass
      };
    }
    return {
      label: "TEGAK & JALAN NORMAL (0°-30°)",
      color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
      icon: CheckCircle2
    };
  }, [rawTiltDeg]);

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 w-screen h-screen bg-zinc-950 flex flex-col overflow-hidden animate-in fade-in duration-150"
          : "relative flex flex-col w-full h-full bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
      }
    >
      {/* Visualizer Top Bar */}
      <div className="px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              mpuConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
            }`}
          />
          <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Interpretasi 3D Orientasi Tongkat
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            MPU6050 (A4/A5)
          </span>
        </div>

        {/* Camera Presets & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Camera Preset Buttons */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => applyViewPreset("iso")}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                activeView === "iso" ? "bg-emerald-600 text-white font-bold" : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              3D ISO
            </button>
            <button
              type="button"
              onClick={() => applyViewPreset("side")}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                activeView === "side" ? "bg-emerald-600 text-white font-bold" : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              SAMPING
            </button>
            <button
              type="button"
              onClick={() => applyViewPreset("front")}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                activeView === "front" ? "bg-emerald-600 text-white font-bold" : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              DEPAN
            </button>
            <button
              type="button"
              onClick={() => applyViewPreset("top")}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                activeView === "top" ? "bg-emerald-600 text-white font-bold" : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              ATAS
            </button>
          </div>

          {/* Readout angle badge */}
          <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 ${safetyStatus.color}`}>
            <safetyStatus.icon className="w-3.5 h-3.5" />
            <span>{safetyStatus.label}</span>
          </div>

          <div className="px-3 py-1 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono font-bold text-white flex items-center gap-1.5">
            <span className="text-zinc-400 font-normal">SUDUT:</span>
            <span className="text-emerald-400 text-sm">
              {rawTiltDeg !== null && mpuConnected ? `${rawTiltDeg.toFixed(1)}°` : "--"}
            </span>
          </div>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              isFullscreen
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30"
                : "bg-zinc-950 text-zinc-300 hover:text-white border-zinc-800 hover:bg-zinc-800"
            }`}
            title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Buka Layar Penuh"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline font-bold">Perkecil</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline font-bold">Layar Penuh</span>
              </>
            )}
          </button>

          {/* Hide/Collapse Button */}
          {onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className="px-2.5 py-1 text-[11px] font-mono rounded-lg border bg-zinc-950 text-zinc-400 hover:text-zinc-100 border-zinc-800 hover:bg-zinc-800 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Sembunyikan interpretasi 3D"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sembunyikan</span>
            </button>
          )}
        </div>
      </div>

      {/* 3D WebGL Canvas Area */}
      <div
        ref={mountRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`w-full ${
          isFullscreen ? "flex-1 min-h-0" : "h-[440px]"
        } relative select-none bg-radial from-zinc-900 to-zinc-950 cursor-grab active:cursor-grabbing`}
      >
        {/* Floating Overlays */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
          <div className="px-2.5 py-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Sumbu Z+ (Depan/Hijau) &amp; Sumbu X+ (Kanan/Biru)
          </div>
          <div className="px-2.5 py-1 bg-sky-950/80 backdrop-blur-md border border-sky-800/60 rounded-md text-[11px] font-mono text-sky-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            Modul MPU6050: Muka Depan Batang (+Z) ~70cm
          </div>
          <div className="px-2.5 py-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-400">
            Garis Putus-Putus: Referensi 0° Tegak Lurus Lantai
          </div>
        </div>

        {/* Bottom Help Tooltip */}
        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-zinc-500 pointer-events-none bg-zinc-950/80 px-2 py-1 rounded-md border border-zinc-900 flex items-center gap-2">
          <span>💡 Drag mouse untuk memutar kamera orbit | Scroll untuk zoom</span>
          <span className="text-zinc-600">|</span>
          <span className={mpuConnected ? "text-emerald-400 font-bold" : "text-zinc-500"}>
            {mpuConnected ? "🟢 Sensor MPU Terbaca Real-time" : "⚪ Sensor MPU Tidak Terhubung"}
          </span>
        </div>

        {/* Live Vector Diagnostic Box */}
        <div className="absolute top-3 right-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-2.5 rounded-lg font-mono text-[11px] text-zinc-300 space-y-1 shadow-lg pointer-events-none min-w-44">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-1 flex justify-between">
            <span>Orientasi Tongkat</span>
            <span className="text-emerald-400">
              {isSimMode ? "SIMULASI" : "TELEMETRI"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Kemiringan (Pitch):</span>
            <span className="font-bold text-zinc-100">
              {rawTiltDeg !== null && mpuConnected ? `${rawTiltDeg.toFixed(1)}°` : "--"}
            </span>
          </div>
          <div className="flex justify-between border-t border-zinc-800 pt-1">
            <span className="text-zinc-400">Status Gerak:</span>
            <span
              className={`font-bold ${
                rawTiltDeg !== null && rawTiltDeg > 30 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {!mpuConnected
                ? "OFFLINE"
                : rawTiltDeg !== null && rawTiltDeg > 60
                ? "TERJATUH"
                : rawTiltDeg !== null && rawTiltDeg > 30
                ? "TURUNAN"
                : "NORMAL"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
