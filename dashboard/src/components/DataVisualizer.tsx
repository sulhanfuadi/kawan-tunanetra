"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Download,
  Droplets,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  FolderArchive,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Search,
  Sliders,
  Square,
  TrendingDown,
  Upload,
  Vibrate,
  Volume2,
  Zap
} from "lucide-react";
import { TelemetryRecord, ArchivedFile } from "../app/page";

interface DataVisualizerProps {
  liveRecords: TelemetryRecord[];
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  archivedFiles: ArchivedFile[];
  t: any;
  isDark?: boolean;
}

export function parseCsvOrJsonLog(content: string, filename: string): TelemetryRecord[] {
  const trimmed = content.trim();

  // 1. Coba parsing sebagai JSON
  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          no: item.no ?? idx + 1,
          timestamp: item.timestamp ?? new Date().toISOString(),
          elapsedSec: typeof item.elapsedSec === "number" ? item.elapsedSec : idx * 0.5,
          frontCm: item.frontCm !== undefined && item.frontCm !== "" ? item.frontCm : "",
          downCm: item.downCm !== undefined && item.downCm !== "" ? item.downCm : "",
          deltaDownCm: item.deltaDownCm !== undefined && item.deltaDownCm !== "" ? item.deltaDownCm : "",
          tiltDeg: item.tiltDeg !== undefined && item.tiltDeg !== "" ? item.tiltDeg : "",
          waterVal: item.waterVal !== undefined && item.waterVal !== "" ? item.waterVal : "",
          waterCondition: item.waterCondition ?? (Number(item.waterVal) > 400 ? "BASAH" : "KERING"),
          waterBinary: item.waterBinary ?? (Number(item.waterVal) > 400 ? 1 : 0),
          state: item.state ?? "NORMAL",
          hazardCode: item.hazardCode ?? 0,
          motor: item.motor ?? "OFF",
          motorBinary: item.motorBinary ?? (item.motor === "ON" ? 1 : 0),
          buzzer: item.buzzer ?? "DIAM",
          buzzerBinary: item.buzzerBinary ?? (item.buzzer === "SOS" ? 1 : 0),
          source: item.source ?? "IMPOR_JSON"
        }));
      }
    } catch (e) {
      console.warn("Gagal parse sebagai JSON, mencoba fallback CSV:", e);
    }
  }

  // 2. Parsing sebagai CSV
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("File CSV tidak memiliki baris data (hanya header atau kosong).");
  }

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());

  const getIdx = (candidates: string[]) => {
    for (const c of candidates) {
      const idx = headers.indexOf(c.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxNo = getIdx(["no"]);
  const idxTs = getIdx(["timestamp", "waktu"]);
  const idxSec = getIdx(["detik_relatif", "elapsedsec", "sec", "detik"]);
  const idxFront = getIdx(["jarak_depan_cm", "frontcm", "depan", "front"]);
  const idxDown = getIdx(["jarak_bawah_cm", "downcm", "bawah", "down"]);
  const idxDelta = getIdx(["delta_turunan_cm", "deltadowncm", "delta"]);
  const idxTilt = getIdx(["kemiringan_mpu_deg", "tiltdeg", "tilt", "kemiringan", "sudut"]);
  const idxWater = getIdx(["sensor_air_adc", "waterval", "water", "air"]);
  const idxWaterCond = getIdx(["kondisi_air", "watercondition"]);
  const idxState = getIdx(["status_bahaya", "state", "status"]);
  const idxHazard = getIdx(["kode_bahaya_num", "hazardcode"]);
  const idxMotor = getIdx(["motor_haptik", "motor"]);
  const idxBuzzer = getIdx(["buzzer_sos", "buzzer"]);
  const idxSource = getIdx(["sumber_data", "source"]);

  const records: TelemetryRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length === 0 || (cols.length === 1 && cols[0] === "")) continue;

    const noVal = idxNo !== -1 && cols[idxNo] ? parseInt(cols[idxNo], 10) : i;
    const tsVal = idxTs !== -1 && cols[idxTs] ? cols[idxTs] : "";
    const secVal = idxSec !== -1 && cols[idxSec] ? parseFloat(cols[idxSec]) : i * 0.5;

    const frontRaw = idxFront !== -1 ? cols[idxFront] : (cols[3] ?? "");
    const downRaw = idxDown !== -1 ? cols[idxDown] : (cols[4] ?? "");
    const deltaRaw = idxDelta !== -1 ? cols[idxDelta] : (cols[5] ?? "");
    const tiltRaw = idxTilt !== -1 ? cols[idxTilt] : (cols[6] ?? "");
    const waterRaw = idxWater !== -1 ? cols[idxWater] : (cols[7] ?? "");

    const frontNum = frontRaw !== "" ? parseFloat(frontRaw) : "";
    const downNum = downRaw !== "" ? parseFloat(downRaw) : "";
    const deltaNum = deltaRaw !== "" ? parseFloat(deltaRaw) : "";
    const tiltNum = tiltRaw !== "" ? parseFloat(tiltRaw) : "";
    const waterNum = waterRaw !== "" ? parseInt(waterRaw, 10) : "";

    const waterCond = idxWaterCond !== -1 && cols[idxWaterCond]
      ? cols[idxWaterCond]
      : (typeof waterNum === "number" && waterNum > 400 ? "BASAH" : "KERING");

    const stateVal = idxState !== -1 && cols[idxState] ? cols[idxState] : "NORMAL";
    const hazardVal = idxHazard !== -1 && cols[idxHazard] ? parseInt(cols[idxHazard], 10) : 0;
    const motorVal = idxMotor !== -1 && cols[idxMotor] ? cols[idxMotor].toUpperCase() : "OFF";
    const buzzerVal = idxBuzzer !== -1 && cols[idxBuzzer] ? cols[idxBuzzer].toUpperCase() : "DIAM";
    const sourceVal = idxSource !== -1 && cols[idxSource] ? cols[idxSource] : "IMPOR_CSV";

    records.push({
      no: isNaN(noVal) ? i : noVal,
      timestamp: tsVal || new Date().toISOString(),
      elapsedSec: isNaN(secVal) ? i * 0.5 : secVal,
      frontCm: isNaN(frontNum as number) ? "" : frontNum,
      downCm: isNaN(downNum as number) ? "" : downNum,
      deltaDownCm: isNaN(deltaNum as number) ? "" : deltaNum,
      tiltDeg: isNaN(tiltNum as number) ? "" : tiltNum,
      waterVal: isNaN(waterNum as number) ? "" : waterNum,
      waterCondition: waterCond,
      waterBinary: waterCond === "BASAH" ? 1 : 0,
      state: stateVal,
      hazardCode: isNaN(hazardVal) ? 0 : hazardVal,
      motor: motorVal,
      motorBinary: motorVal === "ON" ? 1 : 0,
      buzzer: buzzerVal,
      buzzerBinary: buzzerVal === "SOS" ? 1 : 0,
      source: sourceVal
    });
  }

  if (records.length === 0) {
    throw new Error("Tidak ada data valid yang dapat dibaca dari file ini.");
  }

  return records;
}

export default function DataVisualizer({
  liveRecords,
  isRecording,
  startRecording,
  stopRecording,
  archivedFiles,
  t,
  isDark = false
}: DataVisualizerProps) {
  // Source selection state: "live" vs "imported"
  const [sourceMode, setSourceMode] = useState<"live" | "imported">("live");
  const [importedRecords, setImportedRecords] = useState<TelemetryRecord[]>([]);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isArchiveDropdownOpen, setIsArchiveDropdownOpen] = useState(false);
  const [isLoadingArchiveFile, setIsLoadingArchiveFile] = useState(false);

  // Chart configuration & filters
  const [windowRange, setWindowRange] = useState<"50" | "150" | "500" | "all">("150");
  const [activeHazardFilter, setActiveHazardFilter] = useState<string>("ALL");
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  // Table pagination & search
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const rowsPerPage = 12;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active dataset determination
  const rawDataset = useMemo(() => {
    if (sourceMode === "imported") {
      return importedRecords;
    }
    return liveRecords;
  }, [sourceMode, importedRecords, liveRecords]);

  // Windowed dataset (based on range selector)
  const displayRecords = useMemo(() => {
    if (rawDataset.length === 0) return [];
    if (windowRange === "all") return rawDataset;
    const count = parseInt(windowRange, 10);
    return rawDataset.slice(-count);
  }, [rawDataset, windowRange]);

  // Filtered dataset for table
  const filteredTableRecords = useMemo(() => {
    let list = rawDataset;
    if (activeHazardFilter !== "ALL") {
      if (activeHazardFilter === "HAZARDS_ONLY") {
        list = list.filter((r) => r.hazardCode > 0);
      } else {
        list = list.filter((r) => r.state === activeHazardFilter);
      }
    }
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.state.toLowerCase().includes(q) ||
          r.timestamp.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q) ||
          String(r.no).includes(q)
      );
    }
    return list;
  }, [rawDataset, activeHazardFilter, tableSearch]);

  const totalTablePages = Math.max(1, Math.ceil(filteredTableRecords.length / rowsPerPage));
  const paginatedTableRecords = useMemo(() => {
    const start = (tablePage - 1) * rowsPerPage;
    return filteredTableRecords.slice(start, start + rowsPerPage);
  }, [filteredTableRecords, tablePage]);

  // Calculate Metrics
  const metrics = useMemo(() => {
    if (rawDataset.length === 0) return null;

    const frontVals = rawDataset
      .map((r) => (typeof r.frontCm === "number" ? r.frontCm : parseFloat(r.frontCm as string)))
      .filter((v) => !isNaN(v) && v > 0);
    const avgFront = frontVals.length > 0 ? (frontVals.reduce((a, b) => a + b, 0) / frontVals.length).toFixed(1) : "-";
    const minFront = frontVals.length > 0 ? Math.min(...frontVals).toFixed(0) : "-";

    const downVals = rawDataset
      .map((r) => (typeof r.downCm === "number" ? r.downCm : parseFloat(r.downCm as string)))
      .filter((v) => !isNaN(v) && v > 0);
    const maxDeltaDown = rawDataset
      .map((r) => (typeof r.deltaDownCm === "number" ? r.deltaDownCm : parseFloat(r.deltaDownCm as string)))
      .filter((v) => !isNaN(v));
    const peakDelta = maxDeltaDown.length > 0 ? Math.max(...maxDeltaDown).toFixed(0) : "-";

    const tiltVals = rawDataset
      .map((r) => (typeof r.tiltDeg === "number" ? r.tiltDeg : parseFloat(r.tiltDeg as string)))
      .filter((v) => !isNaN(v));
    const avgTilt = tiltVals.length > 0 ? (tiltVals.reduce((a, b) => a + b, 0) / tiltVals.length).toFixed(1) : "-";
    const maxTilt = tiltVals.length > 0 ? Math.max(...tiltVals).toFixed(1) : "-";

    const waterVals = rawDataset
      .map((r) => (typeof r.waterVal === "number" ? r.waterVal : parseInt(r.waterVal as string, 10)))
      .filter((v) => !isNaN(v));
    const maxWater = waterVals.length > 0 ? Math.max(...waterVals) : 0;
    const wetCount = rawDataset.filter((r) => r.waterCondition === "BASAH" || Number(r.waterVal) > 400).length;
    const wetPct = ((wetCount / rawDataset.length) * 100).toFixed(0);

    const hazardCount = rawDataset.filter((r) => r.hazardCode > 0).length;
    const motorActiveCount = rawDataset.filter((r) => r.motor === "ON").length;
    const buzzerActiveCount = rawDataset.filter((r) => r.buzzer === "SOS").length;
    const motorPct = ((motorActiveCount / rawDataset.length) * 100).toFixed(0);

    const firstTime = rawDataset[0]?.elapsedSec ?? 0;
    const lastTime = rawDataset[rawDataset.length - 1]?.elapsedSec ?? 0;
    const durationSec = Math.max(0, lastTime - firstTime);
    const m = Math.floor(durationSec / 60).toString().padStart(2, "0");
    const s = Math.floor(durationSec % 60).toString().padStart(2, "0");

    // State distribution breakdown
    const stateCounts: Record<string, number> = {};
    rawDataset.forEach((r) => {
      const st = r.state || "NORMAL";
      stateCounts[st] = (stateCounts[st] || 0) + 1;
    });

    return {
      totalPoints: rawDataset.length,
      durationStr: `${m}:${s}`,
      avgFront,
      minFront,
      peakDelta,
      avgTilt,
      maxTilt,
      maxWater,
      wetPct,
      hazardCount,
      motorPct,
      buzzerActiveCount,
      stateCounts
    };
  }, [rawDataset]);

  // Handle local file import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCsvOrJsonLog(text, file.name);
        setImportedRecords(parsed);
        setImportedFileName(file.name);
        setSourceMode("imported");
        setTablePage(1);
      } catch (err: any) {
        setImportError(err.message || "Gagal memproses file log.");
      }
    };
    reader.onerror = () => {
      setImportError("Gagal membaca file dari sistem.");
    };
    reader.readAsText(file);
    // Reset file input value so same file can be reloaded if edited
    e.target.value = "";
  };

  // Load from archive API
  const handleLoadArchive = async (archiveFileName: string) => {
    setIsLoadingArchiveFile(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/archive?file=${encodeURIComponent(archiveFileName)}`);
      if (!res.ok) throw new Error("Gagal mengambil file arsip.");
      const csvText = await res.text();
      const parsed = parseCsvOrJsonLog(csvText, archiveFileName);
      setImportedRecords(parsed);
      setImportedFileName(archiveFileName);
      setSourceMode("imported");
      setIsArchiveDropdownOpen(false);
      setTablePage(1);
    } catch (err: any) {
      setImportError(err.message || "Gagal memuat file dari arsip.");
    } finally {
      setIsLoadingArchiveFile(false);
    }
  };

  // Export current visualizer dataset
  const exportCurrentDataset = () => {
    if (rawDataset.length === 0) return;
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
    const rows = [headers.join(",")];
    rawDataset.forEach((row) => {
      rows.push(
        [
          row.no,
          `"${row.timestamp}"`,
          Number(row.elapsedSec).toFixed(3),
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
        ].join(",")
      );
    });

    const csvStr = rows.join("\r\n");
    const blob = new Blob(["\uFEFF" + csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `katana_visualizer_export_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // SVG Chart Helper
  const renderSvgLineChart = (
    data: TelemetryRecord[],
    getValue: (r: TelemetryRecord) => number | null,
    options: {
      color: string;
      thresholds?: { value: number; color: string; label: string; dash?: boolean }[];
      minY?: number;
      maxY?: number;
      unit: string;
      chartId: string;
    }
  ) => {
    const width = 800;
    const height = 180;
    const padTop = 20;
    const padBottom = 26;
    const padLeft = 45;
    const padRight = 20;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    if (data.length < 2) {
      return (
        <div className="h-44 flex items-center justify-center text-xs font-mono text-zinc-400">
          Menunggu data mengalir untuk merender grafik ({data.length} poin)...
        </div>
      );
    }

    const values = data.map(getValue);
    const validValues = values.filter((v): v is number => v !== null && !isNaN(v));

    const computedMinY = options.minY !== undefined ? options.minY : (validValues.length > 0 ? Math.min(...validValues) : 0);
    const computedMaxY = options.maxY !== undefined ? options.maxY : (validValues.length > 0 ? Math.max(...validValues) : 100);
    const ySpan = Math.max(1, computedMaxY - computedMinY);

    const getX = (idx: number) => padLeft + (idx / (data.length - 1)) * plotW;
    const getY = (val: number) => padTop + plotH - ((val - computedMinY) / ySpan) * plotH;

    // Generate path points
    let pathD = "";
    let areaD = "";
    let firstValid = false;

    data.forEach((r, idx) => {
      const val = getValue(r);
      if (val === null || isNaN(val)) return;

      const x = getX(idx);
      const y = Math.max(padTop, Math.min(padTop + plotH, getY(val)));

      if (!firstValid) {
        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        areaD += `M ${x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
        firstValid = true;
      } else {
        pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        areaD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    if (firstValid) {
      const lastX = getX(data.length - 1);
      areaD += ` L ${lastX.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;
    }

    const hoveredRecord = hoveredPointIdx !== null && hoveredPointIdx < data.length ? data[hoveredPointIdx] : null;
    const hoveredVal = hoveredRecord ? getValue(hoveredRecord) : null;
    const hoveredX = hoveredPointIdx !== null ? getX(hoveredPointIdx) : null;
    const hoveredY = hoveredVal !== null ? getY(hoveredVal) : null;

    return (
      <div className="relative select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 overflow-visible"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const normX = (mouseX / rect.width) * width;
            if (normX >= padLeft && normX <= width - padRight) {
              const rel = (normX - padLeft) / plotW;
              const idx = Math.round(rel * (data.length - 1));
              setHoveredPointIdx(Math.max(0, Math.min(data.length - 1, idx)));
            }
          }}
          onMouseLeave={() => setHoveredPointIdx(null)}
        >
          {/* Subtle horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = padTop + pct * plotH;
            const valLabel = (computedMaxY - pct * ySpan).toFixed(0);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  className="stroke-zinc-200/70 dark:stroke-zinc-800/60"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-400 text-[9px] font-mono select-none"
                >
                  {valLabel}
                </text>
              </g>
            );
          })}

          {/* Threshold Lines */}
          {options.thresholds?.map((th, i) => {
            if (th.value < computedMinY || th.value > computedMaxY) return null;
            const thY = getY(th.value);
            return (
              <g key={`th-${i}`}>
                <line
                  x1={padLeft}
                  y1={thY}
                  x2={width - padRight}
                  y2={thY}
                  stroke={th.color}
                  strokeWidth="1.5"
                  strokeDasharray={th.dash !== false ? "4 3" : undefined}
                />
                <text
                  x={width - padRight}
                  y={thY - 4}
                  textAnchor="end"
                  fill={th.color}
                  className="text-[8px] font-mono font-bold uppercase select-none"
                >
                  {th.label} ({th.value})
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaD && (
            <path
              d={areaD}
              fill={options.color}
              fillOpacity="0.08"
              className="pointer-events-none transition-all duration-150"
            />
          )}

          {/* Main Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={options.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none transition-all duration-150"
            />
          )}

          {/* Interactive Crosshair & Point */}
          {hoveredX !== null && hoveredY !== null && (
            <g className="pointer-events-none">
              <line
                x1={hoveredX}
                y1={padTop}
                x2={hoveredX}
                y2={padTop + plotH}
                className="stroke-zinc-400 dark:stroke-zinc-500"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoveredX}
                cy={hoveredY}
                r="4.5"
                fill={options.color}
                className="stroke-white dark:stroke-zinc-950"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X-axis time marks */}
          <text
            x={padLeft}
            y={height - 6}
            className="fill-zinc-400 text-[9px] font-mono select-none"
          >
            T=0s
          </text>
          <text
            x={width - padRight}
            y={height - 6}
            textAnchor="end"
            className="fill-zinc-400 text-[9px] font-mono select-none"
          >
            T={data[data.length - 1]?.elapsedSec?.toFixed(1) ?? "0"}s
          </text>
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPointIdx !== null && hoveredRecord && hoveredVal !== null && (
          <div
            className="absolute top-1 right-3 px-2 py-1 rounded bg-zinc-900/90 dark:bg-white/90 text-white dark:text-zinc-900 text-[10px] font-mono pointer-events-none shadow-md backdrop-blur-xs flex items-center gap-2 border border-zinc-700/50"
          >
            <span className="font-bold">
              #{hoveredRecord.no} (T+{hoveredRecord.elapsedSec.toFixed(1)}s):
            </span>
            <span className="font-extrabold" style={{ color: options.color }}>
              {hoveredVal.toFixed(1)} {options.unit}
            </span>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-600">
              [{hoveredRecord.state}]
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Command Deck for Data Visualizer */}
      <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 shrink-0">
              <BarChart3 className="w-4 h-4 text-sky-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">
                  Katana Telemetry Data Visualizer
                </h3>
                {sourceMode === "live" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE SESSION
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <FileText className="w-2.5 h-2.5" />
                    TERIMPOR: {importedFileName || "File Eksternal"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Visualisasi analitik multi-kanal dari perekaman telemetri tongkat Katana
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden Input for File Import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="hidden"
            />

            {sourceMode === "imported" && (
              <button
                type="button"
                onClick={() => {
                  setSourceMode("live");
                  setImportedFileName(null);
                  setImportedRecords([]);
                }}
                className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-mono font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                title="Kembali menampilkan log sesi berjalan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kembali ke Live</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-bold bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 transition-colors cursor-pointer shadow-2xs"
              title="Unggah file log CSV / JSON dari komputer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Impor Log File</span>
            </button>

            {/* Archive Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsArchiveDropdownOpen((prev) => !prev)}
                className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 transition-colors cursor-pointer"
                title="Pilih rekaman dari folder arsip lokal"
              >
                <FolderArchive className="w-3.5 h-3.5 text-zinc-500" />
                <span>Buka Arsip ({archivedFiles.length})</span>
              </button>

              {isArchiveDropdownOpen && (
                <div className="absolute right-0 mt-1 w-72 max-h-60 overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 p-1 space-y-1">
                  <div className="px-2.5 py-1.5 text-[10px] font-mono font-bold text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                    ARSIP TERSIMPAN DI KATANA/ARCHIVE:
                  </div>
                  {archivedFiles.length === 0 ? (
                    <div className="p-3 text-[11px] text-zinc-400 text-center">
                      Belum ada file arsip rekaman.
                    </div>
                  ) : (
                    archivedFiles.map((f) => (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() => handleLoadArchive(f.name)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-between group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-mono text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-sky-500">
                            {f.name}
                          </div>
                          <div className="text-[9px] text-zinc-400">
                            {f.rowCount} baris // {f.sizeKb} KB
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={exportCurrentDataset}
              disabled={rawDataset.length === 0}
              className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                rawDataset.length > 0
                  ? "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border-zinc-300 dark:border-zinc-700"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
              }`}
              title="Unduh dataset yang sedang divisualisasikan sebagai CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor</span>
            </button>
          </div>
        </div>

        {/* Error notification if import fails */}
        {importError && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <span>[ERROR] {importError}</span>
            <button
              onClick={() => setImportError(null)}
              className="text-[10px] font-bold underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Data Range and Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400">Rentang Tampilan:</span>
            {(["50", "150", "500", "all"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setWindowRange(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                  windowRange === r
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {r === "all" ? "Semua" : `${r} Poin`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400">Filter Status:</span>
            <select
              value={activeHazardFilter}
              onChange={(e) => {
                setActiveHazardFilter(e.target.value);
                setTablePage(1);
              }}
              className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[11px] font-mono border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            >
              <option value="ALL">Semua Kondisi</option>
              <option value="HAZARDS_ONLY">Hanya Pemicu Bahaya</option>
              <option value="NORMAL">NORMAL</option>
              <option value="OBJEK_DEKAT">OBJEK_DEKAT</option>
              <option value="OBJEK_SEDANG">OBJEK_SEDANG</option>
              <option value="OBJEK_WASPADA">OBJEK_WASPADA</option>
              <option value="TEPI_TURUNAN">TEPI_TURUNAN</option>
              <option value="PERMUKAAN_BASAH">PERMUKAAN_BASAH</option>
              <option value="TONGKAT_JATUH">TONGKAT_JATUH</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Top KPI Summary Cards */}
      {metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* KPI 1 */}
          <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase font-semibold">Total Data</span>
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {metrics.totalPoints}
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              Durasi: {metrics.durationStr}
            </div>
          </div>

          {/* KPI 2 */}
          <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase font-semibold">Jarak Depan</span>
              <Eye className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {metrics.avgFront} <span className="text-xs text-zinc-400 font-normal">cm</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              Terdekat: <span className="font-bold text-rose-500">{metrics.minFront} cm</span>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase font-semibold">Turunan (Δ)</span>
              <TrendingDown className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              +{metrics.peakDelta} <span className="text-xs text-zinc-400 font-normal">cm</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              Batas Kritis: &gt;15 cm
            </div>
          </div>

          {/* KPI 4 */}
          <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase font-semibold">Kemiringan MPU</span>
              <Compass className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {metrics.maxTilt}°
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              Rata-rata: {metrics.avgTilt}°
            </div>
          </div>

          {/* KPI 5 */}
          <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase font-semibold">Sensor Air</span>
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {metrics.maxWater} <span className="text-xs text-zinc-400 font-normal">ADC</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              Kondisi Basah: {metrics.wetPct}%
            </div>
          </div>

          {/* KPI 6 */}
          <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase font-semibold">Pemicu Bahaya</span>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
              {metrics.hazardCount}
            </div>
            <div className="text-[10px] font-mono text-zinc-500">
              Motor Aktif: {metrics.motorPct}%
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 font-mono text-xs">
          Belum ada data rekaman pada sesi ini. Hubungkan Arduino atau klik "Mulai Rekam" pada tab Monitor.
        </div>
      )}

      {/* 3. Multi-Channel Sensor Timeline Charts */}
      {displayRecords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Proximity HC-SR04 Depan */}
          <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  1. Jarak Rintangan Depan (cm)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                Ambang Bahaya &lt;30cm // Waspada &lt;60cm
              </span>
            </div>
            {renderSvgLineChart(
              displayRecords,
              (r) => (typeof r.frontCm === "number" ? r.frontCm : parseFloat(r.frontCm as string)),
              {
                color: "#10b981",
                minY: 0,
                maxY: 160,
                unit: "cm",
                chartId: "front_chart",
                thresholds: [
                  { value: 30, color: "#ef4444", label: "Bahaya <30" },
                  { value: 60, color: "#f59e0b", label: "Waspada <60" }
                ]
              }
            )}
          </div>

          {/* Chart 2: Step-Drop HC-SR04 Bawah */}
          <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-sky-500" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  2. Delta Turunan / Lubang Jalan (cm)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                Ambang Jatuh/Turunan &gt;15cm
              </span>
            </div>
            {renderSvgLineChart(
              displayRecords,
              (r) => (typeof r.deltaDownCm === "number" ? r.deltaDownCm : parseFloat(r.deltaDownCm as string)),
              {
                color: "#0284c7",
                minY: 0,
                maxY: 45,
                unit: "cm delta",
                chartId: "down_chart",
                thresholds: [
                  { value: 15, color: "#ef4444", label: "Turunan >15" }
                ]
              }
            )}
          </div>

          {/* Chart 3: IMU MPU6050 Cane Tilt Angle */}
          <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  3. Kemiringan Tongkat MPU6050 (Derajat)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                Ambang Alarm SOS &gt;30°
              </span>
            </div>
            {renderSvgLineChart(
              displayRecords,
              (r) => (typeof r.tiltDeg === "number" ? r.tiltDeg : parseFloat(r.tiltDeg as string)),
              {
                color: "#8b5cf6",
                minY: 0,
                maxY: 90,
                unit: "°",
                chartId: "tilt_chart",
                thresholds: [
                  { value: 30, color: "#ef4444", label: "Alarm SOS >30°" }
                ]
              }
            )}
          </div>

          {/* Chart 4: Water Conductivity ADC */}
          <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  4. Sensor Air / Genangan (Nilai ADC 0-1023)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                Ambang Basah &gt;400 ADC
              </span>
            </div>
            {renderSvgLineChart(
              displayRecords,
              (r) => (typeof r.waterVal === "number" ? r.waterVal : parseInt(r.waterVal as string, 10)),
              {
                color: "#3b82f6",
                minY: 0,
                maxY: 1023,
                unit: "ADC",
                chartId: "water_chart",
                thresholds: [
                  { value: 400, color: "#3b82f6", label: "Basah >400" }
                ]
              }
            )}
          </div>
        </div>
      )}

      {/* 4. Actuator Timeline Ribbon & Event Distribution */}
      {metrics && displayRecords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Actuator Active Duty Cycle Ribbon */}
          <div className="lg:col-span-2 p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  Pita Waktu Aktivitas Aktuator (Timeline Ribbon)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                Status Haptik & Buzzer per Titik Waktu
              </span>
            </div>

            {/* Motor Timeline Track */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span className="flex items-center gap-1 font-bold">
                  <Vibrate className="w-3 h-3 text-amber-500" /> Motor Haptik (D5 PWM)
                </span>
                <span>{metrics.motorPct}% Aktif</span>
              </div>
              <div className="h-5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-md overflow-hidden flex">
                {displayRecords.map((r, i) => (
                  <div
                    key={`mot-${i}`}
                    className={`h-full flex-1 transition-opacity ${
                      r.motor === "ON"
                        ? "bg-amber-500 hover:opacity-100"
                        : "bg-transparent opacity-0"
                    }`}
                    title={`#${r.no} (T+${r.elapsedSec.toFixed(1)}s): Motor ${r.motor}`}
                  />
                ))}
              </div>
            </div>

            {/* Buzzer SOS Timeline Track */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span className="flex items-center gap-1 font-bold">
                  <Volume2 className="w-3 h-3 text-rose-500" /> Buzzer Alarm SOS (D6)
                </span>
                <span>{metrics.buzzerActiveCount} Kali Berbunyi</span>
              </div>
              <div className="h-5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-md overflow-hidden flex">
                {displayRecords.map((r, i) => (
                  <div
                    key={`buz-${i}`}
                    className={`h-full flex-1 transition-opacity ${
                      r.buzzer === "SOS"
                        ? "bg-rose-500 hover:opacity-100"
                        : "bg-transparent opacity-0"
                    }`}
                    title={`#${r.no} (T+${r.elapsedSec.toFixed(1)}s): Buzzer ${r.buzzer}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Hazard State Distribution */}
          <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              Distribusi Status Sistem
            </h4>

            <div className="space-y-2 text-xs font-mono">
              {Object.entries(metrics.stateCounts).map(([st, cnt]) => {
                const pct = ((cnt / metrics.totalPoints) * 100).toFixed(1);
                let colorClass = "bg-zinc-500";
                if (st === "NORMAL") colorClass = "bg-emerald-500";
                else if (st === "OBJEK_DEKAT") colorClass = "bg-rose-500";
                else if (st === "OBJEK_SEDANG") colorClass = "bg-amber-500";
                else if (st === "OBJEK_WASPADA") colorClass = "bg-yellow-500";
                else if (st === "TEPI_TURUNAN") colorClass = "bg-sky-500";
                else if (st === "PERMUKAAN_BASAH") colorClass = "bg-blue-500";
                else if (st === "TONGKAT_JATUH") colorClass = "bg-purple-600";

                return (
                  <div key={st} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {st}
                      </span>
                      <span className="text-zinc-400">
                        {cnt} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colorClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. Detailed Telemetry Record Table */}
      <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-zinc-500" />
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              Tabel Rekaman Telemetri ({filteredTableRecords.length} Baris)
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari status / waktu..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setTablePage(1);
                }}
                className="h-7 pl-8 pr-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 font-mono border border-zinc-200 dark:border-zinc-800 focus:outline-hidden w-48"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-[11px] font-mono text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase text-[9px] font-bold">
              <tr>
                <th className="px-3 py-2">No</th>
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2">Detik</th>
                <th className="px-3 py-2">Depan</th>
                <th className="px-3 py-2">Bawah</th>
                <th className="px-3 py-2">Delta</th>
                <th className="px-3 py-2">Sudut MPU</th>
                <th className="px-3 py-2">Air ADC</th>
                <th className="px-3 py-2">Status Bahaya</th>
                <th className="px-3 py-2">Motor</th>
                <th className="px-3 py-2">Buzzer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
              {paginatedTableRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-zinc-400">
                    Tidak ada data yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                paginatedTableRecords.map((r) => {
                  const isHazard = r.hazardCode > 0;
                  return (
                    <tr
                      key={r.no}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors ${
                        isHazard ? "bg-rose-500/5" : ""
                      }`}
                    >
                      <td className="px-3 py-1.5 font-bold text-zinc-500">#{r.no}</td>
                      <td className="px-3 py-1.5 text-zinc-400 truncate max-w-[130px]" title={r.timestamp}>
                        {r.timestamp.split(" ")[1] || r.timestamp}
                      </td>
                      <td className="px-3 py-1.5 text-zinc-500">
                        {typeof r.elapsedSec === "number" ? r.elapsedSec.toFixed(2) : r.elapsedSec}s
                      </td>
                      <td className="px-3 py-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                        {r.frontCm !== "" ? `${r.frontCm} cm` : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                        {r.downCm !== "" ? `${r.downCm} cm` : "-"}
                      </td>
                      <td className="px-3 py-1.5 font-semibold text-sky-600 dark:text-sky-400">
                        {r.deltaDownCm !== "" ? `+${r.deltaDownCm} cm` : "-"}
                      </td>
                      <td className="px-3 py-1.5 font-bold text-purple-600 dark:text-purple-400">
                        {r.tiltDeg !== "" ? `${Number(r.tiltDeg).toFixed(1)}°` : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-blue-600 dark:text-blue-400">
                        {r.waterVal !== "" ? `${r.waterVal} (${r.waterCondition})` : "-"}
                      </td>
                      <td className="px-3 py-1.5 font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] ${
                            isHazard
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                              : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {r.state}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-bold">
                        {r.motor === "ON" ? (
                          <span className="text-amber-600 dark:text-amber-400">ON</span>
                        ) : (
                          <span className="text-zinc-400">OFF</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-bold">
                        {r.buzzer === "SOS" ? (
                          <span className="text-rose-600 dark:text-rose-400">SOS</span>
                        ) : (
                          <span className="text-zinc-400">DIAM</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalTablePages > 1 && (
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pt-1">
            <div>
              Halaman {tablePage} dari {totalTablePages} ({filteredTableRecords.length} entri)
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                disabled={tablePage === totalTablePages}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
