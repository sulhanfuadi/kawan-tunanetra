"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import {
  RotateCcw,
  Compass,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Copy,
  Check,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Save,
  Bookmark,
  ShieldCheck,
  Footprints,
  Flame,
  Wrench,
  HelpCircle,
  Move3d,
  Hand,
  Maximize2,
  Minimize2
} from "lucide-react";

interface Cane3DVisualizerProps {
  rawTiltDeg: number | null;
  mpuConnected: boolean;
  frontConnected?: boolean;
  downConnected?: boolean;
  isSimMode?: boolean;
  theme?: "dark" | "light";
}

export interface CalibrationProfile {
  id: string;
  name: string;
  pitchOffset: number;
  rollOffset: number;
  clampTwist: number;
  invertPitch: boolean;
  invertRoll: boolean;
  swapAxes: boolean;
  walkingStance: number;
  dropThreshold: number;
  fallThreshold: number;
  noiseDeadband: number;
}

const DEFAULT_PROFILE: CalibrationProfile = {
  id: "default",
  name: "Standar Normal (Default)",
  pitchOffset: 0,
  rollOffset: 0,
  clampTwist: 0,
  invertPitch: false,
  invertRoll: false,
  swapAxes: false,
  walkingStance: 15.0,
  dropThreshold: 40.0,
  fallThreshold: 60.0,
  noiseDeadband: 1.0
};

const PRESET_PROFILES: CalibrationProfile[] = [
  DEFAULT_PROFILE,
  {
    id: "relaxed",
    name: "Pengguna Santai / Condong Depan",
    pitchOffset: 3.5,
    rollOffset: 0,
    clampTwist: 0,
    invertPitch: false,
    invertRoll: false,
    swapAxes: false,
    walkingStance: 22.0,
    dropThreshold: 45.0,
    fallThreshold: 65.0,
    noiseDeadband: 1.2
  },
  {
    id: "elderly",
    name: "Lansia / Postur Tegak Pendek",
    pitchOffset: -1.0,
    rollOffset: 0,
    clampTwist: 0,
    invertPitch: false,
    invertRoll: false,
    swapAxes: false,
    walkingStance: 11.0,
    dropThreshold: 35.0,
    fallThreshold: 50.0,
    noiseDeadband: 1.5
  }
];

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
  const yawGroupRef = useRef<THREE.Group | null>(null);
  const pitchGroupRef = useRef<THREE.Group | null>(null);
  const rollGroupRef = useRef<THREE.Group | null>(null);
  const twistGroupRef = useRef<THREE.Group | null>(null);
  const caneGroupRef = useRef<THREE.Group | null>(null);
  const caneManipulatorRef = useRef<THREE.Mesh | null>(null);
  const imuMountGroupRef = useRef<THREE.Group | null>(null);
  const zoneMeshesRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Active Tab & Interaction Mode
  const [activeTab, setActiveTab] = useState<"wizard" | "finetune" | "profiles">("wizard");
  const [interactMode, setInteractMode] = useState<"orbit" | "dragCane">("orbit");
  const [dragSubMode, setDragSubMode] = useState<"pitchRoll" | "yaw" | "twist">("pitchRoll");
  const [draggedPitch, setDraggedPitch] = useState<number>(15);
  const [draggedRoll, setDraggedRoll] = useState<number>(0);
  const [draggedYaw, setDraggedYaw] = useState<number>(0);
  const [draggedTwist, setDraggedTwist] = useState<number>(0);
  const [isCanePosed, setIsCanePosed] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardCompleted, setWizardCompleted] = useState<{ step1: boolean; step2: boolean; step3: boolean }>({
    step1: false,
    step2: false,
    step3: false
  });

  // Calibration Core Parameters
  const [pitchOffset, setPitchOffset] = useState<number>(0);
  const [rollOffset, setRollOffset] = useState<number>(0);
  const [clampTwist, setClampTwist] = useState<number>(0); // Rotasi pelintir klem sensor pada pipa silinder
  const [invertPitch, setInvertPitch] = useState<boolean>(false);
  const [invertRoll, setInvertRoll] = useState<boolean>(false);
  const [swapAxes, setSwapAxes] = useState<boolean>(false);

  // Posture Envelopes
  const [walkingStance, setWalkingStance] = useState<number>(15.0);
  const [dropThreshold, setDropThreshold] = useState<number>(40.0);
  const [fallThreshold, setFallThreshold] = useState<number>(60.0);
  const [noiseDeadband, setNoiseDeadband] = useState<number>(1.0);
  const [showAngleZones, setShowAngleZones] = useState<boolean>(true);

  // Manual debug simulation
  const [isManualSim, setIsManualSim] = useState<boolean>(false);
  const [manualPitch, setManualPitch] = useState<number>(15);
  const [manualRoll, setManualRoll] = useState<number>(0);

  // Stability detection
  const recentSamplesRef = useRef<number[]>([]);
  const [isStable, setIsStable] = useState<boolean>(true);

  // UI state
  const [activeView, setActiveView] = useState<"iso" | "side" | "front" | "top">("iso");
  const [isPanelExpanded, setIsPanelExpanded] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [currentProfileId, setCurrentProfileId] = useState<string>("default");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Keyboard shortcut to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Mouse orbit & drag state
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraSphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 4.8,
    theta: Math.PI / 4,
    phi: Math.PI / 3
  });

  const dragButtonRef = useRef<number>(0);
  const targetRotationRef = useRef<{ pitch: number; roll: number; yaw: number; twist: number }>({ pitch: 0, roll: 0, yaw: 0, twist: 0 });
  const currentRotationRef = useRef<{ pitch: number; roll: number; yaw: number; twist: number }>({ pitch: 0, roll: 0, yaw: 0, twist: 0 });

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("katana_cane_calibration");
      if (stored) {
        const parsed: CalibrationProfile = JSON.parse(stored);
        setPitchOffset(parsed.pitchOffset ?? 0);
        setRollOffset(parsed.rollOffset ?? 0);
        setClampTwist(parsed.clampTwist ?? 0);
        setInvertPitch(!!parsed.invertPitch);
        setInvertRoll(!!parsed.invertRoll);
        setSwapAxes(!!parsed.swapAxes);
        setWalkingStance(parsed.walkingStance ?? 15.0);
        setDropThreshold(parsed.dropThreshold ?? 40.0);
        setFallThreshold(parsed.fallThreshold ?? 60.0);
        setNoiseDeadband(parsed.noiseDeadband ?? 1.0);
        setCurrentProfileId(parsed.id || "custom");
      }
    } catch (e) {
      console.warn("Gagal memuat kalibrasi dari localStorage:", e);
    }
  }, []);

  // Update stability detection on incoming sensor data
  useEffect(() => {
    const val = isManualSim ? manualPitch : (rawTiltDeg ?? 0);
    const arr = recentSamplesRef.current;
    arr.push(val);
    if (arr.length > 8) arr.shift();

    if (arr.length >= 4) {
      const max = Math.max(...arr);
      const min = Math.min(...arr);
      const delta = max - min;
      setIsStable(delta < 0.4);
    }
  }, [rawTiltDeg, manualPitch, isManualSim]);

  // Calculate base unswapped angles from sensor
  const basePitch = useMemo(() => {
    if (isManualSim) return (manualPitch + pitchOffset) * (invertPitch ? -1 : 1);
    if (!mpuConnected || rawTiltDeg === null) return 0;
    return (rawTiltDeg + pitchOffset) * (invertPitch ? -1 : 1);
  }, [isManualSim, manualPitch, rawTiltDeg, mpuConnected, pitchOffset, invertPitch]);

  const baseRoll = useMemo(() => {
    if (isManualSim) return (manualRoll + rollOffset) * (invertRoll ? -1 : 1);
    return rollOffset * (invertRoll ? -1 : 1);
  }, [isManualSim, manualRoll, rollOffset, invertRoll]);

  // Effective pitch & roll (honoring swapAxes and deadband)
  const effectivePitch = useMemo(() => {
    const raw = swapAxes ? baseRoll : basePitch;
    if (Math.abs(raw) < noiseDeadband) return 0;
    return raw;
  }, [swapAxes, basePitch, baseRoll, noiseDeadband]);

  const effectiveRoll = useMemo(() => {
    const raw = swapAxes ? basePitch : baseRoll;
    if (Math.abs(raw) < noiseDeadband) return 0;
    return raw;
  }, [swapAxes, basePitch, baseRoll, noiseDeadband]);

  // Effective net tilt
  const effectiveTilt = useMemo(() => {
    if (interactMode === "dragCane") {
      return Math.sqrt(draggedPitch * draggedPitch + draggedRoll * draggedRoll);
    }
    if (isManualSim) {
      return Math.sqrt(effectivePitch * effectivePitch + effectiveRoll * effectiveRoll);
    }
    if (!mpuConnected || rawTiltDeg === null) return null;
    const net = Math.abs(effectivePitch);
    return Math.max(0, Math.min(90, net));
  }, [interactMode, draggedPitch, draggedRoll, isManualSim, effectivePitch, effectiveRoll, mpuConnected, rawTiltDeg]);

  // Update target rotation ref
  useEffect(() => {
    if (interactMode === "dragCane") {
      targetRotationRef.current = {
        pitch: THREE.MathUtils.degToRad(draggedPitch),
        roll: THREE.MathUtils.degToRad(draggedRoll),
        yaw: THREE.MathUtils.degToRad(draggedYaw),
        twist: THREE.MathUtils.degToRad(draggedTwist + clampTwist)
      };
    } else {
      targetRotationRef.current = {
        pitch: THREE.MathUtils.degToRad(effectivePitch),
        roll: THREE.MathUtils.degToRad(effectiveRoll),
        yaw: 0,
        twist: THREE.MathUtils.degToRad(clampTwist)
      };
    }
  }, [interactMode, draggedPitch, draggedRoll, draggedYaw, draggedTwist, clampTwist, effectivePitch, effectiveRoll]);

  // Show/Hide 3D Manipulator Handle
  useEffect(() => {
    if (caneManipulatorRef.current) {
      caneManipulatorRef.current.visible = interactMode === "dragCane";
    }
  }, [interactMode]);

  // Update IMU clamp twist in 3D scene
  useEffect(() => {
    if (imuMountGroupRef.current) {
      imuMountGroupRef.current.rotation.y = THREE.MathUtils.degToRad(clampTwist);
    }
  }, [clampTwist]);

  // Build / Update 3D Zone Envelopes
  const updateZoneVisuals = useCallback(() => {
    if (!zoneMeshesRef.current || !sceneRef.current) return;
    const group = zoneMeshesRef.current;

    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
    }

    if (!showAngleZones) return;

    const radius = 1.9;

    const createArcWedge = (startDeg: number, endDeg: number, color: number, opacity: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);

      const segments = 24;
      for (let i = 0; i <= segments; i++) {
        const thetaDeg = 90 - (startDeg + (endDeg - startDeg) * (i / segments));
        const rad = THREE.MathUtils.degToRad(thetaDeg);
        const y = Math.sin(rad) * radius;
        const z = Math.cos(rad) * radius;
        if (i === 0) shape.moveTo(z, y);
        else shape.lineTo(z, y);
      }
      shape.lineTo(0, 0);

      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.y = -Math.PI / 2; // Selaraskan sektor busur derajat ke sumbu +Z (arah hadap maju tongkat)
      return mesh;
    };

    const safeMax = Math.min(dropThreshold, walkingStance + 6);
    const safeMesh = createArcWedge(0, safeMax, 0x10b981, 0.18);
    group.add(safeMesh);

    const cautionMesh = createArcWedge(safeMax, fallThreshold, 0xf59e0b, 0.22);
    group.add(cautionMesh);

    const fallMesh = createArcWedge(fallThreshold, 90, 0xf43f5e, 0.26); // Menjangkau lantai 90°
    group.add(fallMesh);
  }, [showAngleZones, walkingStance, dropThreshold, fallThreshold]);

  useEffect(() => {
    updateZoneVisuals();
  }, [updateZoneVisuals]);

  // Wizard Step Handlers
  const handleCapturePlumbZero = () => {
    const current = isManualSim ? manualPitch : (rawTiltDeg ?? 0);
    setPitchOffset(-current);
    setRollOffset(0);
    setWizardCompleted((prev) => ({ ...prev, step1: true }));
    setWizardStep(2);
  };

  const handleCaptureWalkingStance = () => {
    const current = effectiveTilt ?? (isManualSim ? manualPitch : 15);
    setWalkingStance(Math.max(5, Math.min(35, Math.round(current * 10) / 10)));
    setWizardCompleted((prev) => ({ ...prev, step2: true }));
    setWizardStep(3);
  };

  const handleCaptureFallLimit = () => {
    const current = effectiveTilt ?? (isManualSim ? manualPitch : 60);
    if (current > 45) {
      setFallThreshold(Math.round(current));
    } else {
      setFallThreshold(60.0);
    }
    setWizardCompleted((prev) => ({ ...prev, step3: true }));
    handleSaveCurrentProfile();
  };

  // Direct 3D Model Drag-to-Align Synchronization
  const handleAutoAlignSensor = () => {
    const currentRaw = rawTiltDeg ?? (isManualSim ? manualPitch : 0);
    // User wants current physical reading to produce visual orientation draggedPitch & draggedRoll
    const newP = (draggedPitch * (invertPitch ? -1 : 1)) - currentRaw;
    const newR = draggedRoll * (invertRoll ? -1 : 1);

    const roundedP = Math.round(newP * 10) / 10;
    const roundedR = Math.round(newR * 10) / 10;

    setPitchOffset(roundedP);
    setRollOffset(roundedR);

    // Save to LocalStorage
    try {
      const profile: CalibrationProfile = {
        id: "custom",
        name: "Profil Kalibrasi Drag-to-Align",
        pitchOffset: roundedP,
        rollOffset: roundedR,
        clampTwist,
        invertPitch,
        invertRoll,
        swapAxes,
        walkingStance,
        dropThreshold,
        fallThreshold,
        noiseDeadband
      };
      localStorage.setItem("katana_cane_calibration", JSON.stringify(profile));
    } catch (e) {
      console.warn("Gagal auto-save:", e);
    }

    setSyncFeedback(`Sensor berhasil disinkronkan! (Offset Pitch: ${roundedP > 0 ? `+${roundedP}` : roundedP}°, Roll: ${roundedR > 0 ? `+${roundedR}` : roundedR}°)`);
    setTimeout(() => setSyncFeedback(null), 3500);
    setInteractMode("orbit");
    setIsCanePosed(false);
  };

  // Reset to Factory Default
  const handleResetToDefault = () => {
    applyProfile(DEFAULT_PROFILE);
  };

  // Apply a Profile
  const applyProfile = (p: CalibrationProfile) => {
    setPitchOffset(p.pitchOffset);
    setRollOffset(p.rollOffset);
    setClampTwist(p.clampTwist);
    setInvertPitch(p.invertPitch);
    setInvertRoll(p.invertRoll);
    setSwapAxes(p.swapAxes);
    setWalkingStance(p.walkingStance);
    setDropThreshold(p.dropThreshold);
    setFallThreshold(p.fallThreshold);
    setNoiseDeadband(p.noiseDeadband);
    setCurrentProfileId(p.id);
  };

  // Save to LocalStorage
  const handleSaveCurrentProfile = () => {
    const profile: CalibrationProfile = {
      id: currentProfileId === "default" ? "custom" : currentProfileId,
      name: "Profil Kustom Pengguna",
      pitchOffset,
      rollOffset,
      clampTwist,
      invertPitch,
      invertRoll,
      swapAxes,
      walkingStance,
      dropThreshold,
      fallThreshold,
      noiseDeadband
    };
    try {
      localStorage.setItem("katana_cane_calibration", JSON.stringify(profile));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error("Gagal menyimpan profil:", e);
    }
  };

  // Copy C++ Header config
  const handleCopyConfig = () => {
    const configSnippet = `// ========================================================
// KATANA SMART CANE - IMU MPU6050 CALIBRATION CONFIGURATION
// Posisi Fisik: Muka Depan Batang Tongkat (+Z), ~70 cm dari bawah
// Orientasi Sumbu: Y (Vertikal Batang), X (Lateral Gagang), Z (Depan)
// Dihasilkan dari Web Dashboard Katana 3D Calibration Lab
// ========================================================

#ifndef KATANA_IMU_CALIBRATION_H
#define KATANA_IMU_CALIBRATION_H

// 1. Parameter Offset Kalibrasi Posisi
const float MPU_PITCH_OFFSET     = ${pitchOffset.toFixed(2)}f;  // Koreksi tegak lurus (0° Plumb Zero)
const float MPU_ROLL_OFFSET      = ${rollOffset.toFixed(2)}f;   // Koreksi kemiringan lateral
const float MPU_CLAMP_TWIST_DEG  = ${clampTwist.toFixed(2)}f;   // Sudut pelintir dudukan pada batang tongkat
const bool  MPU_INVERT_PITCH     = ${invertPitch ? "true" : "false"};
const bool  MPU_INVERT_ROLL      = ${invertRoll ? "true" : "false"};
const bool  MPU_SWAP_AXES        = ${swapAxes ? "true" : "false"};   // Tukar Pitch & Roll jika orientasi chip memerlukan

// 2. Batas Envelope Postur & Ambang Batas Keselamatan
const float CANE_WALKING_STANCE_DEG = ${walkingStance.toFixed(1)}f; // Sudut normal saat pengguna melangkah
const float CANE_DROP_MAX_TILT_DEG  = ${dropThreshold.toFixed(1)}f; // Toleransi kemiringan saat meraba turunan
const float CANE_FALL_LIMIT_DEG     = ${fallThreshold.toFixed(1)}f; // Ambang batas tongkat jatuh memicu SOS (>60°)
const float CANE_NOISE_DEADBAND_DEG = ${noiseDeadband.toFixed(1)}f; // Filter peredam getaran tremor tangan

#endif // KATANA_IMU_CALIBRATION_H`;

    navigator.clipboard.writeText(configSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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
      s.theta = 0;
      s.phi = Math.PI / 2;
      s.radius = 4.6;
    } else if (view === "front") {
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
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

    // 1. Hierarki Pivot Bebas Gimbal Lock:
    // Yaw Pivot Group (memutar arah hadap 360° pada sumbu Y dunia)
    const yawGroup = new THREE.Group();
    yawGroupRef.current = yawGroup;
    scene.add(yawGroup);

    // Group Sektor Busur Derajat Keselamatan (menempel di yawGroup agar selalu sejalan dengan arah hadap)
    const zonesGroup = new THREE.Group();
    zoneMeshesRef.current = zonesGroup;
    yawGroup.add(zonesGroup);

    // 2. Pitch Pivot Group (kemiringan maju/mundur pada sumbu X lokal)
    const pitchGroup = new THREE.Group();
    pitchGroupRef.current = pitchGroup;
    yawGroup.add(pitchGroup);

    // 3. Roll Pivot Group (kemiringan lateral/samping pada sumbu Z lokal)
    const rollGroup = new THREE.Group();
    rollGroupRef.current = rollGroup;
    pitchGroup.add(rollGroup);

    // 4. Model Tongkat & Twist Poros (berputar pada poros silinder pipa tongkat)
    const caneRoot = new THREE.Group();
    caneGroupRef.current = caneRoot;
    twistGroupRef.current = caneRoot;
    rollGroup.add(caneRoot);

    // Rubber Foot Tip
    const tipGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.1, 16);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9, metalness: 0.1 });
    const tipMesh = new THREE.Mesh(tipGeo, tipMat);
    tipMesh.position.y = 0.05;
    tipMesh.castShadow = true;
    caneRoot.add(tipMesh);

    // Aluminium Shaft
    const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.8, 20);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.75, roughness: 0.25 });
    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    shaftMesh.position.y = 1.0;
    shaftMesh.castShadow = true;
    caneRoot.add(shaftMesh);

    // Handle Grip
    const handleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.28, 16);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8, metalness: 0.2 });
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.rotation.x = Math.PI / 2;
    handleMesh.position.set(0, 1.45, 0.12);
    handleMesh.castShadow = true;
    caneRoot.add(handleMesh);

    // Forearm Upper Stem & Cuff
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

    // 3D Manipulator Glowing Ring (Tampak saat mode dragCane aktif)
    const handleGizmoGeo = new THREE.TorusGeometry(0.14, 0.012, 12, 32);
    const handleGizmoMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85
    });
    const handleGizmoMesh = new THREE.Mesh(handleGizmoGeo, handleGizmoMat);
    handleGizmoMesh.rotation.x = Math.PI / 2;
    handleGizmoMesh.position.set(0, 1.85, 0.05);
    caneManipulatorRef.current = handleGizmoMesh;
    handleGizmoMesh.visible = false;
    caneRoot.add(handleGizmoMesh);

    // Ultrasonic Sensors
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

    // IMU Sensor Assembly (~70 cm dari bawah tongkat di muka depan +Z per foto fisik asli)
    const imuMountGroup = new THREE.Group();
    imuMountGroup.position.set(0, 0.70, 0);
    imuMountGroupRef.current = imuMountGroup;
    caneRoot.add(imuMountGroup);

    // Mini Breadboard Base (putih dengan tape hitam pengikat ke pipa per foto fisik)
    const breadboardGeo = new THREE.BoxGeometry(0.065, 0.12, 0.012);
    const breadboardMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.35, metalness: 0.1 });
    const breadboardMesh = new THREE.Mesh(breadboardGeo, breadboardMat);
    breadboardMesh.position.set(0, 0.01, 0.032); // Menempel di muka depan batang (+Z)
    imuMountGroup.add(breadboardMesh);

    // Lakban / Tape Hitam Pengikat ke Batang Pipa (per foto fisik)
    const tapeTopGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.03, 16);
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85, metalness: 0.1 });
    const tapeTopMesh = new THREE.Mesh(tapeTopGeo, tapeMat);
    tapeTopMesh.position.set(0, 0.06, 0);
    imuMountGroup.add(tapeTopMesh);

    const tapeBtmMesh = new THREE.Mesh(tapeTopGeo, tapeMat);
    tapeBtmMesh.position.set(0, -0.04, 0);
    imuMountGroup.add(tapeBtmMesh);

    // IMU PCB Module GY-521 / MPU-6050 (Biru tua, menghadap ke depan +Z)
    const imuPcbGeo = new THREE.BoxGeometry(0.042, 0.036, 0.006);
    const imuMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.3, roughness: 0.4 });
    const imuMesh = new THREE.Mesh(imuPcbGeo, imuMat);
    imuMesh.position.set(0, 0.042, 0.041);
    imuMountGroup.add(imuMesh);

    // IC Chip MPU-6050 (QFN Hitam di tengah PCB)
    const chipGeo = new THREE.BoxGeometry(0.016, 0.016, 0.004);
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 });
    const chipMesh = new THREE.Mesh(chipGeo, chipMat);
    chipMesh.position.set(0, 0.042, 0.046);
    imuMountGroup.add(chipMesh);

    // IMU Status LED (Hijau menyala di sisi kanan PCB per foto fisik)
    const ledGeo = new THREE.BoxGeometry(0.005, 0.005, 0.003);
    const ledMat = new THREE.MeshBasicMaterial({ color: mpuConnected ? 0x22c55e : 0x52525b });
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.position.set(0.014, 0.042, 0.047);
    imuMountGroup.add(ledMesh);

    // Pin Header Jumper (di sisi bawah modul MPU, menghubungkan ke breadboard)
    const pinHeaderGeo = new THREE.BoxGeometry(0.036, 0.01, 0.008);
    const pinHeaderMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 });
    const pinHeaderMesh = new THREE.Mesh(pinHeaderGeo, pinHeaderMat);
    pinHeaderMesh.position.set(0, 0.02, 0.041);
    imuMountGroup.add(pinHeaderMesh);

    // Render loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const cur = currentRotationRef.current;
      const target = targetRotationRef.current;
      const factor = 0.2;

      cur.pitch += (target.pitch - cur.pitch) * factor;
      cur.roll += (target.roll - cur.roll) * factor;
      cur.yaw += (target.yaw - cur.yaw) * factor;
      cur.twist += (target.twist - cur.twist) * factor;

      if (yawGroupRef.current) {
        yawGroupRef.current.rotation.y = cur.yaw;
      }
      if (pitchGroupRef.current) {
        pitchGroupRef.current.rotation.x = cur.pitch;
      }
      if (rollGroupRef.current) {
        rollGroupRef.current.rotation.z = cur.roll;
      }
      if (caneGroupRef.current) {
        caneGroupRef.current.rotation.y = cur.twist;
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

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // Mouse Controls (Handles both Orbit and Direct Cane Drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - prevMousePosRef.current.x;
    const deltaY = e.clientY - prevMousePosRef.current.y;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (interactMode === "dragCane") {
      if (e.buttons === 2 || e.shiftKey || dragSubMode === "yaw") {
        // Mode Yaw: Putar Arah Hadap Horizontal 360°
        setDraggedYaw((prev) => {
          const next = (prev + deltaX * 0.6) % 360;
          return next < 0 ? next + 360 : Math.round(next * 10) / 10;
        });
      } else if (dragSubMode === "twist") {
        // Mode Twist: Putar Poros Silinder Batang Tongkat
        setDraggedTwist((prev) => {
          const next = prev + deltaX * 0.5;
          return Math.max(-180, Math.min(180, Math.round(next * 10) / 10));
        });
      } else {
        // Mode Pitch & Roll: Kemiringan Bebas hingga 90° Rebah di Lantai
        setDraggedPitch((prev) => {
          const next = prev + deltaY * 0.35;
          return Math.max(-90, Math.min(90, Math.round(next * 10) / 10));
        });
        setDraggedRoll((prev) => {
          const next = prev + deltaX * 0.35;
          return Math.max(-90, Math.min(90, Math.round(next * 10) / 10));
        });
      }
      setIsCanePosed(true);
    } else {
      // Orbit camera
      const s = cameraSphericalRef.current;
      s.theta -= deltaX * 0.008;
      s.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.02, s.phi - deltaY * 0.008));
      updateCameraFromSpherical();
    }
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

  // Safety status badge
  const safetyStatus = useMemo(() => {
    const angle = effectiveTilt ?? 0;
    if (angle >= fallThreshold) {
      return {
        label: `BAHAYA JATUH (SOS >${fallThreshold.toFixed(0)}°)`,
        color: "bg-rose-500/20 text-rose-500 border-rose-500/40",
        icon: AlertTriangle
      };
    }
    if (angle >= dropThreshold) {
      return {
        label: `MERABA TURUNAN (${dropThreshold.toFixed(0)}°-${fallThreshold.toFixed(0)}°)`,
        color: "bg-amber-500/20 text-amber-500 border-amber-500/40",
        icon: Compass
      };
    }
    if (angle >= walkingStance + 5) {
      return {
        label: `MELANGKAH LEBAR (${(walkingStance + 5).toFixed(0)}°-${dropThreshold.toFixed(0)}°)`,
        color: "bg-sky-500/20 text-sky-400 border-sky-500/40",
        icon: Footprints
      };
    }
    return {
      label: `TEGAK & JALAN NORMAL (0°-${(walkingStance + 5).toFixed(0)}°)`,
      color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
      icon: CheckCircle2
    };
  }, [effectiveTilt, fallThreshold, dropThreshold, walkingStance]);

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 w-screen h-screen bg-zinc-950 flex flex-col overflow-hidden animate-in fade-in duration-150"
          : "relative flex flex-col w-full h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
      }
    >
      {/* Visualizer Top Bar */}
      <div className="px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            3D Cane Orientation & Comprehensive Calibration Suite
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            MPU6050 Muka Depan (+Z) ~70cm
          </span>
        </div>

        {/* Interaction Mode & Camera Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Interaction Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setInteractMode("orbit")}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                interactMode === "orbit"
                  ? "bg-zinc-800 text-white font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Mode Kamera Orbit (Putar sudut pandang)"
            >
              <span>🎥 Kamera Orbit</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInteractMode("dragCane");
                setDraggedPitch(effectivePitch);
                setDraggedRoll(effectiveRoll);
              }}
              className={`px-2.5 py-1 text-[11px] font-mono rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                interactMode === "dragCane"
                  ? "bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20 ring-1 ring-amber-400"
                  : "text-amber-400 hover:bg-zinc-800 border border-amber-500/30"
              }`}
              title="Mode Gerakkan Tongkat Langsung (Tarik model 3D untuk mencocokkan dengan fisik aktual)"
            >
              <Hand className="w-3 h-3" />
              <span>🖐️ Gerakkan Tongkat (Drag-to-Align)</span>
            </button>
          </div>

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
              SAMPING (PITCH)
            </button>
            <button
              type="button"
              onClick={() => applyViewPreset("front")}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                activeView === "front" ? "bg-emerald-600 text-white font-bold" : "text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              DEPAN (ROLL)
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

          {/* Readout angle badge & Fullscreen Toggle */}
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 ${safetyStatus.color}`}>
              <safetyStatus.icon className="w-3.5 h-3.5" />
              {safetyStatus.label}
            </div>

            <div className="px-3 py-1 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <span className="text-zinc-400 font-normal">SUDUT:</span>
              <span className="text-emerald-400 text-sm">
                {effectiveTilt !== null ? `${effectiveTilt.toFixed(1)}°` : "--"}
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
              title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Buka Layar Penuh (Fullscreen 3D Lab)"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline font-bold">Perkecil</span>
                  <span className="text-[9px] text-zinc-400 font-mono">(ESC)</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline font-bold">Layar Penuh</span>
                </>
              )}
            </button>
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
        onContextMenu={(e) => {
          if (interactMode === "dragCane") e.preventDefault();
        }}
        className={`w-full ${
          isFullscreen ? "flex-1 min-h-0" : "h-[480px]"
        } relative select-none bg-radial from-zinc-900 to-zinc-950 ${
          interactMode === "dragCane" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
      >
        {/* Floating Overlays */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
          <div className="px-2.5 py-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Sumbu Z+ (Depan/Hijau) &amp; Sumbu X+ (Kanan/Biru)
          </div>
          <div className="px-2.5 py-1 bg-sky-950/80 backdrop-blur-md border border-sky-800/60 rounded-md text-[11px] font-mono text-sky-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            Modul MPU6050: Muka Depan Batang (+Z) ~70cm {clampTwist !== 0 ? `[Twist ${clampTwist > 0 ? `+${clampTwist}` : clampTwist}°]` : ""}
          </div>
          <div className="px-2.5 py-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-400">
            Garis Putus-Putus: Referensi 0° Plumb Line Tegak Lurus
          </div>
        </div>

        <div className={`absolute bottom-3 left-3 text-[10px] font-mono text-zinc-500 pointer-events-none bg-zinc-950/80 px-2 py-1 rounded-md border border-zinc-900 ${interactMode === "dragCane" ? "hidden 2xl:flex" : "flex"} items-center gap-2`}>
          <span>{interactMode === "dragCane" ? "🖐️ Drag Kiri: Kemiringan | Drag Kanan / Shift+Drag: Putar Hadap" : "💡 Drag mouse rotasi kamera | Scroll zoom"}</span>
          <span className="text-zinc-600">|</span>
          <span className={isStable ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
            {isStable ? "🟢 Sensor Stabil" : "🟡 Sensor Goyang / Bergerak"}
          </span>
        </div>

        {/* Live Vector Diagnostic Box */}
        <div className="absolute top-3 right-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 p-2.5 rounded-lg font-mono text-[11px] text-zinc-300 space-y-1 shadow-lg pointer-events-none min-w-48">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-1 flex justify-between">
            <span>Orientasi Tongkat</span>
            <span className="text-emerald-400">
              {interactMode === "dragCane" ? "DRAG LANGSUNG" : (isManualSim ? "SIMULASI" : "TELEMETRI")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Pitch (Maju/Mundur):</span>
            <span className="font-bold text-zinc-100">
              {interactMode === "dragCane" ? `${draggedPitch.toFixed(1)}°` : `${effectivePitch.toFixed(1)}°`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Roll (Kiri/Kanan):</span>
            <span className="font-bold text-zinc-100">
              {interactMode === "dragCane" ? `${draggedRoll.toFixed(1)}°` : `${effectiveRoll.toFixed(1)}°`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Yaw (Arah Hadap):</span>
            <span className="font-bold text-sky-400">
              {interactMode === "dragCane" ? `${draggedYaw.toFixed(1)}°` : "0.0°"}
            </span>
          </div>
          <div className="flex justify-between border-t border-zinc-800 pt-1">
            <span className="text-zinc-400">Net Kemiringan:</span>
            <span className="font-bold text-emerald-400">
              {effectiveTilt !== null ? `${effectiveTilt.toFixed(1)}°` : "--"}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 pt-0.5">
            <span>Walking Stance:</span>
            <span className="text-sky-400 font-bold">{walkingStance.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Batas Jatuh (SOS):</span>
            <span className="text-rose-400 font-bold">&gt;{fallThreshold.toFixed(0)}°</span>
          </div>
        </div>

        {/* Direct Drag-to-Align Bottom Action Dock (Unobtrusive) */}
        {interactMode === "dragCane" && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md border border-amber-500/70 p-2.5 rounded-xl shadow-2xl flex flex-col gap-2 z-20 max-w-3xl w-[96%] sm:w-auto animate-in fade-in slide-in-from-bottom-2">
            {/* Top row: Status, Sub-Mode Selector, Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Drag Sub-Mode Pills */}
                <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setDragSubMode("pitchRoll")}
                    className={`px-2.5 py-1 text-[11px] font-mono rounded flex items-center gap-1 transition-all cursor-pointer ${
                      dragSubMode === "pitchRoll"
                        ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    📐 Miringkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setDragSubMode("yaw")}
                    className={`px-2.5 py-1 text-[11px] font-mono rounded flex items-center gap-1 transition-all cursor-pointer ${
                      dragSubMode === "yaw"
                        ? "bg-sky-500 text-zinc-950 font-bold shadow-sm"
                        : "text-sky-400 hover:text-sky-200"
                    }`}
                  >
                    🔄 Putar Hadap (Yaw)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDragSubMode("twist")}
                    className={`px-2.5 py-1 text-[11px] font-mono rounded flex items-center gap-1 transition-all cursor-pointer ${
                      dragSubMode === "twist"
                        ? "bg-purple-500 text-zinc-950 font-bold shadow-sm"
                        : "text-purple-400 hover:text-purple-200"
                    }`}
                  >
                    🌀 Pelintir Batang
                  </button>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-300">
                  <span className="text-zinc-400">Target:</span>
                  <span className="text-amber-400 font-bold">
                    P:{draggedPitch.toFixed(1)}° R:{draggedRoll.toFixed(1)}°
                  </span>
                  <span className="text-sky-400 font-bold">
                    Y:{draggedYaw.toFixed(0)}°
                  </span>
                  <span className="text-zinc-600 hidden md:inline">|</span>
                  <span className="text-zinc-400 hidden md:inline">Fisik:</span>
                  <span className="text-zinc-200 hidden md:inline">
                    {rawTiltDeg !== null ? `${rawTiltDeg.toFixed(1)}°` : "--"}
                  </span>
                  <span className="text-zinc-600 hidden md:inline">|</span>
                  <span className="text-zinc-400 hidden md:inline">Offset ΔP:</span>
                  <span className="text-emerald-400 font-bold hidden md:inline">
                    {(draggedPitch - (rawTiltDeg ?? 0)).toFixed(1)}°
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleAutoAlignSensor}
                  className="py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow-md shadow-emerald-950 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>✨ Cocokkan Sensor</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInteractMode("orbit");
                    setIsCanePosed(false);
                  }}
                  className="py-1.5 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-mono text-xs rounded-lg border border-zinc-700 transition-all cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>

            {/* Middle row: Interactive Sliders */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-800/80 font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Putar Hadap (Yaw):</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={draggedYaw}
                  onChange={(e) => {
                    setDraggedYaw(parseFloat(e.target.value));
                    setIsCanePosed(true);
                  }}
                  className="accent-sky-400 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer w-28 sm:w-36"
                />
                <span className="text-sky-400 font-bold w-9">{draggedYaw.toFixed(0)}°</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Kemiringan (Pitch):</span>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={draggedPitch}
                  onChange={(e) => {
                    setDraggedPitch(parseFloat(e.target.value));
                    setIsCanePosed(true);
                  }}
                  className="accent-amber-400 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer w-28 sm:w-36"
                />
                <span className="text-amber-400 font-bold w-9">{draggedPitch.toFixed(0)}°</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Kemiringan (Roll):</span>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={draggedRoll}
                  onChange={(e) => {
                    setDraggedRoll(parseFloat(e.target.value));
                    setIsCanePosed(true);
                  }}
                  className="accent-emerald-400 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer w-24 sm:w-28"
                />
                <span className="text-emerald-400 font-bold w-9">{draggedRoll.toFixed(0)}°</span>
              </div>
            </div>

            {/* Bottom row: Quick Preset Pose & Yaw Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800 text-[10px] font-mono">
              <span className="text-zinc-400 font-bold">Pose Cepat:</span>
              <button
                type="button"
                onClick={() => {
                  setDraggedPitch(0);
                  setDraggedRoll(0);
                  setIsCanePosed(true);
                }}
                className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors cursor-pointer"
                title="Tegakkan tongkat lurus 0° vertikal"
              >
                0° Tegak
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraggedPitch(15);
                  setDraggedRoll(0);
                  setIsCanePosed(true);
                }}
                className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800 transition-colors cursor-pointer"
                title="Pose melangkah normal 15°"
              >
                15° Jalan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraggedPitch(90);
                  setDraggedRoll(0);
                  setIsCanePosed(true);
                }}
                className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded border border-rose-800 transition-colors cursor-pointer"
                title="Rebahkan tongkat 90° rata di lantai (kondisi jatuh)"
              >
                90° Jatuh di Lantai
              </button>

              <span className="text-zinc-600 px-1">|</span>
              <span className="text-zinc-400 font-bold">Arah Hadap (Yaw):</span>
              <button
                type="button"
                onClick={() => {
                  setDraggedYaw(0);
                  setIsCanePosed(true);
                }}
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${draggedYaw === 0 ? "bg-sky-600 text-white border-sky-500 font-bold" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"}`}
              >
                0° Depan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraggedYaw(90);
                  setIsCanePosed(true);
                }}
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${draggedYaw === 90 ? "bg-sky-600 text-white border-sky-500 font-bold" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"}`}
              >
                90° Kanan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraggedYaw(180);
                  setIsCanePosed(true);
                }}
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${draggedYaw === 180 ? "bg-sky-600 text-white border-sky-500 font-bold" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"}`}
              >
                180° Blkg
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraggedYaw(270);
                  setIsCanePosed(true);
                }}
                className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${draggedYaw === 270 ? "bg-sky-600 text-white border-sky-500 font-bold" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"}`}
              >
                270° Kiri
              </button>

              <span className="text-zinc-500 hidden xl:inline ml-auto">
                💡 Klik tab mode di atas lalu drag di kanvas, atau geser slider langsung
              </span>
            </div>
          </div>
        )}

        {/* Sync Success Feedback Notification Toast */}
        {syncFeedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600/95 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xl border border-emerald-400 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 z-30 pointer-events-none">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{syncFeedback}</span>
          </div>
        )}
      </div>

      {/* Comprehensive Calibration Suite Deck */}
      <div className={`bg-zinc-900/95 border-t border-zinc-800 p-3.5 space-y-3 ${isFullscreen ? "max-h-[42vh] overflow-y-auto shrink-0" : ""}`}>
        {/* Navigation Tabs & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("wizard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${
                activeTab === "wizard"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              1. Guided Pose Wizard
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("finetune")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${
                activeTab === "finetune"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              2. Geometri &amp; Fine-Tuning
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("profiles")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${
                activeTab === "profiles"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              3. Profil &amp; Ekspor C++
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCurrentProfile}
              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-md text-[11px] font-mono flex items-center gap-1 transition-colors"
              title="Simpan konfigurasi saat ini ke browser localStorage"
            >
              {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {savedSuccess ? "Tersimpan!" : "Simpan Profil"}
            </button>

            <button
              type="button"
              onClick={handleCopyConfig}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md text-[11px] font-mono flex items-center gap-1 transition-colors"
              title="Salin file header C++ lengkap untuk Arduino IDE"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? "Disalin!" : "Salin C++ Header"}
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
          <div>
            {/* TAB 1: GUIDED POSE WIZARD */}
            {activeTab === "wizard" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">
                    Kalibrasi Terpandu Postur Fisik Tongkat (3 Langkah Mudah)
                  </span>
                  <span className="font-mono text-[11px]">
                    Status: {isStable ? "🟢 Posisi Tenang" : "🟡 Harap Tahan Tongkat Tetap Diam"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Step 1: Plumb Zero (0° Tegak) */}
                  <div
                    className={`p-3.5 rounded-lg border transition-all ${
                      wizardStep === 1
                        ? "bg-zinc-950 border-emerald-500/60 ring-1 ring-emerald-500/30"
                        : "bg-zinc-950/60 border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-zinc-200 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px]">
                          1
                        </span>
                        Pose 1: Tegak Nol (0° Plumb)
                      </span>
                      {wizardCompleted.step1 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      Posisikan tongkat berdiri vertikal tegak lurus lantai datar. Klik tombol untuk mengunci titik 0.0°.
                    </p>
                    <button
                      type="button"
                      onClick={handleCapturePlumbZero}
                      className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-md shadow-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Kunci Titik Nol (0° Tegak)
                    </button>
                    <div className="mt-2 text-[10px] font-mono text-zinc-500 flex justify-between">
                      <span>Offset Saat Ini:</span>
                      <span className="text-zinc-300 font-bold">{pitchOffset.toFixed(1)}°</span>
                    </div>
                  </div>

                  {/* Step 2: Walking Stance */}
                  <div
                    className={`p-3.5 rounded-lg border transition-all ${
                      wizardStep === 2
                        ? "bg-zinc-950 border-emerald-500/60 ring-1 ring-emerald-500/30"
                        : "bg-zinc-950/60 border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-zinc-200 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center text-[10px]">
                          2
                        </span>
                        Pose 2: Melangkah Normal
                      </span>
                      {wizardCompleted.step2 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      Pegang kruk siku pada posisi melangkah natural saat Anda berjalan kaki (biasanya condong ~12°-20°).
                    </p>
                    <button
                      type="button"
                      onClick={handleCaptureWalkingStance}
                      className="w-full py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-md shadow-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Footprints className="w-3.5 h-3.5" />
                      Kunci Pose Jalan ({effectiveTilt !== null ? `${effectiveTilt.toFixed(1)}°` : "15°"})
                    </button>
                    <div className="mt-2 text-[10px] font-mono text-zinc-500 flex justify-between">
                      <span>Walking Envelope:</span>
                      <span className="text-sky-300 font-bold">{walkingStance.toFixed(1)}°</span>
                    </div>
                  </div>

                  {/* Step 3: Fall Limit Confirmation */}
                  <div
                    className={`p-3.5 rounded-lg border transition-all ${
                      wizardStep === 3
                        ? "bg-zinc-950 border-emerald-500/60 ring-1 ring-emerald-500/30"
                        : "bg-zinc-950/60 border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-zinc-200 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center text-[10px]">
                          3
                        </span>
                        Pose 3: Ambang Jatuh (SOS)
                      </span>
                      {wizardCompleted.step3 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                      Rebahkan tongkat ke lantai atau tetapkan batas kemiringan ekstrem pemicu alarm SOS jatuh (&gt;60°).
                    </p>
                    <button
                      type="button"
                      onClick={handleCaptureFallLimit}
                      className="w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-md shadow-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Konfirmasi Batas Jatuh ({fallThreshold.toFixed(0)}°)
                    </button>
                    <div className="mt-2 text-[10px] font-mono text-zinc-500 flex justify-between">
                      <span>Batas Alarm SOS:</span>
                      <span className="text-rose-400 font-bold">&gt;{fallThreshold.toFixed(0)}°</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GEOMETRI & FINE-TUNING */}
            {activeTab === "finetune" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Column 1: Sumbu Pitch & Roll Offsets */}
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2.5">
                  <div className="text-[11px] font-bold text-zinc-200 flex items-center justify-between">
                    <span>Fine-Tuning Pitch &amp; Roll</span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      P:{pitchOffset.toFixed(1)}° | R:{rollOffset.toFixed(1)}°
                    </span>
                  </div>

                  {/* Pitch Offset */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Pitch Offset (Maju/Mundur):</span>
                      <span className="text-zinc-200 font-bold">{pitchOffset > 0 ? `+${pitchOffset.toFixed(1)}` : pitchOffset.toFixed(1)}°</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPitchOffset((v) => Math.round((v - 0.5) * 10) / 10)}
                        className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded text-[10px] font-mono hover:bg-zinc-700"
                      >
                        -0.5°
                      </button>
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        step="0.5"
                        value={pitchOffset}
                        onChange={(e) => setPitchOffset(parseFloat(e.target.value))}
                        className="flex-1 accent-emerald-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setPitchOffset((v) => Math.round((v + 0.5) * 10) / 10)}
                        className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded text-[10px] font-mono hover:bg-zinc-700"
                      >
                        +0.5°
                      </button>
                    </div>
                  </div>

                  {/* Roll Offset */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Roll Offset (Samping):</span>
                      <span className="text-zinc-200 font-bold">{rollOffset > 0 ? `+${rollOffset.toFixed(1)}` : rollOffset.toFixed(1)}°</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRollOffset((v) => Math.round((v - 0.5) * 10) / 10)}
                        className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded text-[10px] font-mono hover:bg-zinc-700"
                      >
                        -0.5°
                      </button>
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        step="0.5"
                        value={rollOffset}
                        onChange={(e) => setRollOffset(parseFloat(e.target.value))}
                        className="flex-1 accent-sky-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setRollOffset((v) => Math.round((v + 0.5) * 10) / 10)}
                        className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded text-[10px] font-mono hover:bg-zinc-700"
                      >
                        +0.5°
                      </button>
                    </div>
                  </div>

                  {/* Axis Inversions */}
                  <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-zinc-300">
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
                </div>

                {/* Column 2: Mounting Twist & Deadband */}
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2.5">
                  <div className="text-[11px] font-bold text-zinc-200 flex items-center justify-between">
                    <span>Geometri Dudukan Sensor</span>
                    <span className="text-[10px] font-mono text-sky-400">Depan (+Z) ~70cm</span>
                  </div>

                  {/* Clamp Twist Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Kompensasi Pelintir Dudukan:</span>
                      <span className="text-sky-300 font-bold">{clampTwist > 0 ? `+${clampTwist}°` : `${clampTwist}°`}</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      value={clampTwist}
                      onChange={(e) => setClampTwist(parseInt(e.target.value, 10))}
                      className="w-full accent-sky-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                    />
                    <div className="text-[9px] text-zinc-500 font-mono">
                      Sesuaikan jika modul MPU6050/breadboard sedikit miring/terpelintir pada batang tongkat.
                    </div>
                  </div>

                  {/* Noise Deadband */}
                  <div className="space-y-1 pt-1 border-t border-zinc-800/80">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Noise Deadband Tremor:</span>
                      <span className="text-emerald-400 font-bold">±{noiseDeadband.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="3.0"
                      step="0.2"
                      value={noiseDeadband}
                      onChange={(e) => setNoiseDeadband(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                    />
                    <div className="text-[9px] text-zinc-500 font-mono">
                      Meredam jitter gerakan tangan pengguna saat berjalan.
                    </div>
                  </div>

                  {/* Swap Axes Toggle */}
                  <div className="pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-300">
                    <label className="flex items-center gap-1.5 cursor-pointer text-sky-400">
                      <input
                        type="checkbox"
                        checked={swapAxes}
                        onChange={(e) => setSwapAxes(e.target.checked)}
                        className="rounded-xs accent-sky-500"
                      />
                      <span>Tukar Sumbu (Pitch ↔ Roll)</span>
                    </label>
                  </div>
                </div>

                {/* Column 3: Posture Envelope Limits & 3D Zones */}
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2.5">
                  <div className="text-[11px] font-bold text-zinc-200 flex items-center justify-between">
                    <span>Envelope Sudut &amp; Zona 3D</span>
                    <label className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showAngleZones}
                        onChange={(e) => setShowAngleZones(e.target.checked)}
                        className="rounded-xs accent-emerald-500"
                      />
                      <span>Tampilkan Zona 3D</span>
                    </label>
                  </div>

                  {/* Walking Stance Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Sudut Melangkah (Walking Stance):</span>
                      <span className="text-emerald-400 font-bold">{walkingStance.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="0.5"
                      value={walkingStance}
                      onChange={(e) => setWalkingStance(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Drop Caution Limit */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Batas Toleransi Turunan:</span>
                      <span className="text-amber-400 font-bold">{dropThreshold.toFixed(0)}°</span>
                    </div>
                    <input
                      type="range"
                      min="25"
                      max="55"
                      value={dropThreshold}
                      onChange={(e) => setDropThreshold(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Fall SOS Limit */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Batas Kemiringan Jatuh (SOS):</span>
                      <span className="text-rose-400 font-bold">{fallThreshold.toFixed(0)}°</span>
                    </div>
                    <input
                      type="range"
                      min="45"
                      max="75"
                      value={fallThreshold}
                      onChange={(e) => setFallThreshold(parseInt(e.target.value, 10))}
                      className="w-full accent-rose-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PROFILES & FIRMWARE EXPORT */}
            {activeTab === "profiles" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Profile Presets */}
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2 md:col-span-1">
                  <div className="text-[11px] font-bold text-zinc-200 mb-1 flex items-center justify-between">
                    <span>Preset Postur Pengguna</span>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="text-[10px] text-zinc-400 hover:text-rose-400 font-mono transition-colors"
                      title="Reset semua ke setelan pabrik"
                    >
                      Reset Pabrik
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {PRESET_PROFILES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyProfile(p)}
                        className={`w-full p-2 rounded-lg text-left text-xs font-mono border transition-all ${
                          currentProfileId === p.id
                            ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-300"
                            : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                        }`}
                      >
                        <div className="font-bold text-[11px] text-zinc-200">{p.name}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Jalan: {p.walkingStance}° | Jatuh: &gt;{p.fallThreshold}° | Twist: {p.clampTwist}°
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sandbox Slider / Manual Mode Toggle */}
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2 md:col-span-1">
                  <div className="text-[11px] font-bold text-zinc-200 flex items-center justify-between">
                    <span>Sandbox Pengujian 3D</span>
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
                    <div className="space-y-2 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span>Simulasi Sudut Pitch:</span>
                          <span className="text-zinc-100 font-bold">{manualPitch}°</span>
                        </div>
                        <input
                          type="range"
                          min="-90"
                          max="90"
                          value={manualPitch}
                          onChange={(e) => setManualPitch(parseInt(e.target.value, 10))}
                          className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span>Simulasi Sudut Roll:</span>
                          <span className="text-zinc-100 font-bold">{manualRoll}°</span>
                        </div>
                        <input
                          type="range"
                          min="-90"
                          max="90"
                          value={manualRoll}
                          onChange={(e) => setManualRoll(parseInt(e.target.value, 10))}
                          className="w-full accent-sky-500 h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-400 space-y-1.5 pt-1">
                      <p>Mode telemetri live aktif: Mengikuti bacaan sensor fisik MPU6050 secara real-time.</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Hardware: {mpuConnected ? "🟢 MPU6050 Terhubung di 0x68" : "🔴 Sensor Belum Terbaca"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Direct C++ Export Preview */}
                <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-2 md:col-span-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-zinc-200 mb-1 flex items-center justify-between">
                      <span>Ekspor Firmware C++</span>
                      <span className="text-[10px] font-mono text-zinc-500">KatanaImuCalibration.h</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Salin seluruh konstanta kalibrasi posisi dan postur ini langsung ke sketch Arduino Anda.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyConfig}
                    className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-mono text-xs rounded-md border border-zinc-700 flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? "Berhasil Disalin ke Clipboard!" : "Salin Kode C++ Config"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
