"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Tooltip, Legend,
} from "chart.js";
import {
  Upload, Play, Download, RefreshCw, X,
  FileSpreadsheet, CheckCircle, AlertCircle,
  ChevronLeft, ChevronRight, Database, Layers, HardDrive,
} from "lucide-react";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement,
  Tooltip, Legend
);

const KPI_API_BASE = "https://kpi-fastapi-git-main-vijaytanz12-2825s-projects.vercel.app";

const CHART_COLORS = [
  "rgba(59,130,246,0.75)", "rgba(16,185,129,0.75)", "rgba(245,158,11,0.75)",
  "rgba(239,68,68,0.75)", "rgba(139,92,246,0.75)", "rgba(236,72,153,0.75)",
];
const CHART_BORDERS = [
  "rgb(59,130,246)", "rgb(16,185,129)", "rgb(245,158,11)",
  "rgb(239,68,68)", "rgb(139,92,246)", "rgb(236,72,153)",
];

interface PreviewRow { [key: string]: unknown }
interface UploadResponse {
  job_id: string;
  preview?: { columns: string[]; data: string[][] } | PreviewRow[];
  [key: string]: unknown;
}
interface KpiItem {
  name: string;
  logic: string;
  inputs: string[];
  columns: string[];
  rows: string[][];
}
interface KpiResponse {
  job_id?: string;
  kpis?: KpiItem[];
  [key: string]: unknown;
}
interface HistoryItem {
  jobId: string;
  filename: string;
  uploadedAt: string;
}

type Step = "idle" | "uploaded" | "done";
type ResultSource = "pipeline" | "db" | null;

export default function KpiUpdates() {
  // History
  const [uploadHistory, setUploadHistory] = useState<HistoryItem[]>([]);

  // Modal visibility
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isTablesModalOpen, setIsTablesModalOpen] = useState(false);

  // Tables state
  const [tablesList, setTablesList] = useState<unknown[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Pipeline state
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [kpiResults, setKpiResults] = useState<KpiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [resultSource, setResultSource] = useState<ResultSource>(null);
  const [dbTableName, setDbTableName] = useState<string | null>(null);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveDbSuccess, setSaveDbSuccess] = useState(false);

  const [showTopBtn, setShowTopBtn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiHeaders = { "ngrok-skip-browser-warning": "true" };

  // Scroll-to-top button visibility
  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kpi_upload_history");
      if (stored) setUploadHistory(JSON.parse(stored));
    } catch {}
  }, []);

  const addToHistory = (item: HistoryItem) => {
    setUploadHistory(prev => {
      const updated = [item, ...prev.filter(h => h.jobId !== item.jobId)].slice(0, 8);
      localStorage.setItem("kpi_upload_history", JSON.stringify(updated));
      return updated;
    });
  };

  // ─── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  // ─── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(`${KPI_API_BASE}/api/upload/`, {
        method: "POST", headers: apiHeaders, body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status}): ${res.statusText}`);
      const data: UploadResponse = await res.json();
      addToHistory({ jobId: data.job_id, filename: selectedFile.name, uploadedAt: new Date().toISOString() });
      setJobId(data.job_id);
      setUploadResponse(data);
      setResultSource("pipeline");
      setStep("uploaded");
      setIsUploadModalOpen(false);
      setSelectedFile(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Run Pipeline ──────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!jobId) return;
    setIsRunning(true); setError(null);
    try {
      const res = await fetch(`${KPI_API_BASE}/api/run/?job_id=${jobId}`, {
        method: "POST", headers: apiHeaders,
      });
      if (!res.ok) throw new Error(`Run failed (${res.status}): ${res.statusText}`);
      const data: KpiResponse = await res.json();
      setKpiResults(data);
      setCurrentSlide(0);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setIsRunning(false);
    }
  };

  // ─── Download ──────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!jobId) return;
    setError(null);
    try {
      const res = await fetch(`${KPI_API_BASE}/api/download/?job_id=${jobId}`, { headers: apiHeaders });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `kpi_results_${jobId}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  // ─── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep("idle"); setJobId(null); setUploadResponse(null);
    setKpiResults(null); setSelectedFile(null); setError(null);
    setCurrentSlide(0); setResultSource(null); setDbTableName(null);
    setIsSavingDb(false); setSaveDbSuccess(false);
  };

  // ─── Save to DB ────────────────────────────────────────────────────────────
  const handleSaveDb = async () => {
    const saveId = jobId ?? String(kpiResults?.job_id ?? "");
    if (!saveId) return;
    setIsSavingDb(true); setError(null); setSaveDbSuccess(false);
    try {
      const res = await fetch(`${KPI_API_BASE}/api/save-db/?job_id=${encodeURIComponent(saveId)}`, {
        method: "POST", headers: apiHeaders,
      });
      if (!res.ok) throw new Error(`Save to DB failed (${res.status}): ${res.statusText}`);
      setSaveDbSuccess(true);
      setTimeout(() => setSaveDbSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save to DB failed");
    } finally {
      setIsSavingDb(false);
    }
  };

  // ─── List Tables ───────────────────────────────────────────────────────────
  const handleOpenTables = async () => {
    setIsTablesModalOpen(true);
    setIsLoadingTables(true);
    setError(null);
    try {
      const res = await fetch(`${KPI_API_BASE}/api/tables/`, { headers: apiHeaders });
      if (!res.ok) throw new Error(`Failed to fetch tables (${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.tables || data.table_names || []);
      setTablesList(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch tables");
    } finally {
      setIsLoadingTables(false);
    }
  };

  // ─── Load DB ───────────────────────────────────────────────────────────────
  const handleLoadDb = async (tableName: string) => {
    setIsLoadingDb(tableName);
    setError(null);
    try {
      const res = await fetch(`${KPI_API_BASE}/api/db-load/`, {
        method: "POST",
        headers: { ...apiHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ table_name: tableName }),
      });
      if (!res.ok) throw new Error(`DB load failed (${res.status}): ${res.statusText}`);
      const data: KpiResponse = await res.json();
      setKpiResults(data);
      setCurrentSlide(0);
      setStep("done");
      setResultSource("db");
      setDbTableName(tableName);
      setIsTablesModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "DB load failed");
    } finally {
      setIsLoadingDb(null);
    }
  };

  // Use a previous upload from history
  const handleUseHistory = (item: HistoryItem) => {
    setJobId(item.jobId);
    setUploadResponse({ job_id: item.jobId });
    setResultSource("pipeline");
    setStep("uploaded");
    setIsUploadModalOpen(false);
  };

  // Get display name from a table list item
  const getTableName = (item: unknown): string => {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      return String(obj.table_name || obj.name || obj.tableName || JSON.stringify(item));
    }
    return String(item);
  };

  // ─── Data helpers ──────────────────────────────────────────────────────────
  const getPreview = () => {
    if (!uploadResponse) return null;
    const p = uploadResponse.preview;
    if (!p) return null;
    if (Array.isArray(p) && p.length > 0) {
      const cols = Object.keys(p[0] as object);
      const rows = (p as PreviewRow[]).map(r => cols.map(c => String(r[c] ?? "")));
      return { columns: cols, data: rows };
    }
    if (!Array.isArray(p) && (p as { columns?: string[] }).columns)
      return p as { columns: string[]; data: string[][] };
    return null;
  };

  const getKpiItems = (): KpiItem[] => {
    if (!kpiResults) return [];

    // ── db-load shape: { table_name, data: { columns: [...], rows: [...] } }
    if (
      kpiResults.data &&
      typeof kpiResults.data === "object" &&
      !Array.isArray(kpiResults.data)
    ) {
      const d = kpiResults.data as Record<string, unknown>;

      // { data: { kpis: [...] } } — pipeline shape
      if (Array.isArray(d.kpis)) return d.kpis as KpiItem[];

      // { data: { columns, rows } } — db-load flat shape
      if (Array.isArray(d.columns) && Array.isArray(d.rows)) {
        return [{
          name: String(kpiResults.table_name ?? kpiResults.job_id ?? "Result"),
          logic: "",
          inputs: [],
          columns: d.columns as string[],
          rows: d.rows as string[][],
        }];
      }
    }

    // ── pipeline top-level kpis array
    if (Array.isArray(kpiResults.kpis)) return kpiResults.kpis as KpiItem[];

    // ── top-level columns/rows fallback
    if (Array.isArray(kpiResults.columns) && Array.isArray(kpiResults.rows))
      return [kpiResults as unknown as KpiItem];

    // ── find any nested array of objects
    const arrayEntry = Object.values(kpiResults).find(
      v => Array.isArray(v) && (v as unknown[]).length > 0 && typeof (v as unknown[])[0] === "object"
    );
    if (arrayEntry) return arrayEntry as KpiItem[];

    return [];
  };

  const getChartBase = (kpi: KpiItem) => {
    if (!kpi.rows?.length) return null;
    const cols = kpi.columns ?? [];
    const numCols = kpi.rows[0]?.length ?? 0;
    if (numCols === 0) return null;

    // Detect which column indices contain numeric data (sample first 5 rows)
    const isNumericCol = (idx: number) => {
      const sample = kpi.rows.slice(0, 5);
      const hits = sample.filter(r => {
        const v = r[idx];
        return v !== null && v !== undefined && v !== "" && !isNaN(parseFloat(String(v)));
      });
      return hits.length >= Math.ceil(sample.length / 2);
    };

    if (numCols === 1) {
      return {
        labels: kpi.rows.map((_, i) => String(i + 1)),
        valueArrays: [kpi.rows.map(r => parseFloat(String(r[0])) || 0)],
        colNames: [cols[0] ?? "Value"],
      };
    }

    // Use first column as X-axis labels (truncated)
    const labels = kpi.rows.map(r => String(r[0] ?? "").slice(0, 10));

    // Find numeric column indices among the rest, limit to 5 datasets
    const numericIdx: number[] = [];
    for (let i = 1; i < numCols && numericIdx.length < 5; i++) {
      if (isNumericCol(i)) numericIdx.push(i);
    }

    // Fallback: use all remaining cols if none detected as numeric
    const useIdx = numericIdx.length > 0
      ? numericIdx
      : Array.from({ length: Math.min(numCols - 1, 5) }, (_, i) => i + 1);

    return {
      labels,
      valueArrays: useIdx.map(i => kpi.rows.map(r => parseFloat(String(r[i] ?? "0")) || 0)),
      colNames: useIdx.map(i => cols[i] ?? `Col ${i + 1}`),
    };
  };

  // ── Aggregate helper: group by label, sum numeric columns, keep top N ──────
  const aggregateBase = (base: ReturnType<typeof getChartBase>, topN = 20) => {
    if (!base) return null;
    if (base.labels.length <= topN) return base;
    // Sum values per unique label
    const map = new Map<string, number[]>();
    base.labels.forEach((lbl, i) => {
      const key = String(lbl);
      const existing = map.get(key) ?? new Array(base.valueArrays.length).fill(0);
      map.set(key, existing.map((v, di) => v + (base.valueArrays[di][i] ?? 0)));
    });
    // Sort by sum of all datasets descending, keep topN
    const sorted = [...map.entries()].sort(
      (a, b) => b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0)
    ).slice(0, topN);
    return {
      labels: sorted.map(([k]) => k),
      valueArrays: base.valueArrays.map((_, di) => sorted.map(([, vals]) => vals[di] ?? 0)),
      colNames: base.colNames,
    };
  };

  // ── Sample helper: evenly sample N points from a long series ───────────────
  const sampleBase = (base: ReturnType<typeof getChartBase>, maxPts = 60) => {
    if (!base || base.labels.length <= maxPts) return base;
    const step = Math.ceil(base.labels.length / maxPts);
    const idxs = Array.from({ length: Math.ceil(base.labels.length / step) }, (_, i) => i * step);
    return {
      labels: idxs.map(i => base.labels[i]),
      valueArrays: base.valueArrays.map(arr => idxs.map(i => arr[i] ?? 0)),
      colNames: base.colNames,
    };
  };

  const buildBarData = (kpi: KpiItem) => {
    const raw = getChartBase(kpi);
    const base = aggregateBase(raw, 20);   // top-20 aggregated bar chart
    if (!base) return null;
    return {
      labels: base.labels,
      datasets: base.colNames.map((col, i) => ({
        label: col,
        data: base.valueArrays[i],
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
        borderColor: CHART_BORDERS[i % CHART_BORDERS.length],
        borderWidth: 1, borderRadius: 5,
      })),
    };
  };

  const buildLineData = (kpi: KpiItem) => {
    const raw = getChartBase(kpi);
    const base = sampleBase(raw, 60);      // sampled line chart
    if (!base) return null;
    return {
      labels: base.labels,
      datasets: base.colNames.map((col, i) => ({
        label: col,
        data: base.valueArrays[i],
        borderColor: CHART_BORDERS[i % CHART_BORDERS.length],
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
        borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false,
      })),
    };
  };

  const buildPieData = (kpi: KpiItem) => {
    const raw = getChartBase(kpi);
    const base = aggregateBase(raw, 10);   // top-10 for pie
    if (!base) return null;
    return {
      labels: base.labels,
      datasets: [{
        label: base.colNames[0],
        data: base.valueArrays[0],
        backgroundColor: base.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: base.labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]),
        borderWidth: 2,
      }],
    };
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
      tooltip: { bodyFont: { size: 11 }, titleFont: { size: 11 } },
    },
    scales: {
      x: { ticks: { font: { size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
      y: { ticks: { font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.05)" } },
    },
  };

  const preview = getPreview();
  const kpiItems = getKpiItems();
  const total = kpiItems.length;

  // Pipeline step index: 0=Upload, 1=Run, 2=View
  const pipelineStepIndex = step === "uploaded" ? 1 : step === "done" ? 2 : 0;
  const pipelineSteps = ["Upload File", "Run Pipeline", "View KPIs"];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-800">KPI Updates</h2>
          <p className="text-xs text-gray-500 mt-0.5">Upload data or load from database → view & download KPI results</p>
        </div>
        {step !== "idle" && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* ── Step progress (pipeline path only) ── */}
      {step !== "idle" && resultSource === "pipeline" && (
        <div className="flex items-center mb-6">
          {pipelineSteps.map((label, i) => {
            const isPast = i < pipelineStepIndex;
            const isCurrent = i === pipelineStepIndex;
            return (
              <React.Fragment key={label}>
                {i > 0 && <div className={`flex-1 h-0.5 mx-2 ${isPast || isCurrent ? "bg-blue-400" : "bg-gray-200"}`} />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${isCurrent ? "bg-blue-600 text-white border-blue-600" : isPast ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${isCurrent ? "bg-white text-blue-600" : isPast ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                    {isPast ? "✓" : i + 1}
                  </span>
                  {label}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── DB source badge ── */}
      {step !== "idle" && resultSource === "db" && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
          <Database className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-medium text-emerald-700">
            Loaded from table: <span className="font-mono font-bold">{dbTableName}</span>
          </span>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          IDLE: Two entry-point buttons
      ════════════════════════════════════════════════════════════════════════ */}
      {step === "idle" && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-14 text-center">
          <Layers className="w-14 h-14 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-600 mb-1">Choose your data source</p>
          <p className="text-xs text-gray-400 mb-8">Upload a file or load directly from database</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" /> Upload File
            </button>
            <button
              onClick={handleOpenTables}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Database className="w-4 h-4" /> List Tables
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          UPLOADED: File uploaded card + Run Pipeline (pipeline path)
      ════════════════════════════════════════════════════════════════════════ */}
      {step === "uploaded" && resultSource === "pipeline" && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-700">File Uploaded Successfully</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono">Job ID: {jobId}</span>
            </div>
            <button onClick={() => setIsUploadModalOpen(true)} className="text-xs text-blue-600 hover:underline flex-shrink-0">Re-upload</button>
          </div>

          {preview && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Data Preview</p>
              <div className="overflow-auto max-h-40 border border-gray-200 rounded-lg" style={{ scrollbarWidth: "thin", scrollbarColor: "#313b96 #f1f1f1" }}>
                <table className="min-w-full text-xs border-collapse">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>{preview.columns.map(c => <th key={c} className="px-3 py-1.5 text-left font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.data?.slice(0, 8).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        {row.map((cell, j) => <td key={j} className="px-3 py-1 border-b border-gray-100 text-gray-700 whitespace-nowrap">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isRunning
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running Pipeline...</>
              : <><Play className="w-4 h-4" /> Run Pipeline</>}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          DONE: KPI Slide View (shared for both pipeline & db)
      ════════════════════════════════════════════════════════════════════════ */}
      {step === "done" && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {/* Results toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              KPI Results
              {total > 0 && <span className="text-xs text-gray-400 font-normal">({total} KPIs)</span>}
            </h3>
            <div className="flex items-center gap-2">
              {/* ← Back to List Tables — db source */}
              {resultSource === "db" && (
                <button
                  onClick={handleOpenTables}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                >
                  ← Back to Tables
                </button>
              )}
              {/* List Tables shortcut — pipeline source */}
              {resultSource === "pipeline" && (
                <button
                  onClick={handleOpenTables}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Database className="w-3 h-3" /> List Tables
                </button>
              )}
              {/* Save to DB — pipeline source (has job_id) */}
              {(() => {
                const saveId = jobId ?? String(kpiResults?.job_id ?? "");
                if (!saveId) return null;
                return (
                  <button
                    onClick={handleSaveDb}
                    disabled={isSavingDb || saveDbSuccess}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      saveDbSuccess
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300 cursor-default"
                        : "text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
                    }`}
                  >
                    {isSavingDb
                      ? <><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</>
                      : saveDbSuccess
                      ? <><CheckCircle className="w-3 h-3" /> Saved to DB</>
                      : <><HardDrive className="w-3 h-3" /> Save to DB</>}
                  </button>
                );
              })()}
              {/* Download — pipeline source */}
              {resultSource === "pipeline" && jobId && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                >
                  <Download className="w-3 h-3" /> Download Excel
                </button>
              )}
            </div>
          </div>

          {total === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">No KPI data returned.</p>
          ) : (
            <>
              {/* Slide header: name + navigation */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {kpiItems[currentSlide]?.name?.replace(/_/g, " ")}
                  </p>
                  {kpiItems[currentSlide]?.logic && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{kpiItems[currentSlide].logic}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <div className="hidden sm:flex flex-wrap gap-1 max-w-xs">
                    {kpiItems[currentSlide]?.inputs?.map(inp => (
                      <span key={inp} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">{inp}</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{currentSlide + 1} / {total}</span>
                  <button onClick={() => setCurrentSlide(s => Math.max(0, s - 1))} disabled={currentSlide === 0} className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setCurrentSlide(s => Math.min(total - 1, s + 1))} disabled={currentSlide === total - 1} className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Data table + 3 charts */}
              {(() => {
                const kpi = kpiItems[currentSlide];
                const barData  = buildBarData(kpi);
                const lineData = buildLineData(kpi);

                // Pie chart: aggregate top 10 labels by sum of first numeric column
                const buildAggPie = () => {
                  const base = (() => {
                    const b = buildPieData(kpi);
                    return b;
                  })();
                  if (!base) return null;
                  const raw = base.labels.map((lbl, i) => ({ lbl, val: base.datasets[0].data[i] as number }));
                  if (raw.length <= 12) return base;
                  // Aggregate: sort by value desc, keep top 9, rest → "Others"
                  const sorted = [...raw].sort((a, b) => b.val - a.val);
                  const top = sorted.slice(0, 9);
                  const othersVal = sorted.slice(9).reduce((s, x) => s + x.val, 0);
                  const aggLabels = [...top.map(x => x.lbl), "Others"];
                  const aggData   = [...top.map(x => x.val), othersVal];
                  return {
                    labels: aggLabels,
                    datasets: [{
                      ...base.datasets[0],
                      data: aggData,
                      backgroundColor: aggLabels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
                      borderColor: aggLabels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length]),
                    }],
                  };
                };
                const pieData = buildAggPie();

                return (
                  <>
                    {/* Data table */}
                    <div className="overflow-auto border-b border-gray-100" style={{ maxHeight: 200, scrollbarWidth: "thin", scrollbarColor: "#313b96 #f1f1f1" }}>
                      <table className="min-w-full text-xs border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-400 border-b border-gray-200 w-8">#</th>
                            {kpi?.columns?.map(c => (
                              <th key={c} className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {kpi?.rows?.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white hover:bg-blue-50" : "bg-gray-50 hover:bg-blue-50"}>
                              <td className="px-3 py-1.5 border-b border-gray-100 text-gray-400 text-[10px]">{i + 1}</td>
                              {row.map((cell, j) => <td key={j} className="px-3 py-1.5 border-b border-gray-100 text-gray-700 whitespace-nowrap">{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 3 Charts — always shown */}
                    <div className="grid grid-cols-3 divide-x divide-gray-100">
                      <div className="p-3 bg-white">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide text-center mb-2">Bar Chart</p>
                        <div style={{ height: 230 }}>
                          {barData
                            ? <Bar data={barData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins.legend, display: barData.datasets.length > 1 } } }} />
                            : <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300"><span className="text-2xl">📊</span><p className="text-xs">No numeric data</p></div>}
                        </div>
                      </div>
                      <div className="p-3 bg-white">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide text-center mb-2">Line Chart</p>
                        <div style={{ height: 230 }}>
                          {lineData
                            ? <Line data={lineData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins.legend, display: lineData.datasets.length > 1 } } }} />
                            : <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300"><span className="text-2xl">📈</span><p className="text-xs">No numeric data</p></div>}
                        </div>
                      </div>
                      <div className="p-3 bg-white">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide text-center mb-2">Pie Chart</p>
                        <div style={{ height: 230 }}>
                          {pieData
                            ? <Pie data={pieData} options={{ ...chartOptions, scales: undefined }} />
                            : <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300"><span className="text-2xl">🥧</span><p className="text-xs">No numeric data</p></div>}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Dot navigation */}
              <div className="flex items-center justify-center gap-1.5 py-3 border-t border-gray-100 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
                {kpiItems.map((_, i) => (
                  <button key={i} onClick={() => setCurrentSlide(i)}
                    className={`rounded-full transition-all flex-shrink-0 ${i === currentSlide ? "w-5 h-2 bg-blue-600" : "w-2 h-2 bg-gray-300 hover:bg-gray-400"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Upload File (with history + new upload)
      ════════════════════════════════════════════════════════════════════════ */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-800">Upload Data File</h3>
                <p className="text-xs text-gray-400 mt-0.5">CSV or Excel files supported</p>
              </div>
              <button onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Drag-drop area ── */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
              <FileSpreadsheet className={`w-10 h-10 mx-auto mb-2 ${selectedFile ? "text-blue-400" : "text-gray-300"}`} />
              {selectedFile ? (
                <div>
                  <p className="text-sm font-semibold text-blue-600">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-600">Drag & drop or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Supports .csv, .xlsx, .xls</p>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mb-5 text-xs text-blue-700">
              <span className="mt-0.5 flex-shrink-0">ℹ</span>
              Runs schema → profile → plan → code generation. Returns job_id and a preview of the raw data.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isUploading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                  : <><Upload className="w-4 h-4" /> Upload</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: List Tables (with Load DB buttons)
      ════════════════════════════════════════════════════════════════════════ */}
      {/* ── Scroll to Top ── */}
      {showTopBtn && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg transition-all"
        >
          ↑ Top
        </button>
      )}

      {isTablesModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-800">Database Tables</h3>
                <p className="text-xs text-gray-400 mt-0.5">Select a table to load and generate KPIs</p>
              </div>
              <button
                onClick={() => setIsTablesModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>

            {isLoadingTables ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-sm">Fetching tables...</span>
              </div>
            ) : tablesList.length === 0 ? (
              <div className="text-center py-12">
                <Database className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">No tables found.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#313b96 #f1f1f1" }}>
                {tablesList.map((table, i) => {
                  const name = getTableName(table);
                  const isLoading = isLoadingDb === name;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors">
                      <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Database className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="flex-1 text-sm font-mono font-medium text-gray-700 truncate">{name}</span>
                      <button
                        onClick={() => handleLoadDb(name)}
                        disabled={isLoadingDb !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
                      >
                        {isLoading
                          ? <><RefreshCw className="w-3 h-3 animate-spin" /> Loading...</>
                          : <><Play className="w-3 h-3" /> Load DB</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleOpenTables}
                disabled={isLoadingTables}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTables ? "animate-spin" : ""}`} /> Refresh
              </button>
              <button
                onClick={() => setIsTablesModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}