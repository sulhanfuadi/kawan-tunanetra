"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Usb,
  Unplug,
  Compass,
  Eye,
  TrendingDown,
  Droplets,
  Vibrate,
  Volume2,
  Sliders,
  Moon,
  Sun,
  Laptop,
  AlertTriangle,
  Trash2,
  X,
  Send,
  Terminal,
  Copy,
  Check,
  Activity,
  Cpu,
  Layers,
  ShieldAlert,
  Gauge,
  Upload,
  RefreshCw,
  Radio,
  HardDrive,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Zap,
  Download,
  Square,
  Circle,
  Play,
  FileSpreadsheet
} from "lucide-react";
import { parseHex } from "../utils/hexParser";
import { Stk500Flasher } from "../utils/stk500";

interface TelemetryData {
  frontConnected: boolean;
  frontCm: number | null;
  downConnected: boolean;
  downCm: number | null;
  mpuConnected: boolean;
  tiltDeg: number | null;
  waterConnected: boolean;
  waterVal: number | null;
  state: string;
  motor: string;
  buzzer: string;
}

export interface TelemetryRecord {
  no: number;
  timestamp: string;
  elapsedSec: number;
  frontCm: number | string;
  downCm: number | string;
  deltaDownCm: number | string;
  tiltDeg: number | string;
  waterVal: number | string;
  waterCondition: string;
  waterBinary: number;
  state: string;
  hazardCode: number;
  motor: string;
  motorBinary: number;
  buzzer: string;
  buzzerBinary: number;
  source: string;
}

const initialTelemetryState: TelemetryData = {
  frontConnected: false,
  frontCm: null,
  downConnected: false,
  downCm: null,
  mpuConnected: false,
  tiltDeg: null,
  waterConnected: false,
  waterVal: null,
  state: "STANDBY",
  motor: "OFF",
  buzzer: "DIAM"
};

const translations = {
  id: {
    appTitle: "Katana Dashboard",
    badge: "v1.2",
    subtitle: "Alat Bantu Navigasi Kruk Pintar Tunanetra // Web Serial Engine",
    connectedStatus: "ONLINE // 115200 BAUD",
    disconnectedStatus: "OFFLINE // STANDBY",
    demoStatus: "SIMULASI // AKTIF",
    connectBtn: "Hubungkan Arduino",
    disconnectBtn: "Putuskan USB",
    demoOn: "Demo: AKTIF",
    demoOff: "Demo: MATI",
    demoTag: "MODE SIMULASI",
    haptic: "HAPTIC",
    buzzer: "BUZZER",
    vibrating: "BERGETAR",
    idle: "IDLE (OFF)",
    sosAlarm: "ALARM SOS",
    silent: "DIAM (OFF)",
    
    // Sensors
    frontObstacle: "Rintangan Depan",
    frontSub: "Pin D2/D3",
    frontSensorType: "Ultrasonik HC-SR04 Lurus",
    downDrop: "Turunan / Lubang",
    downSub: "Pin D8/D9",
    downSensorType: "Ultrasonik HC-SR04 Miring",
    caneTilt: "Kemiringan Tongkat",
    caneSub: "Pin A4/A5 I2C",
    imuSensorType: "Akselerometer 6-DOF MPU6050",
    waterSensor: "Deteksi Air / Genangan",
    waterSub: "Pin A0 Analog",
    waterSensorType: "Pelat Konduktif FR-4",
    
    online: "ONLINE",
    offline: "LEPAS",
    
    // Status descriptions
    frontHazard: "BAHAYA: Rintangan Sangat Dekat",
    frontCaution: "WASPADA: Objek Mendekat",
    frontClear: "AMAN: Jalur Depan Bersih",
    downHazard: "BAHAYA: Tepi Turunan Terbuka",
    downClear: "NORMAL: Lantai Rata Terdeteksi",
    tiltHazard: "BAHAYA: Tongkat Terjatuh (SOS)",
    tiltReady: "SIAP: Tongkat Tegak Stabil",
    waterHazard: "PERINGATAN: Genangan Air Basah",
    waterClear: "KERING: Permukaan Kering Aman",
    sensorDisconnected: "Sensor Belum Terhubung",
    
    // CAD & Pin
    cadTitle: "Visualisasi Orientasi Tongkat (2D CAD)",
    cadDesc: "Rangka kruk siku berputar secara fisik mengikuti sudut MPU6050 terhadap lantai datar",
    cadAngle: "SUDUT:",
    floorRef: "LANTAI RUJUKAN (0 CM)",
    horizonPlanar: "HORIZON PLANAR",
    fallWarning: "[PERINGATAN] TONGKAT TERJATUH // ALARM SOS AKTIF",
    
    wiringTitle: "Integritas Pin Modul Hardware",
    pinFrontLabel: "Sensor Depan",
    pinDownLabel: "Sensor Bawah",
    pinImuLabel: "Sensor IMU",
    pinWaterLabel: "Sensor Air",
    pinMotorLabel: "Motor Getar",
    pinBuzzerLabel: "Buzzer SOS",
    connectedTag: "TERHUBUNG",
    disconnectedTag: "LEPAS",
    readyTag: "SIAP",
    
    // Terminal
    terminalTitle: "Terminal Telemetri Serial",
    copyLogs: "Salin",
    copied: "Tersalin",
    clear: "Bersihkan",
    send: "Kirim",
    inputPlaceholder: "Ketik perintah serial (HELP, FALL, DROP, FRONT 15, DEMO OFF)...",
    shortcuts: "Pintasan:",
    fallPreset: "JATUH (SOS)",
    dropPreset: "TURUNAN",
    wetPreset: "AIR BASAH",
    nearPreset: "OBJEK DEKAT",
    normalPreset: "NORMAL",
    closeDemo: "TUTUP DEMO",

    // Data Logger / CSV
    dataLoggerTitle: "Perekam Telemetri & Ekspor CSV",
    recActive: "MEREKAM",
    recIdle: "STANDBY",
    startRec: "Mulai Rekam",
    stopRec: "Hentikan",
    downloadCsv: "Unduh CSV",
    clearRec: "Reset",
    recordedCount: "data tersimpan",
    recDuration: "Durasi:",
    restoreBackup: "Pulihkan Cadangan",
    backupFound: "Cadangan data sesi sebelumnya terdeteksi",
    copyTsv: "Salin TSV (Excel)",
    copiedTsv: "Tersalin!",
    downloadJson: "Unduh JSON",
    sessionSummary: "Ringkasan Metrik Sesi:",
    avgDistance: "Rata-rata Depan",
    maxTilt: "Kemiringan Maks",
    hazardEvents: "Pemicu Bahaya",
    
    // Simulation Panel
    simTitle: "Panel Simulasi Hardware (Wokwi Style)",
    simOnline: "[ONLINE] Perintah diteruskan ke Arduino fisik",
    simOffline: "[OFFLINE] Mode UI interaktif",
    instantScenarios: "Skenario Bahaya:",
    precisionSliders: "Pengaturan Nilai Presisi:",
    frontDistLabel: "Jarak Depan:",
    downDeltaLabel: "Turunan Bawah (+Delta):",
    tiltLabel: "Kemiringan MPU:",
    waterLabel: "Sensor Air (A0):",
    wetState: "(Basah)",
    dryState: "(Kering)",
    
    // Bracket labels
    bracketOffline: "[LEPAS]",
    bracketSafe: "[AMAN]",
    bracketCaution: "[WASPADA]",
    bracketHazard: "[BAHAYA]",
    bracketNormal: "[NORMAL]",
    bracketUpright: "[TEGAK]",
    bracketFallen: "[JATUH]",
    bracketDry: "[KERING]",
    bracketWet: "[BASAH]",

    // Meter scale labels
    meterBaseline: "Baseline (30cm)",
    meterDropLimit: "Batas >15cm",
    meterTiltUpright: "0° Tegak",
    meterTiltLimit: "Batas >60° (SOS)",
    meterTiltFlat: "90° Datar",
    meterWaterDry: "0 Kering",
    meterWaterLimit: "Batas >650",
    meterWaterWet: "1023 Basah",
    unitDegrees: "derajat",
    unitDelta: "cm delta",

    darkTheme: "Gelap",
    lightTheme: "Terang",
    autoTheme: "Auto",

    // Tabs & Flasher
    tabMonitoring: "Monitoring Sensor & CAD",
    tabSerialConsole: "Serial Terminal & Flasher",
    flasherTitle: "Arduino Nano Web Firmware Flasher (STK500v1)",
    flasherDesc: "Upload file biner .hex langsung dari browser tanpa perlu membuka Arduino IDE",
    selectHexBtn: "Pilih File Firmware (.hex)",
    startUploadBtn: "Mulai Flash Firmware",
    flashingStatus: "Sedang Mengunggah Firmware...",
    bootloaderType: "Tipe Bootloader Nano:",
    bootloaderNew: "New Bootloader (115200 Baud)",
    bootloaderOld: "Old Bootloader (57600 Baud)",
    rawStreamLog: "Raw Stream & System Activities",
    filterLogs: "Filter Log:",
    filterAll: "Semua",
    filterStream: "Stream Sensor",
    filterSystem: "Sistem & Flasher",
    filterSend: "Perintah Kirim",
    hexFileReady: "File HEX Terpilih:",
    reconnectPrompt: "Tersambung kembali ke telemetri setelah flashing selesai."
  },
  en: {
    appTitle: "Katana Dashboard",
    badge: "v1.2",
    subtitle: "Smart Navigation Forearm Crutch Assistant // Web Serial Engine",
    connectedStatus: "ONLINE // 115200 BAUD",
    disconnectedStatus: "OFFLINE // STANDBY",
    demoStatus: "SIMULATION // ACTIVE",
    connectBtn: "Connect Arduino",
    disconnectBtn: "Disconnect USB",
    demoOn: "Demo: ON",
    demoOff: "Demo: OFF",
    demoTag: "SIMULATION MODE",
    haptic: "HAPTIC",
    buzzer: "BUZZER",
    vibrating: "VIBRATING",
    idle: "IDLE (OFF)",
    sosAlarm: "SOS ALARM",
    silent: "SILENT (OFF)",
    
    // Sensors
    frontObstacle: "Front Obstacle",
    frontSub: "Pin D2/D3",
    frontSensorType: "Forward Ultrasonic HC-SR04",
    downDrop: "Drop-off / Pothole",
    downSub: "Pin D8/D9",
    downSensorType: "Angled Ultrasonic HC-SR04",
    caneTilt: "Cane Orientation",
    caneSub: "Pin A4/A5 I2C",
    imuSensorType: "6-DOF Accelerometer MPU6050",
    waterSensor: "Water / Puddle",
    waterSub: "Pin A0 Analog",
    waterSensorType: "Conductive FR-4 Plate",
    
    online: "ONLINE",
    offline: "OFFLINE",
    
    // Status descriptions
    frontHazard: "HAZARD: Obstacle Very Close",
    frontCaution: "CAUTION: Approaching Object",
    frontClear: "SAFE: Clear Walking Path",
    downHazard: "HAZARD: Drop-off Edge Detected",
    downClear: "NORMAL: Level Ground Detected",
    tiltHazard: "HAZARD: Cane Fallen (SOS)",
    tiltReady: "READY: Cane Upright & Stable",
    waterHazard: "WARNING: Water Puddle Detected",
    waterClear: "DRY: Dry Walking Surface",
    sensorDisconnected: "Sensor Disconnected",
    
    // CAD & Pin
    cadTitle: "Cane Orientation Visualizer (2D CAD)",
    cadDesc: "Forearm crutch rotates physically tracking MPU6050 orientation relative to ground plane",
    cadAngle: "ANGLE:",
    floorRef: "GROUND REFERENCE (0 CM)",
    horizonPlanar: "PLANAR HORIZON",
    fallWarning: "[WARNING] CANE FALL DETECTED // SOS ALARM ACTIVE",
    
    wiringTitle: "Hardware Module Pin Diagnostics",
    pinFrontLabel: "Front Sensor",
    pinDownLabel: "Bottom Sensor",
    pinImuLabel: "IMU Sensor",
    pinWaterLabel: "Water Sensor",
    pinMotorLabel: "Haptic Motor",
    pinBuzzerLabel: "SOS Buzzer",
    connectedTag: "CONNECTED",
    disconnectedTag: "DISCONNECTED",
    readyTag: "READY",
    
    // Terminal
    terminalTitle: "Serial Telemetry Terminal",
    copyLogs: "Copy",
    copied: "Copied",
    clear: "Clear",
    send: "Send",
    inputPlaceholder: "Enter serial command (HELP, FALL, DROP, FRONT 15, DEMO OFF)...",
    shortcuts: "Shortcuts:",
    fallPreset: "FALL (SOS)",
    dropPreset: "DROP-OFF",
    wetPreset: "WET PUDDLE",
    nearPreset: "NEAR OBSTACLE",
    normalPreset: "NORMAL",
    closeDemo: "CLOSE DEMO",

    // Data Logger / CSV
    dataLoggerTitle: "Telemetry Logger & CSV Export",
    recActive: "RECORDING",
    recIdle: "STANDBY",
    startRec: "Start Record",
    stopRec: "Stop",
    downloadCsv: "Download CSV",
    clearRec: "Reset",
    recordedCount: "records saved",
    recDuration: "Duration:",
    restoreBackup: "Restore Backup",
    backupFound: "Previous session backup detected",
    copyTsv: "Copy TSV (Excel)",
    copiedTsv: "Copied!",
    downloadJson: "Download JSON",
    sessionSummary: "Session Metrics Summary:",
    avgDistance: "Avg Front",
    maxTilt: "Max Tilt",
    hazardEvents: "Hazard Triggers",
    
    // Simulation Panel
    simTitle: "Hardware Simulation Panel (Wokwi Style)",
    simOnline: "[ONLINE] Commands dispatched to physical Arduino",
    simOffline: "[OFFLINE] Interactive UI mode",
    instantScenarios: "Hazard Scenarios:",
    precisionSliders: "Precision Parameter Sliders:",
    frontDistLabel: "Front Distance:",
    downDeltaLabel: "Floor Drop (+Delta):",
    tiltLabel: "Cane Tilt (MPU):",
    waterLabel: "Water Sensor (A0):",
    wetState: "(Wet)",
    dryState: "(Dry)",
    
    // Bracket labels
    bracketOffline: "[OFFLINE]",
    bracketSafe: "[SAFE]",
    bracketCaution: "[CAUTION]",
    bracketHazard: "[HAZARD]",
    bracketNormal: "[NORMAL]",
    bracketUpright: "[UPRIGHT]",
    bracketFallen: "[FALLEN]",
    bracketDry: "[DRY]",
    bracketWet: "[WET]",

    // Meter scale labels
    meterBaseline: "Baseline (30cm)",
    meterDropLimit: "Limit >15cm",
    meterTiltUpright: "0° Upright",
    meterTiltLimit: "Limit >60° (SOS)",
    meterTiltFlat: "90° Flat",
    meterWaterDry: "0 Dry",
    meterWaterLimit: "Limit >650",
    meterWaterWet: "1023 Wet",
    unitDegrees: "degrees",
    unitDelta: "cm delta",

    darkTheme: "Dark",
    lightTheme: "Light",
    autoTheme: "Auto",

    // Tabs & Flasher
    tabMonitoring: "Sensor & CAD Monitoring",
    tabSerialConsole: "Serial Terminal & Flasher",
    flasherTitle: "Arduino Nano Web Firmware Flasher (STK500v1)",
    flasherDesc: "Flash .hex binary files directly from your browser without opening Arduino IDE",
    selectHexBtn: "Select Firmware File (.hex)",
    startUploadBtn: "Flash Firmware",
    flashingStatus: "Uploading Firmware...",
    bootloaderType: "Nano Bootloader Target:",
    bootloaderNew: "New Bootloader (115200 Baud)",
    bootloaderOld: "Old Bootloader (57600 Baud)",
    rawStreamLog: "Raw Stream & System Activities",
    filterLogs: "Filter Logs:",
    filterAll: "All",
    filterStream: "Sensor Stream",
    filterSystem: "System & Flasher",
    filterSend: "Outbound Commands",
    hexFileReady: "Selected HEX File:",
    reconnectPrompt: "Telemetry stream resumes automatically once flashing finishes."
  }
};

export default function KatanaDashboard() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("light");
  const [lang, setLang] = useState<"id" | "en">("id");

  // Read saved preferences on client mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem("katana_theme") as any;
      if (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system") {
        setTheme(savedTheme);
      } else {
        setTheme("light");
      }

      const savedLang = localStorage.getItem("katana_lang") as any;
      if (savedLang === "id" || savedLang === "en") {
        setLang(savedLang);
      }
    } catch (e) {}
  }, []);

  const t = translations[lang];

  const handleSetLang = (newLang: "id" | "en") => {
    setLang(newLang);
    try {
      localStorage.setItem("katana_lang", newLang);
    } catch (e) {}
  };

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [portInfo, setPortInfo] = useState<string>("Belum Tersambung");

  // Telemetry data (starts fully disconnected)
  const [data, setData] = useState<TelemetryData>(initialTelemetryState);

  // Demo mode
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoFront, setDemoFront] = useState(85);
  const [demoDown, setDemoDown] = useState(0);
  const [demoTilt, setDemoTilt] = useState(12);
  const [demoWater, setDemoWater] = useState(210);

  // Command input & terminal state
  const [customCommand, setCustomCommand] = useState("");
  const [copiedLog, setCopiedLog] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[SISTEM] KATANA Telemetry Engine v1.2 Siap.",
    "[INFO] Hubungkan kabel serial USB Arduino Nano atau aktifkan Mode Demo untuk pemantauan."
  ]);
  const [autoscroll, setAutoscroll] = useState(true);

  // Data Logger & CSV Export state
  const [isRecording, setIsRecording] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordedDataRef = useRef<TelemetryRecord[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const [copiedTsv, setCopiedTsv] = useState(false);
  const isRecordingRef = useRef(false);
  const dataRef = useRef<TelemetryData>(initialTelemetryState);
  const [hasBackup, setHasBackup] = useState(false);
  const [backupCount, setBackupCount] = useState(0);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"monitor" | "serial_flash">("monitor");

  // Flasher state
  const [hexFile, setHexFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [rawHexBlob, setRawHexBlob] = useState<File | null>(null);
  const [availablePorts, setAvailablePorts] = useState<string[]>(["COM3", "COM4", "COM1", "COM6"]);
  const [selectedPort, setSelectedPort] = useState<string>("COM3");
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashStep, setFlashStep] = useState("");
  const [bootloaderBaud, setBootloaderBaud] = useState<115200 | 57600>(115200);
  const [logFilter, setLogFilter] = useState<"all" | "stream" | "system" | "send">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UX & Compatibility states
  const [isSerialSupported, setIsSerialSupported] = useState<boolean>(true);
  const [isRefreshingPorts, setIsRefreshingPorts] = useState<boolean>(false);
  const [isTestingMotor, setIsTestingMotor] = useState<boolean>(false);
  const [isTestingBuzzer, setIsTestingBuzzer] = useState<boolean>(false);

  // Serial references
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Theme synchronization effect
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const applyTheme = (currentTheme: "dark" | "light" | "system") => {
      let isDark = false;
      if (currentTheme === "system") {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      } else {
        isDark = currentTheme === "dark";
      }
      root.classList.toggle("dark", isDark);
    };

    applyTheme(theme);
    try {
      localStorage.setItem("katana_theme", theme);
    } catch (e) {}

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme, mounted]);

  // Log autoscroll
  useEffect(() => {
    if (autoscroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoscroll]);

  // Send serial command helper
  const sendSerial = async (command: string) => {
    if (writerRef.current) {
      try {
        const encoder = new TextEncoder();
        await writerRef.current.write(encoder.encode(command + "\n"));
        addLog(`[KIRIM] >> ${command}`);
      } catch (err: any) {
        console.error("Gagal mengirim perintah serial:", err);
        addLog(`[ERROR] Gagal kirim perintah: ${err.message}`);
      }
    }
  };

  // Monitor physical USB plug/unplug events
  useEffect(() => {
    if (typeof window === "undefined" || !("serial" in navigator)) return;

    const onDisconnect = () => {
      addLog("[PERINGATAN] Kabel USB Arduino dicabut dari komputer.");
      setIsConnected(false);
      setPortInfo("USB Terputus (Kabel Dicabut)");
      setData(initialTelemetryState);
      if (writerRef.current) {
        try { writerRef.current.releaseLock(); } catch (e) {}
        writerRef.current = null;
      }
      if (readerRef.current) {
        try { readerRef.current.releaseLock(); } catch (e) {}
        readerRef.current = null;
      }
      portRef.current = null;
    };

    const onConnect = () => {
      addLog("[INFO] Perangkat USB terdeteksi kembali. Klik 'Hubungkan Arduino' untuk menyambungkan.");
    };

    (navigator as any).serial.addEventListener("disconnect", onDisconnect);
    (navigator as any).serial.addEventListener("connect", onConnect);

    return () => {
      (navigator as any).serial.removeEventListener("disconnect", onDisconnect);
      (navigator as any).serial.removeEventListener("connect", onConnect);
    };
  }, []);

  // Serial connection handlers
  const handleConnect = async () => {
    if (!("serial" in navigator)) {
      alert("Browser ini belum mendukung Web Serial API. Gunakan Google Chrome, Brave, atau Edge.");
      return;
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      try {
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
      } catch (e) {}
      portRef.current = port;
      setIsConnected(true);
      setPortInfo("Terhubung // 115200 Baud");
      addLog("[SISTEM] Port serial USB berhasil tersambung pada 115200 baud.");
      addLog("[INFO] Membuka jalur data (RX/TX stream)... Tunggu sinyal dari Arduino.");

      const writer = port.writable.getWriter();
      writerRef.current = writer;

      const reader = port.readable.getReader();
      readerRef.current = reader;

      readLoop(reader);
    } catch (err: any) {
      if (err.name === "NotFoundError" || (err.message && err.message.includes("No port selected"))) {
        // Pembatalan wajar oleh pengguna (menekan tombol Cancel pada dialog pemilih port browser)
        addLog("[INFO] Pemilihan port serial USB dibatalkan oleh pengguna.");
      } else if (
        err.message &&
        (err.message.includes("busy") ||
          err.message.includes("denied") ||
          err.message.includes("Failed to open") ||
          err.message.includes("already open"))
      ) {
        console.warn("Port USB sibuk atau sedang digunakan:", err);
        alert(
          "Port USB sedang sibuk atau dipakai aplikasi lain!\n\nPastikan Serial Monitor di Arduino IDE sudah DITUTUP sebelum mengklik 'Hubungkan Arduino' di website."
        );
        addLog("[ERROR] Port serial sedang dipakai aplikasi lain (tutup Serial Monitor di Arduino IDE).");
      } else {
        console.error("Kesalahan koneksi serial:", err);
        addLog(`[INFO] Sambungan tidak dapat dibuka: ${err.message}`);
      }
      setIsConnected(false);
      setData(initialTelemetryState);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (writerRef.current) {
        try {
          await writerRef.current.close();
        } catch (e) {
          try { writerRef.current.releaseLock(); } catch (e2) {}
        }
        writerRef.current = null;
      }
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
        } catch (e) {
          try { readerRef.current.releaseLock(); } catch (e2) {}
        }
        readerRef.current = null;
      }
      if (portRef.current) {
        try {
          await portRef.current.close();
        } catch (e) {
          console.error("Error closing port:", e);
        }
        portRef.current = null;
      }
      setIsConnected(false);
      setPortInfo("Belum Tersambung");
      setData(initialTelemetryState);
      addLog("[SISTEM] Sambungan USB diputuskan secara bersih.");
    } catch (err: any) {
      console.error(err);
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-150), msg]);
  };

  // Data Logger synchronization effects & methods
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getHazardCode = (st: string) => {
    switch (st.toUpperCase()) {
      case "TONGKAT_JATUH": return 6;
      case "TEPI_TURUNAN": return 5;
      case "PERMUKAAN_BASAH": return 4;
      case "OBJEK_DEKAT": return 3;
      case "OBJEK_SEDANG": return 2;
      case "OBJEK_WASPADA": return 1;
      case "NORMAL": return 0;
      default: return 0;
    }
  };

  const recordDataPoint = (dataPoint: {
    frontCm: number | string;
    downCm: number | string;
    tiltDeg: number | string;
    waterVal: number | string;
    state: string;
    motor: string;
    buzzer: string;
    source: string;
  }) => {
    if (!isRecordingRef.current) return;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const pad3 = (n: number) => n.toString().padStart(3, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad3(now.getMilliseconds())}`;

    const startTime = recordingStartTimeRef.current || Date.now();
    const elapsedSec = Math.max(0, (Date.now() - startTime) / 1000);

    const downNum = typeof dataPoint.downCm === "number" ? dataPoint.downCm : (dataPoint.downCm !== "" ? parseFloat(dataPoint.downCm as string) : null);
    const deltaDownCm = downNum !== null ? Math.max(0, Math.round(downNum - 30)) : "";

    const waterNum = typeof dataPoint.waterVal === "number" ? dataPoint.waterVal : (dataPoint.waterVal !== "" ? parseInt(dataPoint.waterVal as string, 10) : null);
    const waterCondition = waterNum !== null ? (waterNum > 650 ? "BASAH" : "KERING") : "TIDAK_DIKETAHUI";
    const waterBinary = waterNum !== null ? (waterNum > 650 ? 1 : 0) : 0;

    const st = dataPoint.state || "NORMAL";
    const hazardCode = getHazardCode(st);

    const mot = (dataPoint.motor || "OFF").toUpperCase();
    const motorBinary = mot === "ON" ? 1 : 0;

    const buz = (dataPoint.buzzer || "DIAM").toUpperCase();
    const buzzerBinary = buz === "SOS" ? 1 : 0;

    const record: TelemetryRecord = {
      no: recordedDataRef.current.length + 1,
      timestamp,
      elapsedSec: parseFloat(elapsedSec.toFixed(3)),
      frontCm: dataPoint.frontCm !== null ? dataPoint.frontCm : "",
      downCm: dataPoint.downCm !== null ? dataPoint.downCm : "",
      deltaDownCm,
      tiltDeg: dataPoint.tiltDeg !== null ? dataPoint.tiltDeg : "",
      waterVal: dataPoint.waterVal !== null ? dataPoint.waterVal : "",
      waterCondition,
      waterBinary,
      state: st,
      hazardCode,
      motor: mot,
      motorBinary,
      buzzer: buz,
      buzzerBinary,
      source: dataPoint.source
    };

    recordedDataRef.current.push(record);
    setRecordCount(recordedDataRef.current.length);
  };

  const startRecording = () => {
    recordingStartTimeRef.current = Date.now();
    setIsRecording(true);
    isRecordingRef.current = true;
    setRecordDuration(0);
    addLog("[DATA-LOGGER] Perekaman telemetri dimulai...");
  };

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    try {
      if (recordedDataRef.current.length > 0) {
        localStorage.setItem(
          "katana_telemetry_backup",
          JSON.stringify(recordedDataRef.current.slice(-5000))
        );
      }
    } catch (e) {}
    addLog(`[DATA-LOGGER] Perekaman dihentikan. Total ${recordedDataRef.current.length} baris data telemetri tersimpan.`);
  };

  const clearRecords = () => {
    recordedDataRef.current = [];
    recordingStartTimeRef.current = null;
    setRecordCount(0);
    setRecordDuration(0);
    setHasBackup(false);
    setBackupCount(0);
    try {
      localStorage.removeItem("katana_telemetry_backup");
    } catch (e) {}
    addLog("[DATA-LOGGER] Buffer data rekaman dikosongkan.");
  };

  const restoreBackup = () => {
    try {
      const raw = localStorage.getItem("katana_telemetry_backup");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          recordedDataRef.current = parsed;
          setRecordCount(parsed.length);
          setHasBackup(false);
          addLog(`[DATA-LOGGER] Berhasil memulihkan ${parsed.length} baris data telemetri dari cadangan browser.`);
        }
      }
    } catch (e) {
      console.error("Gagal memulihkan cadangan:", e);
    }
  };

  // Protection against accidental page close/refresh when recording or having unsaved data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording || recordCount > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRecording, recordCount]);

  // Check existing local storage backup on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("katana_telemetry_backup");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHasBackup(true);
          setBackupCount(parsed.length);
        }
      }
    } catch (e) {}
  }, []);

  // Summary statistics for session
  const getSessionMetrics = () => {
    const list = recordedDataRef.current;
    if (list.length === 0) return null;

    const frontVals = list
      .map((r) => (typeof r.frontCm === "number" ? r.frontCm : parseFloat(r.frontCm as string)))
      .filter((v) => !isNaN(v) && v > 0);
    const avgFront = frontVals.length > 0 ? (frontVals.reduce((a, b) => a + b, 0) / frontVals.length).toFixed(1) : "-";

    const tiltVals = list
      .map((r) => (typeof r.tiltDeg === "number" ? r.tiltDeg : parseFloat(r.tiltDeg as string)))
      .filter((v) => !isNaN(v));
    const maxTilt = tiltVals.length > 0 ? Math.max(...tiltVals).toFixed(1) : "-";

    const hazardTriggers = list.filter((r) => r.hazardCode > 0).length;

    return {
      total: list.length,
      avgFront,
      maxTilt,
      hazardTriggers
    };
  };

  const downloadCsv = () => {
    if (recordedDataRef.current.length === 0) {
      alert("Belum ada data rekaman untuk diunduh. Klik 'Mulai Rekam' terlebih dahulu.");
      return;
    }

    const headers = [
      "No",
      "Timestamp",
      "Detik_Relatif",
      "Jarak_Depan_cm",
      "Jarak_Bawah_cm",
      "Delta_Turunan_cm",
      "Kemiringan_MPU_deg",
      "Sensor_Air_ADC",
      "Kondisi_Air",
      "Status_Bahaya",
      "Kode_Bahaya_Num",
      "Motor_Haptik",
      "Motor_Biner",
      "Buzzer_SOS",
      "Buzzer_Biner",
      "Sumber_Data"
    ];

    const csvRows = [headers.join(",")];

    for (const row of recordedDataRef.current) {
      const values = [
        row.no,
        `"${row.timestamp}"`,
        row.elapsedSec.toFixed(3),
        row.frontCm !== "" ? row.frontCm : "",
        row.downCm !== "" ? row.downCm : "",
        row.deltaDownCm !== "" ? row.deltaDownCm : "",
        row.tiltDeg !== "" ? row.tiltDeg : "",
        row.waterVal !== "" ? row.waterVal : "",
        `"${row.waterCondition}"`,
        `"${row.state}"`,
        row.hazardCode,
        `"${row.motor}"`,
        row.motorBinary,
        `"${row.buzzer}"`,
        row.buzzerBinary,
        `"${row.source}"`
      ];
      csvRows.push(values.join(","));
    }

    const csvString = csvRows.join("\r\n");
    // UTF-8 BOM (\uFEFF) ensures Microsoft Excel (Windows & Mac) reads character sets and delimiters cleanly
    const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const filename = `katana_telemetry_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addLog(`[SISTEM] File dataset ${filename} (${recordedDataRef.current.length} baris) berhasil diunduh.`);
  };

  const copyTsv = () => {
    if (recordedDataRef.current.length === 0) return;

    const headers = [
      "No",
      "Timestamp",
      "Detik_Relatif",
      "Jarak_Depan_cm",
      "Jarak_Bawah_cm",
      "Delta_Turunan_cm",
      "Kemiringan_MPU_deg",
      "Sensor_Air_ADC",
      "Kondisi_Air",
      "Status_Bahaya",
      "Kode_Bahaya_Num",
      "Motor_Haptik",
      "Motor_Biner",
      "Buzzer_SOS",
      "Buzzer_Biner",
      "Sumber_Data"
    ];

    const tsvRows = [headers.join("\t")];

    for (const row of recordedDataRef.current) {
      const values = [
        row.no,
        row.timestamp,
        row.elapsedSec.toFixed(3),
        row.frontCm !== "" ? row.frontCm : "",
        row.downCm !== "" ? row.downCm : "",
        row.deltaDownCm !== "" ? row.deltaDownCm : "",
        row.tiltDeg !== "" ? row.tiltDeg : "",
        row.waterVal !== "" ? row.waterVal : "",
        row.waterCondition,
        row.state,
        row.hazardCode,
        row.motor,
        row.motorBinary,
        row.buzzer,
        row.buzzerBinary,
        row.source
      ];
      tsvRows.push(values.join("\t"));
    }

    const tsvString = tsvRows.join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(tsvString);
      setCopiedTsv(true);
      setTimeout(() => setCopiedTsv(false), 2000);
      addLog(`[SISTEM] ${recordedDataRef.current.length} baris data disalin ke clipboard dalam format TSV (siap paste langsung ke Excel).`);
    }
  };

  const downloadJson = () => {
    if (recordedDataRef.current.length === 0) return;

    const jsonString = JSON.stringify(recordedDataRef.current, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const filename = `katana_telemetry_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addLog(`[SISTEM] File JSON dataset ${filename} berhasil diunduh.`);
  };

  // Periodic recording during Demo Mode when disconnected
  useEffect(() => {
    if (!isDemoMode || isConnected || !isRecording) return;
    const interval = setInterval(() => {
      recordDataPoint({
        frontCm: data.frontCm !== null ? data.frontCm : "",
        downCm: data.downCm !== null ? data.downCm : "",
        tiltDeg: data.tiltDeg !== null ? data.tiltDeg : "",
        waterVal: data.waterVal !== null ? data.waterVal : "",
        state: data.state,
        motor: data.motor,
        buzzer: data.buzzer,
        source: "DEMO_UI"
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isDemoMode, isConnected, isRecording, data]);

  // Pindai ulang port serial USB yang tersedia
  const refreshPorts = async () => {
    setIsRefreshingPorts(true);
    try {
      const res = await fetch("/api/ports");
      const data = await res.json();
      if (data.ports && data.ports.length > 0) {
        setAvailablePorts(data.ports);
        if (!data.ports.includes(selectedPort)) {
          setSelectedPort(data.ports[0]);
        }
        addLog(`[SISTEM] Port COM terdeteksi: ${data.ports.join(", ")}`);
      } else {
        addLog("[INFO] Tidak ada port COM aktif terdeteksi saat pemindaian.");
      }
    } catch (e: any) {
      console.error(e);
      addLog("[ERROR] Gagal memindai port COM.");
    } finally {
      setTimeout(() => setIsRefreshingPorts(false), 300);
    }
  };

  // Cek dukungan browser dan fetch port saat mount
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsSerialSupported("serial" in navigator);
    }
    refreshPorts();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".hex")) {
      alert("Pilih file biner berformat .hex (misal: katana.ino.hex dari Arduino IDE)");
      return;
    }

    setRawHexBlob(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const hexText = event.target?.result as string;
        const parsed = parseHex(hexText);
        setHexFile({
          name: file.name,
          bytes: parsed.data
        });
        addLog(`[HEX] Berhasil memuat ${file.name} (${parsed.totalBytes} bytes). Siap diflash ke Arduino.`);
      } catch (err: any) {
        alert("Gagal mem-parsing file HEX: " + err.message);
        addLog(`[ERROR] Parsing HEX gagal: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleFlashFirmware = async () => {
    if (!rawHexBlob && !hexFile) {
      alert("Pilih file firmware .hex terlebih dahulu.");
      return;
    }

    // Jika sedang streaming serial biasa, putuskan dulu secara bersih agar COM port tidak terkunci
    if (isConnected) {
      addLog("[FLASH] Menutup koneksi serial telemetri sebelum flashing...");
      await handleDisconnect();
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsFlashing(true);
    setFlashProgress(20);
    setFlashStep("Memanggil engine AVRDUDE resmi Arduino IDE...");
    addLog(`[AVRDUDE] Memulai upload firmware ke ${selectedPort} pada ${bootloaderBaud} baud...`);

    try {
      if (rawHexBlob) {
        // 1. Eksekusi melalui Engine AVRDUDE Native (Identik dengan tombol Upload di Arduino IDE)
        const formData = new FormData();
        formData.append("file", rawHexBlob);
        formData.append("port", selectedPort);
        formData.append("baud", bootloaderBaud.toString());

        setFlashProgress(50);
        setFlashStep("Flashing firmware via AVRDUDE...");

        const res = await fetch("/api/flash", {
          method: "POST",
          body: formData
        });

        const result = await res.json();

        if (result.output) {
          // Cetak log output dari avrdude
          const lines = result.output.split(/\r?\n/);
          for (const l of lines) {
            if (l.trim().length > 0) addLog(`[AVRDUDE] ${l.trim()}`);
          }
        }

        if (!result.success) {
          throw new Error(result.error || "Gagal upload via AVRDUDE");
        }

        setFlashProgress(100);
        setFlashStep("Selesai 100%!");
        alert("Upload firmware berhasil via AVRDUDE! Arduino Nano siap digunakan.");
        addLog("[SISTEM] Firmware berhasil diflash 100%! Anda dapat menyambungkan kembali telemetri.");
      } else {
        // Fallback Web Serial jika raw file tidak ada
        let port = portRef.current;
        if (!port) {
          port = await (navigator as any).serial.requestPort();
        }
        const flasher = new Stk500Flasher(port);
        await flasher.flash(hexFile!.bytes, {
          baudRate: bootloaderBaud,
          onProgress: (p, s) => {
            setFlashProgress(p);
            setFlashStep(s);
          },
          onLog: (m) => addLog(m)
        });
        alert("Upload firmware berhasil!");
      }
    } catch (err: any) {
      console.error("Flashing error:", err);
      alert("Flashing gagal: " + err.message);
      addLog(`[ERROR] Flashing gagal: ${err.message}`);
    } finally {
      setIsFlashing(false);
      setFlashProgress(0);
      setFlashStep("");
    }
  };

  const handleCopyLogs = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(logs.join("\n"));
      setCopiedLog(true);
      setTimeout(() => setCopiedLog(false), 2000);
    }
  };

  const readLoop = async (reader: any) => {
    let localBuffer = "";
    const textDecoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const str = typeof value === "string" ? value : textDecoder.decode(value, { stream: true });
          localBuffer += str;
          const lines = localBuffer.split(/\r?\n/);
          localBuffer = lines.pop() || "";
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (line.length > 0) {
              parseLine(line);
              addLog(line);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Read loop selesai:", err);
      addLog(`[STREAM ERROR] Jalur data terputus: ${err.message}`);
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {}
    }
  };

  const parseLine = (line: string) => {
    // 1. Format Telemetri Stream Reguler ([KONEKSI], [SIMULASI], atau [STREAM])
    if (line.includes("[KONEKSI]") || line.includes("[SIMULASI]") || line.includes("[STREAM]")) {
      const isSim = line.includes("[SIMULASI]");

      let parsedFrontCm: number | null | undefined = undefined;
      let parsedFrontConn: boolean | undefined = undefined;
      let parsedDownCm: number | null | undefined = undefined;
      let parsedDownConn: boolean | undefined = undefined;
      let parsedTiltDeg: number | null | undefined = undefined;
      let parsedMpuConn: boolean | undefined = undefined;
      let parsedWaterVal: number | null | undefined = undefined;
      let parsedWaterConn: boolean | undefined = undefined;
      let parsedState: string | undefined = undefined;
      let parsedMotor: string | undefined = undefined;
      let parsedBuzzer: string | undefined = undefined;

      // Parsing Sensor Depan (dukung format: Depan:RIIL(25cm), Depan:SIM(25cm), Depan: 25.4cm)
      const front = line.match(/Depan:(?:RIIL|SIM|\s*)\(?([0-9.]+)\s*cm\)?/i);
      if (front) {
        parsedFrontConn = true;
        parsedFrontCm = Math.round(parseFloat(front[1]));
      } else if (line.includes("Depan:LEPAS") || line.includes("Depan: LEPAS")) {
        parsedFrontConn = false;
        parsedFrontCm = null;
      }

      // Parsing Sensor Bawah (dukung format: Bawah:RIIL(30cm), Bawah:SIM(30cm), Bawah: 30.1cm)
      const down = line.match(/Bawah:(?:RIIL|SIM|\s*)\(?([0-9.]+)\s*cm\)?/i);
      if (down) {
        parsedDownConn = true;
        parsedDownCm = Math.round(parseFloat(down[1]));
      } else if (line.includes("Bawah:LEPAS") || line.includes("Bawah: LEPAS")) {
        parsedDownConn = false;
        parsedDownCm = null;
      }

      // Parsing Sensor IMU MPU6050 (dukung format: IMU:RIIL(12.5°), IMU:SIM(12.5°), Kemiringan: 12.5°)
      const imu = line.match(/(?:IMU:(?:RIIL|SIM)\(|(?:Kemiringan|Sudut)[:\s=]+)([0-9.]+)°?\)?/i);
      if (imu) {
        parsedMpuConn = true;
        parsedTiltDeg = parseFloat(imu[1]);
      } else if (line.includes("IMU:LEPAS") || line.includes("IMU: LEPAS")) {
        parsedMpuConn = false;
        parsedTiltDeg = null;
      }

      // Parsing Sensor Air (dukung format: Air:RIIL(245), Air:SIM(245), Air: 245 ADC)
      const water = line.match(/Air:(?:RIIL|SIM|\s*)\(?(\d+)(?:\s*ADC|\))/i);
      if (water) {
        parsedWaterConn = true;
        parsedWaterVal = parseInt(water[1], 10);
      } else if (line.includes("Air:LEPAS") || line.includes("Air: LEPAS") || line.includes("Air: TERPUTUS")) {
        parsedWaterConn = false;
        parsedWaterVal = null;
      }

      // State sistem & status aktuator (jika ada pada baris)
      const st = line.match(/STATE:\s*([^|]+)/);
      if (st) parsedState = st[1].trim();

      const motor = line.match(/Motor:\s*(ON|OFF)/i);
      if (motor) parsedMotor = motor[1].toUpperCase();

      const buz = line.match(/Buzzer:\s*(SOS|DIAM)/i);
      if (buz) parsedBuzzer = buz[1].toUpperCase();

      setData((prev) => {
        const next: TelemetryData = { ...prev };
        if (parsedFrontConn !== undefined) next.frontConnected = parsedFrontConn;
        if (parsedFrontCm !== undefined) next.frontCm = parsedFrontCm;
        if (parsedDownConn !== undefined) next.downConnected = parsedDownConn;
        if (parsedDownCm !== undefined) next.downCm = parsedDownCm;
        if (parsedMpuConn !== undefined) next.mpuConnected = parsedMpuConn;
        if (parsedTiltDeg !== undefined) next.tiltDeg = parsedTiltDeg;
        if (parsedWaterConn !== undefined) next.waterConnected = parsedWaterConn;
        if (parsedWaterVal !== undefined) next.waterVal = parsedWaterVal;
        if (parsedState !== undefined) next.state = parsedState;
        if (parsedMotor !== undefined) next.motor = parsedMotor;
        if (parsedBuzzer !== undefined) next.buzzer = parsedBuzzer;
        return next;
      });

      if (isRecordingRef.current) {
        const cur = dataRef.current;
        recordDataPoint({
          frontCm: parsedFrontCm !== undefined ? (parsedFrontCm !== null ? parsedFrontCm : "") : (cur.frontCm !== null ? cur.frontCm : ""),
          downCm: parsedDownCm !== undefined ? (parsedDownCm !== null ? parsedDownCm : "") : (cur.downCm !== null ? cur.downCm : ""),
          tiltDeg: parsedTiltDeg !== undefined ? (parsedTiltDeg !== null ? parsedTiltDeg : "") : (cur.tiltDeg !== null ? cur.tiltDeg : ""),
          waterVal: parsedWaterVal !== undefined ? (parsedWaterVal !== null ? parsedWaterVal : "") : (cur.waterVal !== null ? cur.waterVal : ""),
          state: parsedState || cur.state,
          motor: parsedMotor || cur.motor,
          buzzer: parsedBuzzer || cur.buzzer,
          source: isSim ? "SIMULASI" : "RIIL"
        });
      }

      if (isSim && !isDemoMode) {
        setIsDemoMode(true);
      }
    }

    // 2. Format Respon Uji Diagnosa Pin (DIAG atau TEST FRONT/DOWN/IMU/WATER)
    if (line.includes("Sensor Depan") || line.includes("[TEST SENSOR DEPAN]")) {
      setData((prev) => {
        const next = { ...prev };
        if (line.includes("TERHUBUNG")) {
          next.frontConnected = true;
          const m = line.match(/Jarak[:\s=]+([0-9.]+)\s*cm/i);
          if (m) next.frontCm = Math.round(parseFloat(m[1]));
        } else if (line.includes("LEPAS")) {
          next.frontConnected = false;
          next.frontCm = null;
        }
        return next;
      });
    }

    if (line.includes("Sensor Bawah") || line.includes("[TEST SENSOR BAWAH]")) {
      setData((prev) => {
        const next = { ...prev };
        if (line.includes("TERHUBUNG")) {
          next.downConnected = true;
          const m = line.match(/Jarak[:\s=]+([0-9.]+)\s*cm/i);
          if (m) next.downCm = Math.round(parseFloat(m[1]));
        } else if (line.includes("LEPAS")) {
          next.downConnected = false;
          next.downCm = null;
        }
        return next;
      });
    }

    if (line.includes("Sensor IMU") || line.includes("MPU6050") || line.includes("[TEST MPU6050]")) {
      setData((prev) => {
        const next = { ...prev };
        if (line.includes("TERHUBUNG") || line.includes("OK (Terdeteksi)")) {
          next.mpuConnected = true;
          if (next.tiltDeg === null) next.tiltDeg = 10.0;
        } else if (line.includes("LEPAS")) {
          next.mpuConnected = false;
          next.tiltDeg = null;
        }
        return next;
      });
    }

    if (line.includes("Sensor Air") || line.includes("[TEST SENSOR AIR")) {
      setData((prev) => {
        const next = { ...prev };
        const m = line.match(/ADC(?:\s*RAW)?[:\s=]+(\d+)/i);
        if (m) {
          next.waterConnected = true;
          next.waterVal = parseInt(m[1], 10);
        }
        return next;
      });
    }
  };

  // Demo mode bidirectional sync
  const toggleDemoMode = (enabled: boolean) => {
    setIsDemoMode(enabled);
    if (enabled) {
      sendSerial("DEMO ON");
      sendSerial(`FRONT ${demoFront}`);
      sendSerial(`DOWN ${30 + demoDown}`);
      sendSerial(`TILT ${demoTilt}`);
      sendSerial(`WATER ${demoWater}`);
    } else {
      sendSerial("DEMO OFF");
      if (!isConnected) {
        setData(initialTelemetryState);
      }
    }
  };

  const triggerPreset = (scenario: "FALL" | "DROP" | "WET" | "NEAR" | "NORMAL") => {
    setIsDemoMode(true);
    if (scenario === "FALL") {
      setDemoTilt(75);
      sendSerial("FALL");
    } else if (scenario === "DROP") {
      setDemoDown(25);
      setDemoTilt(14);
      sendSerial("DROP");
    } else if (scenario === "WET") {
      setDemoWater(850);
      sendSerial("WET");
    } else if (scenario === "NEAR") {
      setDemoFront(14);
      sendSerial("NEAR");
    } else if (scenario === "NORMAL") {
      setDemoFront(120);
      setDemoDown(0);
      setDemoTilt(10);
      setDemoWater(180);
      sendSerial("NORMAL");
    }
  };

  const handleSliderFront = (val: number) => {
    setDemoFront(val);
    sendSerial(`FRONT ${val}`);
  };

  const handleSliderDown = (val: number) => {
    setDemoDown(val);
    sendSerial(`DOWN ${30 + val}`);
  };

  const handleSliderTilt = (val: number) => {
    setDemoTilt(val);
    sendSerial(`TILT ${val}`);
  };

  const handleSliderWater = (val: number) => {
    setDemoWater(val);
    sendSerial(`WATER ${val}`);
  };

  const handleSendCommand = (e?: React.FormEvent) => {
    if (!customCommand.trim()) return;
    const cmd = customCommand.trim();
    sendSerial(cmd);
    setCustomCommand("");
  };

  // Test Koneksi Hardware Sensor Asli (Mengirim perintah diagnostik ke mikrokontroler)
  const testTriggerSensor = (type: "FRONT" | "DOWN" | "IMU" | "WATER" | "ALL_ONLINE" | "RESET") => {
    if (!isConnected) {
      alert("Sambungkan USB Arduino terlebih dahulu untuk mengetes koneksi pin fisik hardware!");
      return;
    }

    if (type === "FRONT") {
      addLog("[TEST PIN] Memeriksa Sensor Depan HC-SR04 (Trig: D3, Echo: D2)...");
      sendSerial("TEST FRONT");
    } else if (type === "DOWN") {
      addLog("[TEST PIN] Memeriksa Sensor Bawah HC-SR04 (Trig: D9, Echo: D8)...");
      sendSerial("TEST DOWN");
    } else if (type === "IMU") {
      addLog("[TEST PIN] Memeriksa Sensor IMU MPU6050 (SDA: A4, SCL: A5 I2C)...");
      sendSerial("TEST IMU");
    } else if (type === "WATER") {
      addLog("[TEST PIN] Memeriksa Pelat Sensor Air (Analog: A0)...");
      sendSerial("TEST WATER");
    } else if (type === "ALL_ONLINE") {
      addLog("[TEST PIN] Menjalankan Diagnosa Lengkap Seluruh Modul Hardware...");
      sendSerial("DIAG");
    } else if (type === "RESET") {
      addLog("[TEST PIN] Mereset pembacaan sensor fisik ke kondisi nominal...");
      sendSerial("NORMAL");
    }
  };

  // Test & Simulasi Aktuator Fisik (Motor Getar D5 & Buzzer D6)
  const testTriggerActuator = (
    action: "MOTOR_PULSE" | "MOTOR_ON" | "MOTOR_OFF" | "BUZZER_BEEP" | "BUZZER_ON" | "BUZZER_OFF" | "ALL_OUTPUT" | "STOP_ALL"
  ) => {
    if (!isConnected) {
      alert("Sambungkan USB Arduino terlebih dahulu untuk menguji aktuator fisik!");
      return;
    }

    if (action === "MOTOR_PULSE") {
      setIsTestingMotor(true);
      setTimeout(() => setIsTestingMotor(false), 1500);
      addLog("[UJI AKTUATOR] Menguji Motor Getar (D5 PWM) selama 1.5 detik...");
      sendSerial("TEST MOTOR");
    } else if (action === "MOTOR_ON") {
      setIsTestingMotor(true);
      addLog("[UJI AKTUATOR] Menyalakan Motor Getar (D5 PWM) terus-menerus...");
      sendSerial("MOTOR ON");
    } else if (action === "MOTOR_OFF") {
      setIsTestingMotor(false);
      addLog("[UJI AKTUATOR] Mematikan Motor Getar (D5)...");
      sendSerial("MOTOR OFF");
    } else if (action === "BUZZER_BEEP") {
      setIsTestingBuzzer(true);
      setTimeout(() => setIsTestingBuzzer(false), 1500);
      addLog("[UJI AKTUATOR] Menguji Buzzer (D6) dengan pola Beep selama 1.5 detik...");
      sendSerial("TEST BUZZER");
    } else if (action === "BUZZER_ON") {
      setIsTestingBuzzer(true);
      addLog("[UJI AKTUATOR] Menyalakan Buzzer (D6) terus-menerus...");
      sendSerial("BUZZER ON");
    } else if (action === "BUZZER_OFF") {
      setIsTestingBuzzer(false);
      addLog("[UJI AKTUATOR] Mematikan Buzzer (D6)...");
      sendSerial("BUZZER OFF");
    } else if (action === "ALL_OUTPUT") {
      setIsTestingMotor(true);
      setIsTestingBuzzer(true);
      setTimeout(() => {
        setIsTestingMotor(false);
        setIsTestingBuzzer(false);
      }, 1500);
      addLog("[UJI AKTUATOR] Menjalankan Self-Test Semua Aktuator (Motor & Buzzer)...");
      sendSerial("TEST OUTPUT");
    } else if (action === "STOP_ALL") {
      setIsTestingMotor(false);
      setIsTestingBuzzer(false);
      addLog("[UJI AKTUATOR] Menghentikan semua uji aktuator manual...");
      sendSerial("STOP");
    }
  };

  // Demo fallback simulation tick when USB is not connected
  useEffect(() => {
    if (!isDemoMode) {
      if (!isConnected) {
        setData(initialTelemetryState);
      }
      return;
    }
    if (isConnected) return;

    let st = "NORMAL";
    let mot = "OFF";
    let buz = "DIAM";

    if (demoTilt > 60) {
      st = "TONGKAT_JATUH";
      buz = "SOS";
    } else if (demoDown > 15) {
      st = "TEPI_TURUNAN";
      mot = "ON";
    } else if (demoWater > 650) {
      st = "PERMUKAAN_BASAH";
      mot = "ON";
    } else if (demoFront < 20) {
      st = "OBJEK_DEKAT";
      mot = "ON";
    } else if (demoFront < 50) {
      st = "OBJEK_SEDANG";
      mot = "ON";
    } else if (demoFront < 100) {
      st = "OBJEK_WASPADA";
    }

    setData({
      frontConnected: true,
      frontCm: demoFront,
      downConnected: true,
      downCm: 30 + demoDown,
      mpuConnected: true,
      tiltDeg: demoTilt,
      waterConnected: true,
      waterVal: demoWater,
      state: st,
      motor: mot,
      buzzer: buz
    });
  }, [isDemoMode, isConnected, demoFront, demoDown, demoTilt, demoWater]);

  // Derived banner styling and state descriptions with full i18n
  const getBannerDetails = () => {
    const s = data.state.toUpperCase();
    const isId = lang === "id";

    if (s.includes("JATUH") || s.includes("FALL")) {
      return {
        type: "danger",
        tag: isId ? "[BAHAYA // PRIORITAS 1]" : "[DANGER // PRIORITY 1]",
        title: isId ? "TONGKAT TERJATUH // ALARM SOS AKTIF" : "CANE FALL DETECTED // SOS ALARM ACTIVE",
        desc: isId
          ? "Sudut kemiringan > 60 derajat selama > 2 detik. Motor haptic dimatikan dan buzzer memancarkan sinyal Morse SOS darurat."
          : "Tilt angle exceeded 60 degrees for over 2 seconds. Haptic motor deactivated and acoustic Morse SOS alarm sounding."
      };
    }
    if (s.includes("TURUNAN") || s.includes("DROP")) {
      return {
        type: "warning",
        tag: isId ? "[PERINGATAN // PRIORITAS 2]" : "[WARNING // PRIORITY 2]",
        title: isId ? "TEPI TURUNAN / JURANG / LUBANG" : "EDGE DROP-OFF / POTHOLE DETECTED",
        desc: isId
          ? "Jarak elevasi lantai naik > 15 cm dari baseline. Aktuator memberikan 3 pulsa getar intensitas tinggi pada gagang."
          : "Floor elevation distance increased by > 15 cm above calibrated baseline. 3 high-intensity vibration pulses issued at handle."
      };
    }
    if (s.includes("BASAH") || s.includes("WATER")) {
      return {
        type: "warning",
        tag: isId ? "[PERHATIAN // PRIORITAS 3]" : "[CAUTION // PRIORITY 3]",
        title: isId ? "GENANGAN AIR / PERMUKAAN BASAH" : "SURFACE WATER / PUDDLE DETECTED",
        desc: isId
          ? "Pelat konduktivitas mendeteksi cairan (A0 > 650). Aktuator memberikan 2 kali getaran panjang pada pegangan."
          : "Conductive probe detected surface moisture (A0 > 650). 2 sustained vibration pulses issued to alert the user."
      };
    }
    if (s.includes("DEKAT")) {
      return {
        type: "danger",
        tag: isId ? "[BAHAYA // PRIORITAS 4]" : "[DANGER // PRIORITY 4]",
        title: isId ? "RINTANGAN SANGAT DEKAT (< 30 CM)" : "OBSTACLE VERY CLOSE (< 30 CM)",
        desc: isId
          ? "Penghalang tepat di hadapan pengguna. Motor bergetar kontinu dengan frekuensi maksimal (PWM 240)."
          : "Critical obstacle directly ahead. Handle motor vibrating continuously at peak duty cycle (PWM 240)."
      };
    }
    if (s.includes("SEDANG") || s.includes("WASPADA")) {
      return {
        type: "warning",
        tag: isId ? "[WASPADA // PRIORITAS 5]" : "[ALERT // PRIORITY 5]",
        title: isId ? "RINTANGAN TERDETEKSI DI DEPAN (30-100 CM)" : "FRONTAL OBSTACLE DETECTED (30-100 CM)",
        desc: isId
          ? "Objek terdeteksi mendekat. Pulsa getaran ritmis di gagang memandu pengguna untuk memperlambat langkah."
          : "Approaching obstacle detected. Rhythmic haptic pulses guide the user to slow down navigation."
      };
    }
    if (s.includes("NORMAL")) {
      return {
        type: "normal",
        tag: isId ? "[NORMAL // JALUR BERSIH]" : "[NORMAL // PATH CLEAR]",
        title: isId ? "KONDISI AMAN // JALUR BEBAS HAMBATAN" : "SAFE WALKING PATH // CLEAR OF HAZARDS",
        desc: isId
          ? "Seluruh sensor berada dalam batas toleransi aman. Aktuator haptic dan buzzer dalam keadaan siaga."
          : "All sensory inputs are within safe nominal thresholds. Haptic and acoustic alerts in standby."
      };
    }
    return {
      type: "standby",
      tag: isId ? "[STANDBY // MODE SIAGA]" : "[STANDBY // AWAITING HARDWARE]",
      title: isId ? "MENUNGGU SAMBUNGAN PERANGKAT FISIK" : "WAITING FOR HARDWARE CONNECTION",
      desc: isId
        ? "Hubungkan kabel serial USB Arduino Nano atau nyalakan Mode Demo untuk memulai pemantauan telemetri real-time."
        : "Connect Arduino Nano via USB serial or toggle Demo Mode to start real-time telemetry streaming."
    };
  };

  const banner = getBannerDetails();

  return (
    <div className="min-h-screen bg-zinc-100/70 dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        
        {/* Browser Incompatibility Notice Banner */}
        {!isSerialSupported && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 px-4 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 text-xs shadow-2xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>Browser Tidak Mendukung Web Serial API:</strong> Anda sedang menggunakan browser non-Chromium (seperti Zen Browser atau Firefox). Untuk membaca data telemetri USB secara langsung, silakan buka dashboard ini di <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong>.
              </span>
            </div>
            <a
              href="https://www.google.com/chrome/"
              target="_blank"
              rel="noreferrer"
              className="underline text-[11px] font-mono shrink-0 hover:text-amber-950 dark:hover:text-amber-100 font-bold self-end sm:self-auto"
            >
              Buka di Chrome &rarr;
            </a>
          </div>
        )}

        {/* Streamlined Responsive Header */}
        <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs">
          
          {/* Brand Left */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white flex items-center justify-center shrink-0">
              <img
                src="/katana-logo.png"
                alt="KATANA Logo"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-zinc-950 dark:text-white">
                {t.appTitle}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 font-semibold">
                {t.badge}
              </span>
            </div>
          </div>

          {/* Controls Right - Locked Fixed Dimensions with Responsive Flow */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
            
            {/* Connection Status Pill (Fixed Width 176px / w-44) */}
            <div className="hidden md:flex items-center justify-center gap-1.5 w-44 h-8 px-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono shrink-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isConnected
                    ? "bg-emerald-500 animate-pulse"
                    : isDemoMode
                    ? "bg-amber-500 animate-pulse"
                    : "bg-zinc-400 dark:bg-zinc-600"
                }`}
              />
              <span className="text-zinc-600 dark:text-zinc-400 text-[11px] font-semibold truncate text-center">
                {isConnected ? t.connectedStatus : isDemoMode ? t.demoStatus : t.disconnectedStatus}
              </span>
            </div>

            {/* Language Switcher [ID | EN] (Fixed Width 64px / w-16) */}
            <div
              suppressHydrationWarning
              className="flex items-center w-16 h-8 justify-between bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 text-xs font-mono font-medium shrink-0"
            >
              <button
                onClick={() => handleSetLang("id")}
                className={`flex-1 py-1 rounded text-center transition-all cursor-pointer text-[11px] ${
                  lang === "id"
                    ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
                title="Bahasa Indonesia"
              >
                ID
              </button>
              <button
                onClick={() => handleSetLang("en")}
                className={`flex-1 py-1 rounded text-center transition-all cursor-pointer text-[11px] ${
                  lang === "en"
                    ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
                title="English"
              >
                EN
              </button>
            </div>

            {/* Theme Selector (Fixed Width 96px / w-24) */}
            <div
              suppressHydrationWarning
              className="flex items-center w-24 h-8 justify-between bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 text-xs font-medium shrink-0"
            >
              <button
                onClick={() => setTheme("light")}
                className={`flex-1 py-1 rounded flex items-center justify-center transition-all cursor-pointer ${
                  (mounted ? theme : "light") === "light"
                    ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
                title="Mode Terang"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex-1 py-1 rounded flex items-center justify-center transition-all cursor-pointer ${
                  (mounted ? theme : "light") === "dark"
                    ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
                title="Mode Gelap"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex-1 py-1 rounded flex items-center justify-center transition-all cursor-pointer ${
                  (mounted ? theme : "light") === "system"
                    ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
                title="Ikuti Sistem"
              >
                <Laptop className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Demo Toggle Button (Fixed Width 112px / w-28) */}
            <button
              onClick={() => toggleDemoMode(!isDemoMode)}
              className={`flex items-center justify-center gap-1.5 w-28 h-8 px-2 rounded-lg border text-xs font-mono font-medium transition-all cursor-pointer shrink-0 ${
                isDemoMode
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-2xs"
                  : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isDemoMode ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"
                }`}
              />
              <span className="text-[11px] font-semibold">{isDemoMode ? t.demoOn : t.demoOff}</span>
            </button>

            {/* Connect USB Button (Fixed Width 176px / w-44) */}
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="flex items-center justify-center gap-1.5 w-44 h-8 px-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs rounded-lg transition-all shadow-2xs cursor-pointer shrink-0"
              >
                <Usb className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.connectBtn}</span>
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="flex items-center justify-center gap-1.5 w-44 h-8 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-semibold text-xs rounded-lg transition-all cursor-pointer shrink-0"
              >
                <Unplug className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.disconnectBtn}</span>
              </button>
            )}
          </div>
        </header>

        {/* Tab Navigation Navigation Switcher */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("monitor")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              activeTab === "monitor"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm border border-transparent"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Gauge className="w-4 h-4 shrink-0" />
            <span>{t.tabMonitoring}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("serial_flash")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              activeTab === "serial_flash"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm border border-transparent"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            <Radio className="w-4 h-4 shrink-0" />
            <span>{t.tabSerialConsole}</span>
            {hexFile && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="File HEX siap" />
            )}
          </button>
        </div>

        {/* Master Mission Telemetry Status Ribbon */}
        <div
          className={`px-5 py-3.5 rounded-2xl border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs ${
            banner.type === "danger"
              ? "bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60"
              : banner.type === "warning"
              ? "bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60"
              : banner.type === "normal"
              ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60"
              : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                  banner.type === "danger"
                    ? "bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300"
                    : banner.type === "warning"
                    ? "bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
                    : banner.type === "normal"
                    ? "bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {banner.tag}
              </span>
              {isDemoMode && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold">
                  {t.demoTag}
                </span>
              )}
            </div>
            <h2 className="text-base md:text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
              {banner.title}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">
              {banner.desc}
            </p>
          </div>

          {/* Actuator Status Badges (Locked Fixed Width 176px / w-44 to Prevent Jitter) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-44 h-12 flex items-center gap-2.5 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs shrink-0">
              <Vibrate className="w-4 h-4 text-zinc-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-mono text-zinc-400 uppercase font-semibold">
                  {t.haptic} (D5 PWM)
                </div>
                <div
                  className={`text-xs font-mono font-bold truncate ${
                    data.motor === "ON"
                      ? "text-amber-600 dark:text-amber-400 animate-pulse"
                      : "text-zinc-500"
                  }`}
                >
                  {data.motor === "ON" ? t.vibrating : t.idle}
                </div>
              </div>
            </div>

            <div className="w-44 h-12 flex items-center gap-2.5 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs shrink-0">
              <Volume2 className="w-4 h-4 text-zinc-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-mono text-zinc-400 uppercase font-semibold">
                  {t.buzzer} (D6 BC547)
                </div>
                <div
                  className={`text-xs font-mono font-bold truncate ${
                    data.buzzer.includes("SOS")
                      ? "text-rose-600 dark:text-rose-400 animate-pulse"
                      : "text-zinc-500"
                  }`}
                >
                  {data.buzzer.includes("SOS") ? t.sosAlarm : t.silent}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TAB 1: SENSOR MONITORING & CAD ORIENTATION */}
        {activeTab === "monitor" && (
          <>
            {/* Quick Hardware & Sensor Debug Test Bar */}
            <div className="space-y-2">
              {/* Row 1: Pin Sensor Connection Test */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 text-[11px]">
                    <Activity className="w-3.5 h-3.5 text-sky-500" />
                    TES KONEKSI PIN SENSOR:
                  </span>
                  <span className="text-[10px] text-zinc-500 hidden sm:inline">
                    (Periksa sambungan kabel fisik tiap sensor)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => testTriggerSensor("FRONT")}
                    className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono font-bold cursor-pointer transition-all"
                    title="Kirim TEST FRONT untuk cek pulsa Echo pin D2"
                  >
                    Cek Depan (D2/D3)
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerSensor("DOWN")}
                    className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono font-bold cursor-pointer transition-all"
                    title="Kirim TEST DOWN untuk cek pulsa Echo pin D8"
                  >
                    Cek Bawah (D8/D9)
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerSensor("IMU")}
                    className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono font-bold cursor-pointer transition-all"
                    title="Kirim TEST IMU untuk cek bus I2C A4/A5 modul 0x68/0x69"
                  >
                    Cek IMU (A4/A5)
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerSensor("WATER")}
                    className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono font-bold cursor-pointer transition-all"
                    title="Kirim TEST WATER untuk membaca ADC analog A0"
                  >
                    Cek Air (A0)
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerSensor("ALL_ONLINE")}
                    className="px-2.5 py-1 rounded-md bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900 text-[10px] font-mono font-bold cursor-pointer transition-all"
                    title="Jalankan perintah DIAG untuk menguji semua sensor sekaligus"
                  >
                    Diagnosa Lengkap (DIAG)
                  </button>
                </div>
              </div>

              {/* Row 2: Actuator Trigger & Simulation Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 text-[11px]">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    TRIGGER / UJI AKTUATOR:
                  </span>
                  <span className="text-[10px] text-zinc-500 hidden sm:inline">
                    (Trigger getar motor D5 & bunyi buzzer D6)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => testTriggerActuator("MOTOR_PULSE")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold cursor-pointer transition-all flex items-center gap-1 border ${
                      isTestingMotor
                        ? "bg-amber-500 text-white border-amber-600 animate-pulse shadow-xs"
                        : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900"
                    }`}
                    title="Getarkan motor getar di pin D5 selama 1.5 detik (TEST MOTOR)"
                  >
                    <Vibrate className={`w-3 h-3 ${isTestingMotor ? "animate-spin" : ""}`} />
                    {isTestingMotor ? "Menggetar..." : "Getar Motor (1.5s)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerActuator(data.motor === "ON" ? "MOTOR_OFF" : "MOTOR_ON")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold cursor-pointer transition-all border ${
                      data.motor === "ON"
                        ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800"
                    }`}
                    title="Nyalakan / matikan motor getar secara manual"
                  >
                    {data.motor === "ON" ? "Motor: ON (Aktif)" : "Motor: ON"}
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerActuator("BUZZER_BEEP")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold cursor-pointer transition-all flex items-center gap-1 border ${
                      isTestingBuzzer
                        ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-xs"
                        : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                    }`}
                    title="Bunyikan buzzer pola beep di pin D6 selama 1.5 detik (TEST BUZZER)"
                  >
                    <Volume2 className={`w-3 h-3 ${isTestingBuzzer ? "animate-bounce" : ""}`} />
                    {isTestingBuzzer ? "Berbunyi..." : "Beep Buzzer (1.5s)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerActuator(data.buzzer === "SOS" ? "BUZZER_OFF" : "BUZZER_ON")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold cursor-pointer transition-all border ${
                      data.buzzer === "SOS"
                        ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                        : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800"
                    }`}
                    title="Nyalakan / matikan buzzer secara manual"
                  >
                    {data.buzzer === "SOS" ? "Buzzer: ON (Aktif)" : "Buzzer: ON"}
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerActuator("ALL_OUTPUT")}
                    className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 text-[10px] font-mono font-bold cursor-pointer transition-all"
                    title="Self-test motor dan buzzer bergantian (TEST OUTPUT)"
                  >
                    Test Motor + Buzzer
                  </button>
                  <button
                    type="button"
                    onClick={() => testTriggerActuator("STOP_ALL")}
                    className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-rose-100 dark:bg-zinc-900 dark:hover:bg-rose-950/40 text-zinc-600 hover:text-rose-700 dark:text-zinc-400 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono font-bold cursor-pointer transition-all"
                    title="Hentikan semua override aktuator (STOP)"
                  >
                    Stop Semua
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Dedicated Sensor Telemetry Cards (High-End Industrial Double-Bezel Design, NOT AI Slop) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Front Obstacle */}
          <div className="p-1 rounded-2xl bg-zinc-200/50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs">
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 space-y-3 h-full flex flex-col justify-between">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-800">
                    <Eye className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {t.frontObstacle}
                    </h3>
                    <div className="text-[10px] font-mono text-zinc-400">{t.frontSub}</div>
                  </div>
                </div>
                <span
                  className={`w-18 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold shrink-0 ${
                    data.frontConnected
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {data.frontConnected ? t.online : t.offline}
                </span>
              </div>

              {/* Big Readout */}
              <div className="flex items-baseline justify-between pt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black font-mono tracking-tight text-zinc-900 dark:text-white tabular-nums">
                    {data.frontConnected && data.frontCm !== null ? data.frontCm : "--"}
                  </span>
                  <span className="text-xs font-mono font-semibold text-zinc-400">cm</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-zinc-500">
                  {!data.frontConnected
                    ? t.bracketOffline
                    : data.frontCm! < 30
                    ? t.bracketHazard
                    : data.frontCm! < 60
                    ? t.bracketCaution
                    : t.bracketSafe}
                </span>
              </div>

              {/* 3-Zone Segmented Visual Meter */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden flex p-0.5 gap-1 border border-zinc-200/60 dark:border-zinc-800/60">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      !data.frontConnected
                        ? "w-0 bg-transparent"
                        : data.frontCm! < 30
                        ? "w-full bg-rose-500"
                        : "w-full bg-zinc-200 dark:bg-zinc-800"
                    }`}
                    title="Zona Bahaya (<30cm)"
                  />
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      !data.frontConnected
                        ? "w-0 bg-transparent"
                        : data.frontCm! >= 30 && data.frontCm! < 100
                        ? "w-full bg-amber-500"
                        : "w-full bg-zinc-200 dark:bg-zinc-800"
                    }`}
                    title="Zona Waspada (30-100cm)"
                  />
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      !data.frontConnected
                        ? "w-0 bg-transparent"
                        : data.frontCm! >= 100
                        ? "w-full bg-emerald-500"
                        : "w-full bg-zinc-200 dark:bg-zinc-800"
                    }`}
                    title="Zona Aman (>100cm)"
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                  <span>0 cm</span>
                  <span>30 cm</span>
                  <span>100 cm</span>
                </div>
              </div>

              {/* Dynamic Context Footer */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900">
                <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {!data.frontConnected
                    ? t.sensorDisconnected
                    : data.frontCm! < 30
                    ? t.frontHazard
                    : data.frontCm! < 60
                    ? t.frontCaution
                    : t.frontClear}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {t.frontSensorType}
                </div>
              </div>

            </div>
          </div>

          {/* Card 2: Drop-off / Pothole */}
          <div className="p-1 rounded-2xl bg-zinc-200/50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs">
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 space-y-3 h-full flex flex-col justify-between">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-800">
                    <TrendingDown className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {t.downDrop}
                    </h3>
                    <div className="text-[10px] font-mono text-zinc-400">{t.downSub}</div>
                  </div>
                </div>
                <span
                  className={`w-18 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold shrink-0 ${
                    data.downConnected
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {data.downConnected ? t.online : t.offline}
                </span>
              </div>

              {/* Big Readout */}
              <div className="flex items-baseline justify-between pt-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-mono tracking-tight text-zinc-900 dark:text-white tabular-nums">
                    {data.downConnected && data.downCm !== null ? `${data.downCm}` : "--"}
                  </span>
                  <span className="text-xs font-mono font-semibold text-zinc-400">cm</span>
                  {data.downConnected && data.downCm !== null && (
                    <span className="text-[10px] font-mono font-medium text-zinc-500 dark:text-zinc-400">
                      (Δ +{Math.max(0, data.downCm - 25)}cm)
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold text-zinc-500">
                  {!data.downConnected
                    ? t.bracketOffline
                    : data.downCm! - 25 > 15
                    ? t.bracketHazard
                    : t.bracketNormal}
                </span>
              </div>

              {/* Visual Step Drop Gauge */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-200/60 dark:border-zinc-800/60">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      !data.downConnected
                        ? "w-0"
                        : data.downCm! - 25 > 15
                        ? "bg-rose-500"
                        : "bg-zinc-700 dark:bg-zinc-300"
                    }`}
                    style={{
                      width: `${data.downConnected && data.downCm !== null ? Math.min(100, Math.max(8, ((data.downCm - 25) / 40) * 100)) : 0}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                  <span>{t.meterBaseline}</span>
                  <span className="text-rose-500 font-bold">{t.meterDropLimit}</span>
                  <span>+40cm</span>
                </div>
              </div>

              {/* Dynamic Context Footer */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900">
                <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {!data.downConnected
                    ? t.sensorDisconnected
                    : data.downCm! - 25 > 15
                    ? t.downHazard
                    : t.downClear}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {t.downSensorType}
                </div>
              </div>

            </div>
          </div>

          {/* Card 3: Cane Orientation (IMU MPU6050) */}
          <div className="p-1 rounded-2xl bg-zinc-200/50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs">
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 space-y-3 h-full flex flex-col justify-between">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-800">
                    <Compass className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {t.caneTilt}
                    </h3>
                    <div className="text-[10px] font-mono text-zinc-400">{t.caneSub}</div>
                  </div>
                </div>
                <span
                  className={`w-18 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold shrink-0 ${
                    data.mpuConnected
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {data.mpuConnected ? t.online : t.offline}
                </span>
              </div>

              {/* Big Readout */}
              <div className="flex items-baseline justify-between pt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black font-mono tracking-tight text-zinc-900 dark:text-white tabular-nums">
                    {data.mpuConnected && data.tiltDeg !== null ? data.tiltDeg.toFixed(1) : "--"}
                  </span>
                  <span className="text-xs font-mono font-semibold text-zinc-400">° {t.unitDegrees}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-zinc-500">
                  {!data.mpuConnected
                    ? t.bracketOffline
                    : data.tiltDeg! > 60
                    ? t.bracketFallen
                    : t.bracketUpright}
                </span>
              </div>

              {/* Visual Tilt Meter */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-200/60 dark:border-zinc-800/60">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      !data.mpuConnected
                        ? "w-0"
                        : data.tiltDeg! > 60
                        ? "bg-rose-500"
                        : "bg-zinc-700 dark:bg-zinc-300"
                    }`}
                    style={{
                      width: `${data.mpuConnected && data.tiltDeg !== null ? Math.min(100, Math.max(6, (data.tiltDeg / 90) * 100)) : 0}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                  <span>{t.meterTiltUpright}</span>
                  <span className="text-rose-500 font-bold">{t.meterTiltLimit}</span>
                  <span>{t.meterTiltFlat}</span>
                </div>
              </div>

              {/* Dynamic Context Footer */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900">
                <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {!data.mpuConnected
                    ? t.sensorDisconnected
                    : data.tiltDeg! > 60
                    ? t.tiltHazard
                    : t.tiltReady}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {t.imuSensorType}
                </div>
              </div>

            </div>
          </div>

          {/* Card 4: Water / Puddle Detection (Fixed Disconnected State) */}
          <div className="p-1 rounded-2xl bg-zinc-200/50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs">
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 space-y-3 h-full flex flex-col justify-between">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-800">
                    <Droplets className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {t.waterSensor}
                    </h3>
                    <div className="text-[10px] font-mono text-zinc-400">{t.waterSub}</div>
                  </div>
                </div>
                <span
                  className={`w-18 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold shrink-0 ${
                    data.waterConnected && data.waterVal !== null
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {data.waterConnected && data.waterVal !== null ? t.online : t.offline}
                </span>
              </div>

              {/* Big Readout */}
              <div className="flex items-baseline justify-between pt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black font-mono tracking-tight text-zinc-900 dark:text-white tabular-nums">
                    {data.waterConnected && data.waterVal !== null ? data.waterVal : "--"}
                  </span>
                  {data.waterConnected && data.waterVal !== null ? (
                    <span className="text-xs font-mono font-semibold text-zinc-400">/ 1023 ADC</span>
                  ) : null}
                </div>
                <span className="text-[10px] font-mono font-bold text-zinc-500">
                  {!data.waterConnected || data.waterVal === null
                    ? t.bracketOffline
                    : data.waterVal > 650
                    ? t.bracketWet
                    : t.bracketDry}
                </span>
              </div>

              {/* Visual Liquid Level Bar */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-200/60 dark:border-zinc-800/60">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      !data.waterConnected || data.waterVal === null
                        ? "w-0"
                        : data.waterVal > 650
                        ? "bg-sky-500"
                        : "bg-zinc-700 dark:bg-zinc-300"
                    }`}
                    style={{
                      width: `${data.waterConnected && data.waterVal !== null ? Math.min(100, Math.max(5, (data.waterVal / 1023) * 100)) : 0}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                  <span>{t.meterWaterDry}</span>
                  <span className="text-sky-500 font-bold">{t.meterWaterLimit}</span>
                  <span>{t.meterWaterWet}</span>
                </div>
              </div>

              {/* Dynamic Context Footer */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900">
                <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
                  {!data.waterConnected || data.waterVal === null
                    ? t.sensorDisconnected
                    : data.waterVal > 650
                    ? t.waterHazard
                    : t.waterClear}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {t.waterSensorType}
                </div>
              </div>

            </div>
          </div>

        </section>

        {/* Dual Workstation Console: 2D CAD Visualizer & Diagnostics/Serial Deck */}
        <main className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
            
            {/* Left 7 Columns: 2D CAD Blueprint Visualizer */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              
              {/* CAD Canvas Header */}
              <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-zinc-500" />
                    {t.cadTitle}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {t.cadDesc}
                  </p>
                </div>
                <span className="w-32 h-7 flex items-center justify-center font-mono text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shrink-0">
                  {t.cadAngle} {data.mpuConnected && data.tiltDeg !== null ? data.tiltDeg.toFixed(1) : "--"}°
                </span>
              </div>

              {/* 2D CAD Blueprint Simulation Canvas */}
              <div className="h-80 bg-blueprint-grid bg-zinc-50 dark:bg-zinc-950 relative flex items-center justify-center overflow-hidden">
                
                {/* Protractor Guidelines */}
                <div className="absolute bottom-8 w-72 h-36 border-t border-l border-r border-dashed border-zinc-300 dark:border-zinc-800 rounded-t-full pointer-events-none" />
                <div className="absolute bottom-8 w-48 h-24 border-t border-l border-r border-dashed border-zinc-200 dark:border-zinc-850 rounded-t-full pointer-events-none" />

                {/* Angle Tick Marks */}
                <span className="absolute bottom-9 left-10 text-[9px] font-mono text-zinc-400">80°</span>
                <span className="absolute bottom-28 left-20 text-[9px] font-mono text-zinc-400">60°</span>
                <span className="absolute top-8 text-[9px] font-mono text-zinc-400">0°</span>
                <span className="absolute bottom-28 right-20 text-[9px] font-mono text-zinc-400">30°</span>

                {/* Floor Horizon Line */}
                <div className="absolute bottom-8 left-0 right-0 h-0.5 bg-zinc-300 dark:bg-zinc-700 flex justify-between px-4">
                  <span className="text-[10px] text-zinc-400 font-mono -mt-4">{t.floorRef}</span>
                  <span className="text-[10px] text-zinc-400 font-mono -mt-4">{t.horizonPlanar}</span>
                </div>

                {/* Virtual Cane Vector */}
                <div
                  className="w-1.5 bg-zinc-900 dark:bg-white h-52 absolute bottom-8 origin-bottom transition-transform duration-200 ease-out"
                  style={{
                    transform: `rotate(${Math.min(85, data.mpuConnected && data.tiltDeg !== null ? data.tiltDeg : 0)}deg)`
                  }}
                >
                  {/* Arm Cuff & Handle Bracket */}
                  <div className="w-8 h-2 bg-zinc-900 dark:bg-white -left-6.5 -top-3 absolute rounded-xs" />
                  <div className="w-7 h-2 bg-zinc-900 dark:bg-white -left-5.5 top-14 absolute rounded-xs shadow-xs" />
                  
                  {/* Ultrasonic Sensor Nodes */}
                  <div
                    className={`w-3 h-3 rounded-full -left-0.75 top-24 absolute border border-white shadow-xs ${
                      data.frontConnected ? "bg-emerald-500" : "bg-zinc-400"
                    }`}
                    title="HC-SR04 Depan"
                  />
                  <div
                    className={`w-3 h-3 rounded-full -left-0.75 bottom-10 absolute border border-white shadow-xs ${
                      data.downConnected ? "bg-sky-500" : "bg-zinc-400"
                    }`}
                    title="HC-SR04 Bawah"
                  />
                  
                  {/* Rubber Tip Foot */}
                  <div className="w-3.5 h-2.5 bg-zinc-800 dark:bg-zinc-200 -left-1 -bottom-1 absolute rounded-xs" />
                </div>

                {/* Fall Alert Overlay */}
                {data.mpuConnected && data.tiltDeg !== null && data.tiltDeg > 60 && (
                  <div className="absolute top-4 px-4 py-2 bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-lg border border-rose-500 animate-bounce tracking-wide flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t.fallWarning}
                  </div>
                )}
              </div>

            </div>

            {/* Right 5 Columns: Diagnostics Deck & Live Terminal */}
            <div className="lg:col-span-5 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/10">
              
              {/* Hardware Pin Status Deck */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                    {t.wiringTitle}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400">ATmega328P</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  
                  {/* Pin 1: Front */}
                  <div className="p-2 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold">{t.pinFrontLabel}</div>
                      <div className="text-[10px] font-mono text-zinc-400">D2/D3</div>
                    </div>
                    <span
                      className={`w-24 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold shrink-0 ${
                        data.frontConnected
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {data.frontConnected ? t.connectedTag : t.disconnectedTag}
                    </span>
                  </div>

                  {/* Pin 2: Down */}
                  <div className="p-2 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold">{t.pinDownLabel}</div>
                      <div className="text-[10px] font-mono text-zinc-400">D8/D9</div>
                    </div>
                    <span
                      className={`w-24 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold shrink-0 ${
                        data.downConnected
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {data.downConnected ? t.connectedTag : t.disconnectedTag}
                    </span>
                  </div>

                  {/* Pin 3: IMU */}
                  <div className="p-2 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold">{t.pinImuLabel}</div>
                      <div className="text-[10px] font-mono text-zinc-400">A4/A5 I2C</div>
                    </div>
                    <span
                      className={`w-24 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold shrink-0 ${
                        data.mpuConnected
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {data.mpuConnected ? t.connectedTag : t.disconnectedTag}
                    </span>
                  </div>

                  {/* Pin 4: Water (Fixed Disconnect Logic) */}
                  <div className="p-2 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold">{t.pinWaterLabel}</div>
                      <div className="text-[10px] font-mono text-zinc-400">A0 Analog</div>
                    </div>
                    <span
                      className={`w-24 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold shrink-0 ${
                        data.waterConnected && data.waterVal !== null
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {data.waterConnected && data.waterVal !== null ? t.connectedTag : t.disconnectedTag}
                    </span>
                  </div>

                  {/* Pin 5: Motor */}
                  <div className="p-2 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold">{t.pinMotorLabel}</div>
                      <div className="text-[10px] font-mono text-zinc-400">D5 PWM</div>
                    </div>
                    <span className="w-24 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                      {t.readyTag}
                    </span>
                  </div>

                  {/* Pin 6: Buzzer */}
                  <div className="p-2 bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold">{t.pinBuzzerLabel}</div>
                      <div className="text-[10px] font-mono text-zinc-400">D6 BC547</div>
                    </div>
                    <span className="w-24 h-5 flex items-center justify-center text-[9px] font-mono rounded font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                      {t.readyTag}
                    </span>
                  </div>

                </div>
              </div>

              {/* Telemetry Data Logger & CSV Export Card */}
              <div className="p-3.5 bg-zinc-100/70 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{t.dataLoggerTitle}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isRecording ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                        <Circle className="w-2 h-2 fill-current" />
                        {t.recActive} ({formatDuration(recordDuration)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {t.recIdle}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-zinc-500">
                      {recordCount} {t.recordedCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="flex-1 h-7.5 flex items-center justify-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs min-w-[100px]"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{t.startRec}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex-1 h-7.5 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs animate-pulse min-w-[100px]"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>{t.stopRec}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={downloadCsv}
                    disabled={recordCount === 0}
                    className={`h-7.5 px-2.5 flex items-center justify-center gap-1 font-bold text-xs rounded-lg border transition-all cursor-pointer ${
                      recordCount > 0
                        ? "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={copyTsv}
                    disabled={recordCount === 0}
                    title="Salin TSV (langsung paste ke Excel / Google Sheets)"
                    className={`h-7.5 px-2 flex items-center justify-center gap-1 text-xs rounded-lg border transition-all cursor-pointer ${
                      recordCount > 0
                        ? "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border-zinc-300 dark:border-zinc-700"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                    }`}
                  >
                    {copiedTsv ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTsv ? t.copiedTsv : "TSV"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadJson}
                    disabled={recordCount === 0}
                    title="Unduh JSON Dataset"
                    className={`h-7.5 px-2 flex items-center justify-center gap-1 text-xs rounded-lg border transition-all cursor-pointer ${
                      recordCount > 0
                        ? "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border-zinc-300 dark:border-zinc-700"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                    }`}
                  >
                    <FileCode className="w-3 h-3" />
                    <span>JSON</span>
                  </button>

                  {recordCount > 0 && !isRecording && (
                    <button
                      type="button"
                      onClick={clearRecords}
                      title={t.clearRec}
                      className="h-7.5 px-2 flex items-center justify-center text-xs text-zinc-500 hover:text-rose-600 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Session Metrics Strip */}
                {recordCount > 0 && (() => {
                  const stats = getSessionMetrics();
                  if (!stats) return null;
                  return (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-3 gap-2 text-center text-zinc-600 dark:text-zinc-400 font-mono text-[10px]">
                      <div className="bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">
                        <div className="text-[9px] text-zinc-400 font-sans">{t.avgDistance}</div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{stats.avgFront} cm</div>
                      </div>
                      <div className="bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">
                        <div className="text-[9px] text-zinc-400 font-sans">{t.maxTilt}</div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{stats.maxTilt}°</div>
                      </div>
                      <div className="bg-white dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">
                        <div className="text-[9px] text-zinc-400 font-sans">{t.hazardEvents}</div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{stats.hazardTriggers}x</div>
                      </div>
                    </div>
                  );
                })()}

                {hasBackup && recordCount === 0 && (
                  <div className="flex items-center justify-between p-2 bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs">
                    <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-mono">
                      {t.backupFound} ({backupCount} data)
                    </span>
                    <button
                      type="button"
                      onClick={restoreBackup}
                      className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-[10px] rounded cursor-pointer transition-all"
                    >
                      {t.restoreBackup}
                    </button>
                  </div>
                )}
              </div>

              {/* Live Serial Console */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                    {t.terminalTitle}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyLogs}
                      className="w-16 h-6 flex items-center justify-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer font-medium border border-zinc-200 dark:border-zinc-800 rounded px-1.5"
                    >
                      {copiedLog ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLog ? t.copied : t.copyLogs}</span>
                    </button>
                    <button
                      onClick={() => setLogs([])}
                      className="w-20 h-6 flex items-center justify-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer font-medium border border-zinc-200 dark:border-zinc-800 rounded px-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t.clear}</span>
                    </button>
                  </div>
                </div>

                {/* Log Terminal Window */}
                <div
                  ref={logContainerRef}
                  className="h-32 bg-zinc-100/90 dark:bg-zinc-900/90 rounded-lg p-2.5 overflow-y-auto font-mono text-[11px] text-zinc-700 dark:text-zinc-300 space-y-1 border border-zinc-200 dark:border-zinc-800"
                >
                  {logs.map((line, i) => (
                    <div key={i} className="leading-relaxed">
                      {line.startsWith("[KIRIM]") ? (
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">{line}</span>
                      ) : line.startsWith("[ERROR]") ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{line}</span>
                      ) : line.startsWith("[SIMULASI]") ? (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">{line}</span>
                      ) : line.startsWith("[KONEKSI]") ? (
                        <span className="text-emerald-600 dark:text-emerald-400">{line}</span>
                      ) : (
                        <span>{line}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Serial Command Input & Send Bar */}
                <form onSubmit={handleSendCommand} className="flex gap-2">
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder={t.inputPlaceholder}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    className="w-20 h-8 flex items-center justify-center gap-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs rounded-lg transition-all cursor-pointer shadow-2xs shrink-0"
                  >
                    <Send className="w-3 h-3" />
                    <span>{t.send}</span>
                  </button>
                </form>

                {/* Quick Simulation Trigger Shortcuts */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                  <span className="text-zinc-400 font-mono text-[10px]">{t.shortcuts}</span>
                  <button
                    type="button"
                    onClick={() => triggerPreset("FALL")}
                    className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-mono text-[10px] font-bold cursor-pointer"
                  >
                    {t.fallPreset}
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPreset("DROP")}
                    className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 font-mono text-[10px] font-bold cursor-pointer"
                  >
                    {t.dropPreset}
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPreset("WET")}
                    className="px-2 py-0.5 rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900 font-mono text-[10px] font-bold cursor-pointer"
                  >
                    {t.wetPreset}
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPreset("NEAR")}
                    className="px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 font-mono text-[10px] font-bold cursor-pointer"
                  >
                    {t.nearPreset}
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPreset("NORMAL")}
                    className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 font-mono text-[10px] font-bold cursor-pointer"
                  >
                    {t.normalPreset}
                  </button>
                </div>

              </div>

            </div>

          </div>

          {/* Integrated Simulation Dock (Wokwi Style Embedded Controls) */}
          {isDemoMode && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 font-mono">
                    {t.simTitle}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {isConnected ? t.simOnline : t.simOffline}
                  </span>
                </div>
                <button
                  onClick={() => toggleDemoMode(false)}
                  className="text-[10px] font-mono font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  {t.closeDemo}
                </button>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                
                {/* Slider 1: Front */}
                <div className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-zinc-500">{t.frontDistLabel}</span>
                    <span className="font-bold">{demoFront} cm</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="180"
                    value={demoFront}
                    onChange={(e) => handleSliderFront(parseInt(e.target.value, 10))}
                    className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                </div>

                {/* Slider 2: Down */}
                <div className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-zinc-500">{t.downDeltaLabel}</span>
                    <span className="font-bold">+{demoDown} cm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    value={demoDown}
                    onChange={(e) => handleSliderDown(parseInt(e.target.value, 10))}
                    className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                </div>

                {/* Slider 3: Tilt */}
                <div className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-zinc-500">{t.tiltLabel}</span>
                    <span className="font-bold">{demoTilt}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="85"
                    value={demoTilt}
                    onChange={(e) => handleSliderTilt(parseInt(e.target.value, 10))}
                    className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                </div>

                {/* Slider 4: Water */}
                <div className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-zinc-500">{t.waterLabel}</span>
                    <span className="font-bold">
                      {demoWater > 650 ? `${demoWater} ${t.wetState}` : `${demoWater} ${t.dryState}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    value={demoWater}
                    onChange={(e) => handleSliderWater(parseInt(e.target.value, 10))}
                    className="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                </div>

              </div>
            </div>
          )}

        </main>
          </>
        )}

        {/* TAB 2: DEDICATED SERIAL TERMINAL, IN-BROWSER FLASHER & RAW ACTIVITY STREAM */}
        {activeTab === "serial_flash" && (
          <div className="space-y-4">
            
            {/* 1. In-Browser Arduino Nano Web Firmware Flasher Panel */}
            <div className="p-5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                      {t.flasherTitle}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t.flasherDesc}
                    </p>
                  </div>
                </div>

                {/* Target Port & Bootloader Baudrate Selector */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 font-medium">Port COM:</span>
                    <div className="flex items-center gap-1">
                      <select
                        value={selectedPort}
                        onChange={(e) => setSelectedPort(e.target.value)}
                        disabled={isFlashing || isRefreshingPorts}
                        className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-xs font-semibold focus:outline-none"
                      >
                        {availablePorts.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={refreshPorts}
                        disabled={isRefreshingPorts || isFlashing}
                        className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer transition-all"
                        title="Pindai ulang port serial USB yang terhubung"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPorts ? "animate-spin text-sky-500" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 font-medium">{t.bootloaderType}</span>
                    <select
                      value={bootloaderBaud}
                      onChange={(e) => setBootloaderBaud(parseInt(e.target.value, 10) as any)}
                      disabled={isFlashing}
                      className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-xs font-semibold focus:outline-none"
                    >
                      <option value={115200}>{t.bootloaderNew}</option>
                      <option value={57600}>{t.bootloaderOld}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload Controls & File Dropper */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-8 flex flex-col sm:flex-row items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".hex"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isFlashing}
                    className="w-full sm:w-auto px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
                  >
                    <FileCode className="w-4 h-4 text-zinc-500" />
                    <span>{t.selectHexBtn}</span>
                  </button>

                  <div className="flex-1 min-w-0 w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs">
                    {hexFile ? (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-mono font-medium truncate">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">{hexFile.name}</span>
                        <span className="text-[10px] text-zinc-400">({hexFile.bytes.length} bytes)</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 font-mono text-[11px]">
                        Belum ada file .hex yang dipilih. Export biner dari Arduino IDE (Sketch -&gt; Export Compiled Binary) lalu pilih di sini.
                      </span>
                    )}
                  </div>
                </div>

                <div className="md:col-span-4 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleFlashFirmware}
                    disabled={!hexFile || isFlashing}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                      !hexFile || isFlashing
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {isFlashing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t.flashingStatus}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>{t.startUploadBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Flashing Progress Bar */}
              {isFlashing && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{flashStep}</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">{flashProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-200"
                      style={{ width: `${flashProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Full Serial Terminal & Raw Activity Deck */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden flex flex-col">
              
              {/* Terminal Header Toolbar */}
              <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {t.rawStreamLog}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
                    {logs.length} baris
                  </span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-zinc-400 mr-1">{t.filterLogs}</span>
                  <button
                    onClick={() => setLogFilter("all")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
                      logFilter === "all"
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    {t.filterAll}
                  </button>
                  <button
                    onClick={() => setLogFilter("stream")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
                      logFilter === "stream"
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    {t.filterStream}
                  </button>
                  <button
                    onClick={() => setLogFilter("system")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
                      logFilter === "system"
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    {t.filterSystem}
                  </button>
                  <button
                    onClick={() => setLogFilter("send")}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
                      logFilter === "send"
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    {t.filterSend}
                  </button>
                </div>

                {/* Actions (Copy & Clear) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLogs}
                    className="h-7 px-2.5 flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer transition-all"
                  >
                    {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLog ? t.copied : t.copyLogs}</span>
                  </button>
                  <button
                    onClick={() => setLogs([])}
                    className="h-7 px-2.5 flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:text-rose-600 border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.clear}</span>
                  </button>
                </div>
              </div>

              {/* Telemetry Logger Sub-Bar for Tab 2 */}
              <div className="px-5 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    <FileSpreadsheet className="w-4 h-4 text-zinc-500" />
                    <span>{t.dataLoggerTitle}</span>
                  </div>
                  {isRecording ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                      <Circle className="w-2 h-2 fill-current" />
                      {t.recActive} ({formatDuration(recordDuration)})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {t.recIdle}
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-zinc-500">
                    {recordCount} {t.recordedCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {hasBackup && recordCount === 0 && (
                    <button
                      type="button"
                      onClick={restoreBackup}
                      className="h-7 px-2.5 flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs border border-zinc-700"
                    >
                      <span>{t.restoreBackup}</span>
                      <span className="text-[10px] text-zinc-400">({backupCount})</span>
                    </button>
                  )}
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="h-7 px-3 flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{t.startRec}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="h-7 px-3 flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs animate-pulse"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>{t.stopRec}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={downloadCsv}
                    disabled={recordCount === 0}
                    className={`h-7 px-2.5 flex items-center gap-1 font-bold text-xs rounded-lg border transition-all cursor-pointer ${
                      recordCount > 0
                        ? "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={copyTsv}
                    disabled={recordCount === 0}
                    title="Salin TSV (langsung paste ke Excel / Google Sheets)"
                    className={`h-7 px-2 flex items-center gap-1 text-xs rounded-lg border transition-all cursor-pointer ${
                      recordCount > 0
                        ? "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border-zinc-300 dark:border-zinc-700"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                    }`}
                  >
                    {copiedTsv ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTsv ? t.copiedTsv : "TSV"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadJson}
                    disabled={recordCount === 0}
                    title="Unduh JSON Dataset"
                    className={`h-7 px-2 flex items-center gap-1 text-xs rounded-lg border transition-all cursor-pointer ${
                      recordCount > 0
                        ? "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border-zinc-300 dark:border-zinc-700"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                    }`}
                  >
                    <FileCode className="w-3 h-3" />
                    <span>JSON</span>
                  </button>

                  {recordCount > 0 && !isRecording && (
                    <button
                      type="button"
                      onClick={clearRecords}
                      title={t.clearRec}
                      className="h-7 px-2 flex items-center text-xs text-zinc-500 hover:text-rose-600 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Log Display Window */}
              <div
                ref={logContainerRef}
                className="h-96 bg-zinc-950 text-zinc-200 p-4 overflow-y-auto font-mono text-xs space-y-1.5 select-text"
              >
                {logs
                  .filter((line) => {
                    if (logFilter === "stream") return line.includes("[KONEKSI]") || line.includes("[SIMULASI]");
                    if (logFilter === "system") return line.includes("[SISTEM]") || line.includes("[BOOT]") || line.includes("[FLASH]") || line.includes("[ERROR]") || line.includes("[INFO]");
                    if (logFilter === "send") return line.includes("[KIRIM]");
                    return true;
                  })
                  .map((line, idx) => {
                    let color = "text-zinc-300";
                    if (line.startsWith("[KIRIM]")) color = "text-sky-400 font-semibold";
                    else if (line.startsWith("[ERROR]")) color = "text-rose-400 font-bold";
                    else if (line.startsWith("[BOOT]")) color = "text-amber-400 font-semibold";
                    else if (line.startsWith("[FLASH]")) color = "text-violet-400 font-semibold";
                    else if (line.startsWith("[SISTEM]")) color = "text-emerald-400";
                    else if (line.startsWith("[KONEKSI]")) color = "text-emerald-300";
                    else if (line.startsWith("[SIMULASI]")) color = "text-purple-300";

                    return (
                      <div key={idx} className={`${color} leading-relaxed break-all`}>
                        {line}
                      </div>
                    );
                  })}
              </div>

              {/* Outbound Serial Command Bar */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2">
                <form onSubmit={handleSendCommand} className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder={t.inputPlaceholder}
                    className="flex-1 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t.send}</span>
                  </button>
                </form>

                {/* Shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => sendSerial("HELP")}
                    className="px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-[11px] font-semibold hover:border-zinc-400 cursor-pointer"
                  >
                    HELP
                  </button>
                  <button
                    type="button"
                    onClick={() => sendSerial("FALL")}
                    className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-lg font-mono text-[11px] font-semibold hover:border-rose-400 cursor-pointer"
                  >
                    FALL
                  </button>
                  <button
                    type="button"
                    onClick={() => sendSerial("DROP")}
                    className="px-2 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 rounded-lg font-mono text-[11px] font-semibold hover:border-amber-400 cursor-pointer"
                  >
                    DROP
                  </button>
                  <button
                    type="button"
                    onClick={() => sendSerial("WET")}
                    className="px-2 py-1 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-sky-600 dark:text-sky-400 rounded-lg font-mono text-[11px] font-semibold hover:border-sky-400 cursor-pointer"
                  >
                    WET
                  </button>
                  <button
                    type="button"
                    onClick={() => sendSerial("NORMAL")}
                    className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-lg font-mono text-[11px] font-semibold hover:border-emerald-400 cursor-pointer"
                  >
                    NORMAL
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}
      </div>
    </div>
  );
}
