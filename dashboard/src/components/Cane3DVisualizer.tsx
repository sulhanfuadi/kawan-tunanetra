"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import {
  RotateCcw,
  Compass,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";

interface Cane3DVisualizerProps {
  rawTiltDeg: number | null;
  mpuConnected: boolean;
  frontConnected?: boolean;
  downConnected?: boolean;
  isSimMode?: boolean;
  theme?: "dark" | "light";
}

export default function Cane3DVisualizer({
  rawTiltDeg,
  mpuConnected,
  frontConnected = false,
  downConnected = false,
  isSimMode = false,
  theme = "dark"
}: Cane3DVisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const caneGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Calibration states
  const [pitchOffset, setPitchOffset] = useState<number>(0);
  const [rollOffset, setRollOffset] = useState<number>(0);
  const [invertPitch, setInvertPitch] = useState<boolean>(false);
  const [invertRoll, setInvertRoll] = useState<boolean>(false);
  const [swapAxes, setSwapAxes] = useState<boolean>(false); // Opsi tukar sumbu Pitch & Roll jika posisi pemasangan sensor di samping memerlukan orientasi berbeda

  // Manual debug simulation slider state
  const [isManualSim, setIsManualSim] = useState<boolean>(false);
  const [manualPitch, setManualPitch] = useState<number>(15);
  const [manualRoll, setManualRoll] = useState<number>(0);

  // Camera preset view
  const [activeView, setActiveView] = useState<"iso" | "side" | "front" | "top">("iso");
  const [isPanelExpanded, setIsPanelExpanded] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Mouse orbit state
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraSphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 4.8,
    theta: Math.PI / 4,
    phi: Math.PI / 3
  });

  // Target rotation for lerping
  const targetRotationRef = useRef<{ pitch: number; roll: number }>({ pitch: 0, roll: 0 });
  const currentRotationRef = useRef<{ pitch: number; roll: number }>({ pitch: 0, roll: 0 });

  // Calculate base unswapped angles
  const basePitch = useMemo(() => {
    if (isManualSim) return (manualPitch + pitchOffset) * (invertPitch ? -1 : 1);
    if (!mpuConnected || rawTiltDeg === null) return 0;
    return (rawTiltDeg + pitchOffset) * (invertPitch ? -1 : 1);
  }, [isManualSim, manualPitch, rawTiltDeg, mpuConnected, pitchOffset, invertPitch]);

  const baseRoll = useMemo(() => {
    if (isManualSim) return (manualRoll + rollOffset) * (invertRoll ? -1 : 1);
    return rollOffset * (invertRoll ? -1 : 1);
  }, [isManualSim, manualRoll, rollOffset, invertRoll]);

  // Effective pitch & roll (honoring swapAxes)
  const effectivePitch = useMemo(() => {
    return swapAxes ? baseRoll : basePitch;
  }, [swapAxes, basePitch, baseRoll]);

  const effectiveRoll = useMemo(() => {
    return swapAxes ? basePitch : baseRoll;
  }, [swapAxes, basePitch, baseRoll]);

  // Calculate effective net tilt angle
  const effectiveTilt = useMemo(() => {
    if (isManualSim) {
      return Math.sqrt(effectivePitch * effectivePitch + effectiveRoll * effectiveRoll);
    }
    if (!mpuConnected || rawTiltDeg === null) return null;
    const net = Math.abs(effectivePitch);
    return Math.max(0, Math.min(90, net));
  }, [isManualSim, effectivePitch, effectiveRoll, mpuConnected, rawTiltDeg]);

  // Update target rotation ref whenever calculated values change
  useEffect(() => {
    targetRotationRef.current = {
      pitch: THREE.MathUtils.degToRad(effectivePitch),
      roll: THREE.MathUtils.degToRad(effectiveRoll)
    };
  }, [effectivePitch, effectiveRoll]);

  // Tare / Zero Point Calibration
  const handleSetZero = () => {
    if (isManualSim) {
      setPitchOffset(-manualPitch);
      setRollOffset(-manualRoll);
    } else if (rawTiltDeg !== null && mpuConnected) {
      setPitchOffset(-rawTiltDeg);
      setRollOffset(0);
    }
  };

  const handleResetCalibration = () => {
    setPitchOffset(0);
    setRollOffset(0);
    setInvertPitch(false);
    setInvertRoll(false);
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
      // Look from the side (Pitch view)
      s.theta = 0;
      s.phi = Math.PI / 2;
      s.radius = 4.6;
    } else if (view === "front") {
      // Look from the front (Roll view)
      s.theta = Math.PI / 2;
      s.phi = Math.PI / 2;
      s.radius = 4.6;
    } else if (view === "top") {
      s.theta = 0;
      s.phi = 0.05;
      s.radius = 4.8;
    }
    updateCameraFromSpherical();
  };

  const updateCameraFromSpherical = () => {
    if (!cameraRef.current) return;
    const s = cameraSphericalRef.current;
    const x = s.radius * Math.sin(s.phi) * Math.sin(s.theta);
    const y = s.radius * Math.cos(s.phi);
    const z = s.radius * Math.sin(s.phi) * Math.cos(s.theta);
    cameraRef.current.position.set(x, Math.max(0.2, y + 1.0), z);
    cameraRef.current.lookAt(0, 1.0, 0);
  };

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraFromSpherical();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(4, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 20;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    // 5. Floor & Grid
    const gridHelper = new THREE.GridHelper(6, 24, 0x10b981, 0x3f3f46);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Floor Disc (Ground Plane Reference)
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

    // Concentric Reference Rings
    const ringGeo1 = new THREE.RingGeometry(1.0, 1.015, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x52525b, side: THREE.DoubleSide });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat);
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 0.001;
    scene.add(ring1);

    const ringGeo2 = new THREE.RingGeometry(2.0, 2.015, 64);
    const ring2 = new THREE.Mesh(ringGeo2, ringMat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.001;
    scene.add(ring2);

    // Reference Axis Markers
    const axisGroup = new THREE.Group();
    // Forward (Z+) Axis Indicator (Green)
    const fwdGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2);
    const fwdMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const fwdMesh = new THREE.Mesh(fwdGeo, fwdMat);
    fwdMesh.rotation.x = Math.PI / 2;
    fwdMesh.position.set(0, 0.01, 0.6);
    axisGroup.add(fwdMesh);

    // Lateral (X+) Axis Indicator (Blue)
    const latGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2);
    const latMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
    const latMesh = new THREE.Mesh(latGeo, latMat);
    latMesh.rotation.z = Math.PI / 2;
    latMesh.position.set(0.6, 0.01, 0);
    axisGroup.add(latMesh);
    scene.add(axisGroup);

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

    // 6. 3D Cane Model Hierarchy
    // Pivot berada di ujung bawah (0, 0, 0) agar tongkat berotasi di titik tumpu lantai
    const caneRoot = new THREE.Group();
    caneGroupRef.current = caneRoot;
    scene.add(caneRoot);

    // A. Rubber Tip (Paling Bawah pada titik kontak lantai)
    const tipGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.1, 16);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.9,
      metalness: 0.1
    });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.y = 0.05;
    tipMesh.castShadow = true;
    caneRoot.add(tipMesh);

    // B. Main Shaft (Aluminium Rod)
    const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.8, 20);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.75,
      roughness: 0.25
    });
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    shaftMesh.position.y = 1.0;
    shaftMesh.castShadow = true;
    caneRoot.add(shaftMesh);

    // C. Forearm Crutch Cuff & Bracket (Lengan Siku Kruk)
    // Horizontal Handle Bracket
    const handleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.28, 16);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.8,
      metalness: 0.2
    });
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.rotation.x = Math.PI / 2;
    handleMesh.position.set(0, 1.45, 0.12);
    handleMesh.castShadow = true;
    caneRoot.add(handleMesh);

    // Forearm Upper Shaft Extension
    const cuffStemGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.45, 16);
    const cuffStemMesh = new THREE.Mesh(cuffStemGeo, shaftMat);
    cuffStemMesh.position.set(0, 1.7, 0.03);
    cuffStemMesh.rotation.x = -Math.PI / 18; // Sedikit condong ke belakang khas kruk siku
    caneRoot.add(cuffStemMesh);

    // Forearm Cuff Ring (C-Shaped Cuff at Top)
    const cuffTorusGeo = new THREE.TorusGeometry(0.11, 0.02, 12, 32, (Math.PI * 4) / 3);
    const cuffMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.6,
      metalness: 0.3
    });
    const cuffMesh = new THREE.Mesh(cuffTorusGeo, cuffMat);
    cuffMesh.rotation.x = Math.PI / 2;
    cuffMesh.rotation.z = -Math.PI / 6;
    cuffMesh.position.set(0, 1.9, 0.05);
    caneRoot.add(cuffMesh);

    // D. Ultrasonic Sensor Modules
    // 1. Front Sensor HC-SR04 (Menghadap lurus ke depan Z+)
    const frontBoxGeo = new THREE.BoxGeometry(0.11, 0.06, 0.04);
    const sensorMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Biru PCB
      roughness: 0.4,
      metalness: 0.5
    });
    const frontBox = new THREE.Mesh(frontBoxGeo, sensorMat);
    frontBox.position.set(0, 1.15, 0.045);
    caneRoot.add(frontBox);

    // Transducers (Mata Lensa Ultrasonik Depan)
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

    // 2. Down Sensor HC-SR04 (Menghadap serong ke bawah 45°)
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

    // E. IMU MPU6050 Module (Terpasang di Sisi Kanan Batang Tongkat / +X)
    const imuPcbGeo = new THREE.BoxGeometry(0.012, 0.06, 0.06); // Tipis di sumbu X (menempel pada dinding pipa), dimensi di Y & Z
    const imuMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a, // Biru pekat PCB modul GY-521
      metalness: 0.3,
      roughness: 0.5
    });
    const imuMesh = new THREE.Mesh(imuPcbGeo, imuMat);
    imuMesh.position.set(0.034, 0.75, 0); // Menempel di sisi kanan batang pipa aluminium (X = +0.034)
    caneRoot.add(imuMesh);

    // IC Chip MPU-6050 (QFN-24 hitam di tengah PCB modul)
    const chipGeo = new THREE.BoxGeometry(0.006, 0.02, 0.02);
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2 });
    const chipMesh = new THREE.Mesh(chipGeo, chipMat);
    chipMesh.position.set(0.042, 0.75, 0);
    caneRoot.add(chipMesh);

    // Indikator LED IMU (merah di sisi luar PCB)
    const ledGeo = new THREE.BoxGeometry(0.006, 0.012, 0.01);
    const ledMat = new THREE.MeshBasicMaterial({
      color: mpuConnected ? 0xef4444 : 0x52525b
    });
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.position.set(0.042, 0.768, -0.018);
    caneRoot.add(ledMesh);

    // Pin Header Jumper (kuningan di bawah PCB)
    const pinHeaderGeo = new THREE.BoxGeometry(0.012, 0.015, 0.048);
    const pinHeaderMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 });
    const pinHeaderMesh = new THREE.Mesh(pinHeaderGeo, pinHeaderMat);
    pinHeaderMesh.position.set(0.034, 0.71, 0);
    caneRoot.add(pinHeaderMesh);

    // 7. Animation Loop with smooth lerp
    let lastTime = performance.now();
    const animate = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Smooth interpolation (lerp) for pitch and roll rotation
      const cur = currentRotationRef.current;
      const target = targetRotationRef.current;
      const factor = 0.15; // Smooth factor

      cur.pitch += (target.pitch - cur.pitch) * factor;
      cur.roll += (target.roll - cur.roll) * factor;

      if (caneGroupRef.current) {
        // Pitch rotates around X-axis (forward/backward)
        // Roll rotates around Z-axis (left/right)
        caneGroupRef.current.rotation.x = cur.pitch;
        caneGroupRef.current.rotation.z = cur.roll;
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // Mouse orbit controls on container
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

  // Copy calibration offset to clipboard for firmware/code
  const handleCopyConfig = () => {
    const configSnippet = `// Kalibrasi MPU6050 - Posisi Fisik: Sisi Kanan Batang Tongkat (+X)
const float MPU_PITCH_OFFSET = ${pitchOffset.toFixed(2)}f;
const float MPU_ROLL_OFFSET  = ${rollOffset.toFixed(2)}f;
const bool  MPU_INVERT_PITCH = ${invertPitch ? "true" : "false"};
const bool  MPU_INVERT_ROLL  = ${invertRoll ? "true" : "false"};
const bool  MPU_SWAP_AXES    = ${swapAxes ? "true" : "false"};`;
    navigator.clipboard.writeText(configSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Safety status badge
  const safetyStatus = useMemo(() => {
    const angle = effectiveTilt ?? 0;
    if (angle > 60) {
      return {
        label: "BAHAYA JATUH (SOS >60°)",
        color: "bg-rose-500/20 text-rose-500 border-rose-500/40",
        icon: AlertTriangle
      };
    }
    if (angle > 35) {
      return {
        label: "MIRING WASPADA (35°-60°)",
        color: "bg-amber-500/20 text-amber-500 border-amber-500/40",
        icon: Compass
      };
    }
    return {
      label: "TEGAK STABIL (0°-35°)",
      color: "bg-emerald-500/20 text-emerald-500 border-emerald-500/40",
      icon: CheckCircle2
    };
  }, [effectiveTilt]);

  return (
    <div className="relative flex flex-col w-full h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Visualizer Top Bar */}
      <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2.5 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            3D Cane Orientation & Calibration Lab
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            Three.js WebGL
          </span>
        </div>

        {/* Camera Preset Buttons */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => applyViewPreset("iso")}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-all ${
              activeView === "iso"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Tampilan Perspektif Bebas 3D"
          >
            3D ISO
          </button>
          <button
            type="button"
            onClick={() => applyViewPreset("side")}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-all ${
              activeView === "side"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Tampak Samping (Pitch Profile)"
          >
            SAMPING (PITCH)
          </button>
          <button
            type="button"
            onClick={() => applyViewPreset("front")}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-all ${
              activeView === "front"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Tampak Depan (Roll Profile)"
          >
            DEPAN (ROLL)
          </button>
          <button
            type="button"
            onClick={() => applyViewPreset("top")}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-all ${
              activeView === "top"
                ? "bg-emerald-600 text-white font-bold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Tampak Atas"
          >
            ATAS
          </button>
        </div>

        {/* Readout angle badge */}
        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 ${safetyStatus.color}`}
          >
            <safetyStatus.icon className="w-3.5 h-3.5" />
            {safetyStatus.label}
          </div>

          <div className="px-3 py-1 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono font-bold text-white flex items-center gap-2">
            <span className="text-zinc-400 font-normal">SUDUT:</span>
            <span className="text-emerald-400 text-sm">
              {effectiveTilt !== null ? `${effectiveTilt.toFixed(1)}°` : "--"}
            </span>
          </div>
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
        className="w-full h-96 cursor-grab active:cursor-grabbing relative select-none bg-radial from-zinc-900 to-zinc-950"
      >
        {/* Floating Canvas Overlays */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
          <div className="px-2.5 py-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Sumbu Z+ (Depan/Hijau) & Sumbu X+ (Kanan/Biru)
          </div>
          <div className="px-2.5 py-1 bg-sky-950/80 backdrop-blur-md border border-sky-800/60 rounded-md text-[11px] font-mono text-sky-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            Sensor IMU MPU6050: Sisi Kanan Batang (+X)
          </div>
          <div className="px-2.5 py-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-400">
            Garis Putus-Putus: Referensi 0° Plumb Line Tegak
          </div>
        </div>

        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-zinc-500 pointer-events-none bg-zinc-950/70 px-2 py-1 rounded-md border border-zinc-900">
          💡 Drag mouse untuk rotasi sudut pandang | Scroll mouse untuk zoom
        </div>

        {/* Live Vector Diagnostic Box */}
        <div className="absolute top-3 right-3 bg-zinc-900/85 backdrop-blur-md border border-zinc-800 p-2.5 rounded-lg font-mono text-[11px] text-zinc-300 space-y-1 shadow-lg pointer-events-none min-w-44">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-1 flex justify-between">
            <span>Orientasi 3D</span>
            <span className="text-emerald-400">{isManualSim ? "SIMULASI" : "TELEMETRI"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Pitch (Maju/Mundur):</span>
            <span className="font-bold text-zinc-100">{effectivePitch.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Roll (Kiri/Kanan):</span>
            <span className="font-bold text-zinc-100">{effectiveRoll.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between border-t border-zinc-800 pt-1">
            <span className="text-zinc-400">Net Kemiringan:</span>
            <span className="font-bold text-emerald-400">
              {effectiveTilt !== null ? `${effectiveTilt.toFixed(1)}°` : "--"}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 pt-0.5">
            <span>Raw Sensor:</span>
            <span>{rawTiltDeg !== null ? `${rawTiltDeg.toFixed(1)}°` : "--"}</span>
          </div>
        </div>
      </div>

      {/* Developer Calibration & Debugging Panel */}
      <div className="bg-zinc-900/95 border-t border-zinc-800 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
              Panel Kalibrasi & Sinkronisasi Aktual Developer
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyConfig}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md text-[11px] font-mono flex items-center gap-1 transition-colors"
              title="Salin parameter offset kalibrasi ke clipboard kode"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? "Disalin!" : "Salin C++ Config"}
            </button>

            <button
              type="button"
              onClick={() => setIsPanelExpanded(!isPanelExpanded)}
              className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {isPanelExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isPanelExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Column 1: Zero Point / Tare Action */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-2.5">
              <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                <span>1. Kalibrasi Titik Nol (Tare)</span>
                <span className="text-[10px] font-mono text-zinc-500">Auto Offset</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Posisikan tongkat tegak lurus secara fisik, lalu klik tombol ini untuk menetapkan posisi saat ini
                sebagai 0.0°.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSetZero}
                  className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-md shadow-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Set Zero (0° Tegak)
                </button>
                <button
                  type="button"
                  onClick={handleResetCalibration}
                  className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs rounded-md border border-zinc-700 transition-all"
                  title="Reset offset ke 0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Column 2: Fine-Tuning Offsets & Axis Direction */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-2.5">
              <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                <span>2. Fine-Tuning Offset Sudut</span>
                <span className="text-[10px] font-mono text-emerald-400">
                  P:{pitchOffset.toFixed(1)}° | R:{rollOffset.toFixed(1)}°
                </span>
              </div>

              {/* Pitch Offset Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>Pitch Offset:</span>
                  <span>{pitchOffset > 0 ? `+${pitchOffset.toFixed(1)}` : pitchOffset.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="0.5"
                  value={pitchOffset}
                  onChange={(e) => setPitchOffset(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Invert Axis & Mounting Direction Checkboxes */}
              <div className="space-y-1.5 pt-1 text-[11px] font-mono text-zinc-300">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invertPitch}
                      onChange={(e) => setInvertPitch(e.target.checked)}
                      className="rounded-xs accent-emerald-500"
                    />
                    <span>Balik Pitch</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={invertRoll}
                      onChange={(e) => setInvertRoll(e.target.checked)}
                      className="rounded-xs accent-emerald-500"
                    />
                    <span>Balik Roll</span>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                  <label className="flex items-center gap-1.5 cursor-pointer text-sky-400">
                    <input
                      type="checkbox"
                      checked={swapAxes}
                      onChange={(e) => setSwapAxes(e.target.checked)}
                      className="rounded-xs accent-sky-500"
                    />
                    <span>Tukar Sumbu (Pitch ↔ Roll)</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Mount: Kanan (+X)</span>
                </div>
              </div>
            </div>

            {/* Column 3: Manual Debug Slider (Sandbox Verification) */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-2.5">
              <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                <span>3. Sandbox Verifikasi 3D</span>
                <label className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isManualSim}
                    onChange={(e) => setIsManualSim(e.target.checked)}
                    className="rounded-xs accent-emerald-500"
                  />
                  <span>Uji Slider</span>
                </label>
              </div>

              {isManualSim ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Simulasi Pitch:</span>
                      <span className="text-zinc-100 font-bold">{manualPitch}°</span>
                    </div>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      value={manualPitch}
                      onChange={(e) => setManualPitch(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Simulasi Roll:</span>
                      <span className="text-zinc-100 font-bold">{manualRoll}°</span>
                    </div>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      value={manualRoll}
                      onChange={(e) => setManualRoll(parseInt(e.target.value, 10))}
                      className="w-full accent-sky-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-zinc-400 space-y-1.5 pt-0.5">
                  <p>Mode telemetri live aktif: Mengikuti pembacaan sensor fisik MPU6050 dari kabel Serial USB.</p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Status: {mpuConnected ? "🟢 MPU6050 Terdeteksi" : "🔴 MPU6050 Belum Terhubung"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
