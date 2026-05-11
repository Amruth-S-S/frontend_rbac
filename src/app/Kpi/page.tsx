'use client';

import React, { useState, useRef } from 'react';
import {
  Upload, Play, Download, RefreshCw, X, Database,
  FileSpreadsheet, CheckCircle, AlertCircle,
  ChevronLeft, ChevronRight, Search, Bookmark,
} from 'lucide-react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const COLORS = [
  'rgba(59,130,246,0.75)', 'rgba(16,185,129,0.75)', 'rgba(245,158,11,0.75)',
  'rgba(239,68,68,0.75)', 'rgba(139,92,246,0.75)', 'rgba(236,72,153,0.75)',
];
const BORDERS = [
  'rgb(59,130,246)', 'rgb(16,185,129)', 'rgb(245,158,11)',
  'rgb(239,68,68)', 'rgb(139,92,246)', 'rgb(236,72,153)',
];

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 10 } } },
  },
  scales: {
    x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
    y: { ticks: { font: { size: 10 } } },
  },
};

interface KpiItem { name: string; logic: string; inputs: string[]; columns: string[]; rows: string[][]; }

function getChartBase(kpi: KpiItem) {
  if (!kpi.columns?.length || !kpi.rows?.length) return null;
  if (kpi.columns.length === 1) {
    return {
      labels: kpi.rows.map((_, i) => String(i + 1)),
      valueArrays: [kpi.rows.map(r => parseFloat(r[0]) || 0)],
      colNames: [kpi.columns[0]],
    };
  }
  return {
    labels: kpi.rows.map(r => r[0]),
    valueArrays: kpi.columns.slice(1).map((_, i) => kpi.rows.map(r => parseFloat(r[i + 1]) || 0)),
    colNames: kpi.columns.slice(1),
  };
}

function extractKpiItems(data: unknown): KpiItem[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.kpis)) return d.kpis as KpiItem[];
  const arr = Object.values(d).find(
    v => Array.isArray(v) && (v as unknown[]).length > 0 && typeof (v as unknown[])[0] === 'object'
  );
  if (arr) return arr as KpiItem[];
  if (d.columns && d.rows) return [d as unknown as KpiItem];
  return [];
}

function KpiSlideViewer({
  items, slide, onSlide, onDownload,
}: {
  items: KpiItem[]; slide: number; onSlide: (n: number) => void; onDownload?: () => void;
}) {
  if (!items.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400 shadow-sm">
        No KPI data to display.
      </div>
    );
  }
  const kpi = items[slide];
  const base = getChartBase(kpi);
  const barData = base ? {
    labels: base.labels,
    datasets: base.colNames.map((col, i) => ({
      label: col, data: base.valueArrays[i],
      backgroundColor: COLORS[i % COLORS.length], borderColor: BORDERS[i % BORDERS.length],
      borderWidth: 1, borderRadius: 4,
    })),
  } : null;
  const lineData = base ? {
    labels: base.labels,
    datasets: base.colNames.map((col, i) => ({
      label: col, data: base.valueArrays[i],
      borderColor: BORDERS[i % BORDERS.length], backgroundColor: COLORS[i % COLORS.length],
      borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false,
    })),
  } : null;
  const pieData = base ? {
    labels: base.labels,
    datasets: [{
      label: base.colNames[0], data: base.valueArrays[0],
      backgroundColor: base.labels.map((_, i) => COLORS[i % COLORS.length]),
      borderColor: base.labels.map((_, i) => BORDERS[i % BORDERS.length]),
      borderWidth: 1,
    }],
  } : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          KPI Results
          <span className="text-xs text-gray-400 font-normal">({items.length} KPIs)</span>
        </h3>
        {onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
          >
            <Download className="w-3 h-3" /> Download .xlsx
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{kpi?.name?.replace(/_/g, ' ')}</p>
          {kpi?.logic && <p className="text-xs text-gray-500 mt-0.5 truncate">{kpi.logic}</p>}
        </div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <div className="hidden sm:flex flex-wrap gap-1 max-w-xs">
            {kpi?.inputs?.map(inp => (
              <span key={inp} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">{inp}</span>
            ))}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">{slide + 1} / {items.length}</span>
          <button
            onClick={() => onSlide(Math.max(0, slide - 1))}
            disabled={slide === 0}
            className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSlide(Math.min(items.length - 1, slide + 1))}
            disabled={slide === items.length - 1}
            className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-auto border-b border-gray-100" style={{ maxHeight: 180, scrollbarWidth: 'thin' }}>
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
              <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                <td className="px-3 py-1.5 border-b border-gray-100 text-gray-400 text-[10px]">{i + 1}</td>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 border-b border-gray-100 text-gray-700 whitespace-nowrap">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {([
          ['Bar', barData && <Bar data={barData} options={CHART_OPTIONS} />],
          ['Line', lineData && <Line data={lineData} options={CHART_OPTIONS} />],
          ['Pie', pieData && <Pie data={pieData} options={{ ...CHART_OPTIONS, scales: undefined }} />],
        ] as [string, React.ReactNode][]).map(([label, chart]) => (
          <div key={label} className="p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center mb-2">{label} Chart</p>
            <div style={{ height: 185 }}>
              {chart || <p className="text-xs text-gray-400 text-center pt-10">No data</p>}
            </div>
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3 border-t border-gray-100 overflow-x-auto px-4">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => onSlide(i)}
              className={`rounded-full transition-all flex-shrink-0 ${i === slide ? 'w-5 h-2 bg-blue-600' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = 'pipeline' | 'database' | 'saved';
type PipelineStep = 'idle' | 'uploaded' | 'done';

export default function KpiPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pipeline');
  const [error, setError] = useState<string | null>(null);

  // File Pipeline
  const [step, setStep] = useState<PipelineStep>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] = useState<Record<string, unknown> | null>(null);
  const [kpiResults, setKpiResults] = useState<unknown>(null);
  const [pipelineSlide, setPipelineSlide] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isFetchingKpis, setIsFetchingKpis] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Database
  const [tables, setTables] = useState<string[]>([]);
  const [isFetchingTables, setIsFetchingTables] = useState(false);
  const [loadTableName, setLoadTableName] = useState('');
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [loadTableResult, setLoadTableResult] = useState<unknown>(null);
  const [dbKpiTableName, setDbKpiTableName] = useState('');
  const [isGeneratingDbKpi, setIsGeneratingDbKpi] = useState(false);
  const [dbKpiResults, setDbKpiResults] = useState<unknown>(null);
  const [dbKpiSlide, setDbKpiSlide] = useState(0);

  // Saved KPIs
  const [dbId, setDbId] = useState('');
  const [savedKpi, setSavedKpi] = useState<unknown>(null);
  const [isFetchingSavedKpi, setIsFetchingSavedKpi] = useState(false);
  const [savedKpiSlide, setSavedKpiSlide] = useState(0);

  const handleErr = (err: unknown, fallback: string) =>
    setError(err instanceof Error ? err.message : fallback);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const res = await fetch('/api/kpi/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      setJobId(data.job_id);
      setUploadResponse(data);
      setStep('uploaded');
      setSelectedFile(null);
    } catch (err) {
      handleErr(err, 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRun = async () => {
    if (!jobId) return;
    setIsRunning(true); setError(null);
    try {
      const res = await fetch(`/api/kpi/run?job_id=${jobId}`, { method: 'POST' });
      if (!res.ok) throw new Error(`Run failed (${res.status})`);
      await handleFetchKpis();
    } catch (err) {
      handleErr(err, 'Run failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleFetchKpis = async () => {
    if (!jobId) return;
    setIsFetchingKpis(true); setError(null);
    try {
      const res = await fetch(`/api/kpi/kpis?job_id=${jobId}`);
      if (!res.ok) throw new Error(`Fetch KPIs failed (${res.status})`);
      const data = await res.json();
      setKpiResults(data);
      setPipelineSlide(0);
      setStep('done');
    } catch (err) {
      handleErr(err, 'Failed to fetch KPIs');
    } finally {
      setIsFetchingKpis(false);
    }
  };

  const handleDownload = async () => {
    if (!jobId) return;
    setError(null);
    try {
      const res = await fetch(`/api/kpi/download?job_id=${jobId}`);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `kpi_results_${jobId}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      handleErr(err, 'Download failed');
    }
  };

  const handleFetchTables = async () => {
    setIsFetchingTables(true); setError(null);
    try {
      const res = await fetch('/api/kpi/tables');
      if (!res.ok) throw new Error(`Fetch tables failed (${res.status})`);
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      handleErr(err, 'Failed to fetch tables');
    } finally {
      setIsFetchingTables(false);
    }
  };

  const handleLoadTable = async () => {
    if (!loadTableName.trim()) return;
    setIsLoadingTable(true); setError(null); setLoadTableResult(null);
    try {
      const res = await fetch('/api/kpi/db-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: loadTableName.trim() }),
      });
      if (!res.ok) throw new Error(`Load table failed (${res.status})`);
      setLoadTableResult(await res.json());
    } catch (err) {
      handleErr(err, 'Load table failed');
    } finally {
      setIsLoadingTable(false);
    }
  };

  const handleGenerateDbKpi = async () => {
    const name = dbKpiTableName.trim();
    if (!name) return;
    setIsGeneratingDbKpi(true); setError(null); setDbKpiResults(null);
    try {
      const res = await fetch(`/api/kpi/db-kpi?table_name=${encodeURIComponent(name)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`DB KPI generation failed (${res.status})`);
      setDbKpiResults(await res.json());
      setDbKpiSlide(0);
    } catch (err) {
      handleErr(err, 'DB KPI generation failed');
    } finally {
      setIsGeneratingDbKpi(false);
    }
  };

  const handleFetchSavedKpi = async () => {
    if (!dbId.trim()) return;
    setIsFetchingSavedKpi(true); setError(null); setSavedKpi(null);
    try {
      const res = await fetch(`/api/kpi/saved-kpi?db_id=${encodeURIComponent(dbId.trim())}`);
      if (!res.ok) throw new Error(`Fetch saved KPI failed (${res.status})`);
      setSavedKpi(await res.json());
      setSavedKpiSlide(0);
    } catch (err) {
      handleErr(err, 'Failed to fetch saved KPI');
    } finally {
      setIsFetchingSavedKpi(false);
    }
  };

  const handleReset = () => {
    setStep('idle'); setJobId(null);
    setUploadResponse(null); setKpiResults(null);
    setSelectedFile(null); setPipelineSlide(0);
  };

  const STEPS = ['Upload File', 'Run Pipeline', 'View KPIs'];
  const stepIndex = step === 'idle' ? 0 : step === 'uploaded' ? 1 : 2;

  const pipelineItems = extractKpiItems(kpiResults);
  const dbKpiItems = extractKpiItems(dbKpiResults);
  const savedKpiItems = extractKpiItems(savedKpi);

  const preview = uploadResponse?.preview as { columns?: string[]; data?: string[][] } | Array<Record<string, unknown>> | undefined;
  const previewColumns: string[] = Array.isArray(preview) ? Object.keys(preview[0] || {}) : (preview?.columns ?? []);
  const previewRows: string[][] = Array.isArray(preview)
    ? (preview as Array<Record<string, unknown>>).slice(0, 8).map(r => Object.values(r).map(String))
    : ((preview as { columns?: string[]; data?: string[][] })?.data ?? []).slice(0, 8) as string[][];

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'pipeline', label: 'File Pipeline', icon: FileSpreadsheet },
    { id: 'database', label: 'Database KPI', icon: Database },
    { id: 'saved', label: 'Saved KPIs', icon: Bookmark },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">KPI Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Upload data or connect to a database to generate and analyze KPIs</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1.5 mb-6 shadow-sm w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setError(null); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── File Pipeline Tab ── */}
        {activeTab === 'pipeline' && (
          <div className="space-y-5">

            {/* Step indicator */}
            <div className="flex items-center bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              {STEPS.map((label, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <div className={`flex-1 h-0.5 mx-3 ${i <= stepIndex ? 'bg-blue-400' : 'bg-gray-200'}`} />}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
                    i === stepIndex ? 'bg-blue-600 text-white border-blue-600' :
                    i < stepIndex ? 'bg-blue-50 text-blue-600 border-blue-200' :
                    'bg-gray-50 text-gray-400 border-gray-200'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === stepIndex ? 'bg-white text-blue-600' :
                      i < stepIndex ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {i < stepIndex ? '✓' : i + 1}
                    </span>
                    {label}
                  </div>
                </React.Fragment>
              ))}
              {step !== 'idle' && (
                <button
                  onClick={handleReset}
                  className="ml-4 flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-100 flex-shrink-0"
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {/* Upload dropzone */}
            {step === 'idle' && (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }}
                />
                <FileSpreadsheet className={`w-14 h-14 mx-auto mb-3 ${selectedFile ? 'text-blue-400' : 'text-gray-300'}`} />
                {selectedFile ? (
                  <div>
                    <p className="text-base font-semibold text-blue-600 mb-1">{selectedFile.name}</p>
                    <p className="text-sm text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB · Click to change</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-base font-semibold text-gray-600 mb-1">Drag & drop or click to browse</p>
                    <p className="text-sm text-gray-400 mb-5">Supports .csv, .xlsx, .xls</p>
                  </div>
                )}
                <button
                  onClick={e => { e.stopPropagation(); if (selectedFile) handleUpload(); else fileInputRef.current?.click(); }}
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 mt-5 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
                >
                  {isUploading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                    : <><Upload className="w-4 h-4" /> {selectedFile ? 'Upload File' : 'Choose File'}</>}
                </button>
              </div>
            )}

            {/* Post-upload card */}
            {step !== 'idle' && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="font-semibold text-gray-700 text-sm">File uploaded successfully</span>
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-0.5 rounded-md font-mono">
                      Job ID: {jobId}
                    </span>
                  </div>
                  <button onClick={() => setStep('idle')} className="text-xs text-blue-600 hover:underline flex-shrink-0">
                    Re-upload
                  </button>
                </div>

                {previewColumns.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Preview</p>
                    <div className="overflow-auto max-h-44 border border-gray-200 rounded-lg" style={{ scrollbarWidth: 'thin' }}>
                      <table className="min-w-full text-xs border-collapse">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {previewColumns.map(c => (
                              <th key={c} className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              {row.map((cell, j) => (
                                <td key={j} className="px-3 py-1.5 border-b border-gray-100 text-gray-700 whitespace-nowrap">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {step === 'uploaded' && (
                  <button
                    onClick={handleRun}
                    disabled={isRunning || isFetchingKpis}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
                  >
                    {isRunning || isFetchingKpis
                      ? <><RefreshCw className="w-4 h-4 animate-spin" />{isRunning ? 'Running pipeline...' : 'Fetching KPIs...'}</>
                      : <><Play className="w-4 h-4" /> Run Pipeline</>}
                  </button>
                )}
              </div>
            )}

            {/* KPI results */}
            {step === 'done' && (
              isFetchingKpis ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" /> Loading KPI results...
                </div>
              ) : (
                <KpiSlideViewer
                  items={pipelineItems}
                  slide={pipelineSlide}
                  onSlide={setPipelineSlide}
                  onDownload={handleDownload}
                />
              )
            )}
          </div>
        )}

        {/* ── Database KPI Tab ── */}
        {activeTab === 'database' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* Tables list */}
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Database className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">Available Tables</h3>
                  </div>
                  <button
                    onClick={handleFetchTables}
                    disabled={isFetchingTables}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingTables ? 'animate-spin' : ''}`} />
                    {tables.length ? 'Refresh' : 'Load'}
                  </button>
                </div>

                {isFetchingTables ? (
                  <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : tables.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Click <span className="font-medium text-gray-500">Load</span> to fetch available tables
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {tables.map(t => (
                      <button
                        key={t}
                        onClick={() => { setLoadTableName(t); setDbKpiTableName(t); }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                          loadTableName === t
                            ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right column: Load + Generate */}
              <div className="lg:col-span-3 space-y-4">

                {/* Load DB Table */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Download className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">Load DB Table</h3>
                      <p className="text-xs text-gray-400 mt-0.5">POST /api/db-load/</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={loadTableName}
                      onChange={e => setLoadTableName(e.target.value)}
                      placeholder="Enter table name..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={e => e.key === 'Enter' && handleLoadTable()}
                    />
                    <button
                      onClick={handleLoadTable}
                      disabled={!loadTableName.trim() || isLoadingTable}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {isLoadingTable ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Load
                    </button>
                  </div>
                  {loadTableResult && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5 mb-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Table Loaded
                      </p>
                      <pre className="text-xs text-green-800 overflow-auto max-h-24 font-mono">
                        {JSON.stringify(loadTableResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Generate DB KPI */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <Play className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">Generate DB KPI</h3>
                      <p className="text-xs text-gray-400 mt-0.5">POST /api/db-kpi/</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={dbKpiTableName}
                      onChange={e => setDbKpiTableName(e.target.value)}
                      placeholder="Enter table name..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={e => e.key === 'Enter' && handleGenerateDbKpi()}
                    />
                    <button
                      onClick={handleGenerateDbKpi}
                      disabled={!dbKpiTableName.trim() || isGeneratingDbKpi}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {isGeneratingDbKpi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* DB KPI Results */}
            {isGeneratingDbKpi && (
              <div className="flex items-center justify-center py-14 text-gray-400 text-sm gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" /> Generating KPIs from database...
              </div>
            )}
            {dbKpiResults && !isGeneratingDbKpi && (
              <KpiSlideViewer items={dbKpiItems} slide={dbKpiSlide} onSlide={setDbKpiSlide} />
            )}
          </div>
        )}

        {/* ── Saved KPIs Tab ── */}
        {activeTab === 'saved' && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <Bookmark className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Retrieve Saved KPIs</h3>
                  <p className="text-xs text-gray-400 mt-0.5">GET /api/saved-kpi/ — fetch previously saved analysis by database ID</p>
                </div>
              </div>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Database ID (db_id)</label>
                  <input
                    value={dbId}
                    onChange={e => setDbId(e.target.value)}
                    placeholder="Enter db_id..."
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={e => e.key === 'Enter' && handleFetchSavedKpi()}
                  />
                </div>
                <button
                  onClick={handleFetchSavedKpi}
                  disabled={!dbId.trim() || isFetchingSavedKpi}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isFetchingSavedKpi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Fetch
                </button>
              </div>
            </div>

            {isFetchingSavedKpi && (
              <div className="flex items-center justify-center py-14 text-gray-400 text-sm gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" /> Fetching saved KPIs...
              </div>
            )}

            {savedKpi && !isFetchingSavedKpi && (
              savedKpiItems.length > 0 ? (
                <KpiSlideViewer items={savedKpiItems} slide={savedKpiSlide} onSlide={setSavedKpiSlide} />
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-green-500" /> Saved KPI Data
                  </p>
                  <pre className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-96 font-mono">
                    {JSON.stringify(savedKpi, null, 2)}
                  </pre>
                </div>
              )
            )}
          </div>
        )}

      </div>
    </div>
  );
}
