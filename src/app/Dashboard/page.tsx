"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Tooltip, Legend,
} from "chart.js";
import {
  Play, RefreshCw, X, AlertCircle, Database,
  ChevronLeft, ChevronRight, CheckCircle, Layers,
  Search, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement,
  Tooltip, Legend
);

// ─── Config ────────────────────────────────────────────────────────────────
const KPI_API_BASE = "https://kpi-fastapi-git-main-vijaytanz12-2825s-projects.vercel.app";
const H = { "ngrok-skip-browser-warning": "true", "accept": "application/json" };

// ─── Chart colours ─────────────────────────────────────────────────────────
const CHART_COLORS = [
  "rgba(59,130,246,0.75)", "rgba(16,185,129,0.75)", "rgba(245,158,11,0.75)",
  "rgba(239,68,68,0.75)",  "rgba(139,92,246,0.75)", "rgba(236,72,153,0.75)",
];
const CHART_BORDERS = [
  "rgb(59,130,246)", "rgb(16,185,129)", "rgb(245,158,11)",
  "rgb(239,68,68)",  "rgb(139,92,246)", "rgb(236,72,153)",
];

// ─── Types ─────────────────────────────────────────────────────────────────
interface KpiJob {
  id: string;
  job_id?: string;
  file_name?: string;   // actual API field
  name?: string;
  filename?: string;
  table_name?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface KpiItem {
  name: string;
  logic?: string;
  inputs?: string[];
  columns?: string[];   // may be absent; derived from first row if needed
  rows: string[][];
}

interface KpiResponse {
  kpis?: KpiItem[];
  [key: string]: unknown;
}

interface RowState {
  loading: boolean;
  error: string | null;
  data: KpiResponse | null;
  open: boolean;
  slide: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const getJobId   = (j: KpiJob) => String(j.id ?? j.job_id ?? "");
const getJobName = (j: KpiJob) =>
  j.file_name ?? j.name ?? j.filename ?? j.table_name ?? `Job ${String(j.id ?? "").slice(0, 8)}`;
const getJobDate = (j: KpiJob) => {
  const raw = j.created_at ?? j.uploaded_at ?? j.timestamp ?? "";
  if (!raw) return null;
  try { return new Date(String(raw)).toLocaleString("en-IN", { dateStyle:"medium", timeStyle:"short" }); }
  catch { return null; }
};
const getJobStatus = (j: KpiJob) => String(j.status ?? "ready");

const getKpiItems = (resp: KpiResponse | null): KpiItem[] => {
  if (!resp) return [];

  // API returns { id, job_id, file_name, data: { kpis: [...] } }
  // Unwrap the nested "data" wrapper first
  const root: KpiResponse =
    (resp.data && typeof resp.data === "object" && !Array.isArray(resp.data))
      ? (resp.data as KpiResponse)
      : resp;

  if (Array.isArray(root.kpis)) return root.kpis as KpiItem[];

  // Fallback: find any array of objects inside root
  const arr = Object.values(root).find(
    v => Array.isArray(v) && (v as unknown[]).length > 0 && typeof (v as unknown[])[0] === "object"
  );
  if (arr) return arr as KpiItem[];

  // Fallback: treat root itself as a single KpiItem
  const maybeItem = root as unknown as KpiItem;
  if (maybeItem.columns && maybeItem.rows) return [maybeItem];
  return [];
};

const getChartBase = (kpi: KpiItem) => {
  if (!kpi.rows?.length) return null;
  const cols = kpi.columns ?? [];           // may be empty
  const numCols = kpi.rows[0]?.length ?? 0;
  if (numCols === 0) return null;

  if (numCols === 1) return {
    labels: kpi.rows.map((_, i) => String(i + 1)),
    valueArrays: [kpi.rows.map(r => parseFloat(String(r[0])) || 0)],
    colNames: [cols[0] ?? "Value"],
  };
  return {
    labels: kpi.rows.map(r => String(r[0] ?? "")),
    valueArrays: Array.from({ length: numCols - 1 }, (_, i) =>
      kpi.rows.map(r => parseFloat(String(r[i + 1])) || 0)
    ),
    colNames: Array.from({ length: numCols - 1 }, (_, i) => cols[i + 1] ?? `Col ${i + 2}`),
  };
};

const buildBar = (kpi: KpiItem) => {
  const b = getChartBase(kpi); if (!b) return null;
  return { labels: b.labels, datasets: b.colNames.map((col, i) => ({ label: col, data: b.valueArrays[i], backgroundColor: CHART_COLORS[i % 6], borderColor: CHART_BORDERS[i % 6], borderWidth: 1, borderRadius: 4 })) };
};
const buildLine = (kpi: KpiItem) => {
  const b = getChartBase(kpi); if (!b) return null;
  return { labels: b.labels, datasets: b.colNames.map((col, i) => ({ label: col, data: b.valueArrays[i], borderColor: CHART_BORDERS[i % 6], backgroundColor: CHART_COLORS[i % 6], borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false })) };
};
const buildPie = (kpi: KpiItem) => {
  const b = getChartBase(kpi); if (!b) return null;
  return { labels: b.labels, datasets: [{ label: b.colNames[0], data: b.valueArrays[0], backgroundColor: b.labels.map((_, i) => CHART_COLORS[i % 6]), borderColor: b.labels.map((_, i) => CHART_BORDERS[i % 6]), borderWidth: 1 }] };
};

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" as const, labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { bodyFont: { size: 11 }, titleFont: { size: 11 } } },
  scales: { x: { ticks: { font: { size: 10 }, maxRotation: 45 } }, y: { ticks: { font: { size: 10 } } } },
};

// ─── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    done:       "bg-green-100 text-green-700 border-green-200",
    completed:  "bg-green-100 text-green-700 border-green-200",
    success:    "bg-green-100 text-green-700 border-green-200",
    failed:     "bg-red-100 text-red-600 border-red-200",
    error:      "bg-red-100 text-red-600 border-red-200",
    running:    "bg-blue-100 text-blue-700 border-blue-200",
    pending:    "bg-amber-100 text-amber-700 border-amber-200",
    ready:      "bg-gray-100 text-gray-600 border-gray-200",
  };
  const cls = map[s] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border capitalize ${cls}`}>
      {status}
    </span>
  );
}

// ─── Inline KPI results panel ──────────────────────────────────────────────
function KpiResultPanel({
  data, slide, onSlide, onClose,
}: {
  data: KpiResponse; slide: number;
  onSlide: (n: number) => void;
  onClose: () => void;
}) {
  const items = getKpiItems(data);
  const total = items.length;
  if (total === 0) return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
      <span className="text-xs text-gray-400">No KPI data in response.</span>
      <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
    </div>
  );

  const kpi  = items[Math.min(slide, total - 1)];
  const cur  = Math.min(slide, total - 1);
  const barD = buildBar(kpi);
  const linD = buildLine(kpi);
  const pieD = buildPie(kpi);

  return (
    <div className="border-t-2 border-blue-200 bg-gradient-to-b from-blue-50/60 to-white">

      {/* Result header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-xs font-bold text-blue-800 truncate">
            {kpi.name?.replace(/_/g, " ")}
          </span>
          {kpi.logic && (
            <span className="hidden sm:block text-[10px] text-blue-500 truncate max-w-xs">{kpi.logic}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {kpi.inputs?.map(inp => (
            <span key={inp} className="hidden sm:block text-[10px] bg-white text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">{inp}</span>
          ))}
          <span className="text-[10px] text-blue-400 whitespace-nowrap">{cur + 1}/{total}</span>
          <button onClick={() => onSlide(Math.max(0, cur - 1))} disabled={cur === 0}
            className="p-1 rounded border border-blue-200 text-blue-500 hover:bg-blue-100 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onSlide(Math.min(total - 1, cur + 1))} disabled={cur === total - 1}
            className="p-1 rounded border border-blue-200 text-blue-500 hover:bg-blue-100 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose}
            className="p-1 rounded border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Data table */}
      {kpi.rows?.length > 0 && (
        <div className="overflow-auto border-b border-blue-100" style={{ maxHeight: 180, scrollbarWidth: "thin", scrollbarColor: "#3b82f6 #eff6ff" }}>
          <table className="min-w-full text-xs border-collapse">
            <thead className="bg-blue-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-1.5 text-left text-[10px] font-bold text-blue-400 border-b border-blue-100 w-7">#</th>
                {(kpi.columns?.length
                  ? kpi.columns
                  : Array.from({ length: kpi.rows[0]?.length ?? 0 }, (_, i) => `Col ${i + 1}`)
                ).map(c => (
                  <th key={c} className="px-3 py-1.5 text-left font-semibold text-blue-700 border-b border-blue-100 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kpi.rows?.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white hover:bg-blue-50" : "bg-blue-50/40 hover:bg-blue-50"}>
                  <td className="px-3 py-1.5 border-b border-blue-50 text-blue-300 text-[10px]">{i + 1}</td>
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 border-b border-blue-50 text-gray-700 whitespace-nowrap">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3 charts */}
      <div className="grid grid-cols-3 divide-x divide-blue-100">
        {[
          { label: "Bar Chart",  chart: barD ? <Bar  data={barD} options={chartOpts} /> : null },
          { label: "Line Chart", chart: linD ? <Line data={linD} options={chartOpts} /> : null },
          { label: "Pie Chart",  chart: pieD ? <Pie  data={pieD} options={{ ...chartOpts, scales: undefined }} /> : null },
        ].map(({ label, chart }) => (
          <div key={label} className="p-3">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide text-center mb-2">{label}</p>
            <div style={{ height: 180 }}>
              {chart ?? <p className="text-[10px] text-gray-300 text-center pt-8">No data</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Dot nav */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2.5 border-t border-blue-100 overflow-x-auto px-4">
          {items.map((_, i) => (
            <button key={i} onClick={() => onSlide(i)}
              className={`rounded-full transition-all flex-shrink-0 ${i === cur ? "w-5 h-2 bg-blue-500" : "w-2 h-2 bg-blue-200 hover:bg-blue-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Job Row ───────────────────────────────────────────────────────────────
function JobRow({ job, rowState, onRun, onClose, onSlide, idx }: {
  job: KpiJob;
  rowState: RowState;
  onRun: () => void;
  onClose: () => void;
  onSlide: (n: number) => void;
  idx: number;
}) {
  const id     = getJobId(job);
  const name   = getJobName(job);
  const status = getJobStatus(job);

  return (
    <div className={`rounded-xl overflow-hidden transition-all duration-200 ${
      rowState.open
        ? "border-2 border-blue-400 shadow-lg shadow-blue-100"
        : "border-2 border-blue-200 hover:border-blue-400 hover:shadow-md hover:shadow-blue-50"
    }`}>

      {/* Main row */}
      <div className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
        rowState.open
          ? "bg-gradient-to-r from-blue-50 to-indigo-50"
          : "bg-gradient-to-r from-white to-blue-50/40 hover:from-blue-50/60 hover:to-blue-50/20"
      }`}>

        {/* Index bubble */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
          rowState.open
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-blue-100 text-blue-600"
        }`}>
          {idx + 1}
        </div>

        {/* File icon */}
        <div className="w-8 h-8 rounded-lg bg-white border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-sm">📄</span>
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800 truncate max-w-xs">{name}</span>
            <StatusBadge status={status} />
            {rowState.open && (
              <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">
                ▼ results expanded
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {rowState.open && (
            <button onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
              <X className="w-3 h-3" /> Close
            </button>
          )}
          <button
            onClick={onRun}
            disabled={rowState.loading}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all shadow-sm ${
              rowState.loading
                ? "bg-blue-400 text-white cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:shadow-blue-300 hover:shadow-md"
            }`}
          >
            {rowState.loading
              ? <><RefreshCw className="w-3 h-3 animate-spin" /> Running...</>
              : <><Play className="w-3.5 h-3.5" /> Run</>}
          </button>
        </div>
      </div>

      {/* Error strip */}
      {rowState.error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-t-2 border-red-200 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {rowState.error}
        </div>
      )}

      {/* Inline KPI result panel */}
      {rowState.open && rowState.data && (
        <KpiResultPanel
          data={rowState.data}
          slide={rowState.slide}
          onSlide={onSlide}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function KPIDashboard() {
  const [jobs, setJobs]               = useState<KpiJob[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError]     = useState<string | null>(null);
  const [rows, setRows]               = useState<Record<string, RowState>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("asc");
  const [showTopBtn, setShowTopBtn]   = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Scroll-to-top: listen on both window AND nearest scrollable container ──
  useEffect(() => {
    const check = () => {
      const winScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      const divScroll = containerRef.current?.parentElement?.scrollTop ?? 0;
      setShowTopBtn(winScroll > 200 || divScroll > 200);
    };
    window.addEventListener("scroll", check, true); // capture phase catches all
    const parent = containerRef.current?.parentElement;
    if (parent) parent.addEventListener("scroll", check);
    return () => {
      window.removeEventListener("scroll", check, true);
      if (parent) parent.removeEventListener("scroll", check);
    };
  }, []);
  const fetchJobs = useCallback(async () => {
    setJobsLoading(true); setJobsError(null);
    try {
      const res = await fetch(`${KPI_API_BASE}/api/kpi-jobs/`, { headers: H });
      if (!res.ok) throw new Error(`Failed to load jobs (${res.status})`);
      const data = await res.json();
      // API returns { total_records: N, records: [...] }
      const list: KpiJob[] = Array.isArray(data)
        ? data
        : data.records ?? data.jobs ?? data.results ?? data.items ?? [];
      setTotalRecords(data.total_records ?? list.length);
      setJobs(list);
      // Init row state
      const init: Record<string, RowState> = {};
      list.forEach(j => {
        const id = getJobId(j);
        init[id] = { loading: false, error: null, data: null, open: false, slide: 0 };
      });
      setRows(init);
    } catch (err: unknown) {
      setJobsError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ── Run a job ─────────────────────────────────────────────────────────
  const handleRun = async (job: KpiJob) => {
    const id = getJobId(job);
    setRows(prev => ({ ...prev, [id]: { ...prev[id], loading: true, error: null } }));
    try {
      const res = await fetch(`${KPI_API_BASE}/api/saved-kpi/?db_id=${encodeURIComponent(id)}`, { headers: H });
      if (!res.ok) throw new Error(`API error (${res.status}): ${res.statusText}`);
      const data: KpiResponse = await res.json();
      setRows(prev => ({ ...prev, [id]: { loading: false, error: null, data, open: true, slide: 0 } }));
    } catch (err: unknown) {
      setRows(prev => ({ ...prev, [id]: { ...prev[id], loading: false, error: err instanceof Error ? err.message : "Run failed" } }));
    }
  };

  const handleClose = (id: string) =>
    setRows(prev => ({ ...prev, [id]: { ...prev[id], open: false } }));

  const handleSlide = (id: string, n: number) =>
    setRows(prev => ({ ...prev, [id]: { ...prev[id], slide: n } }));

  const anyOpen = Object.values(rows).some(r => r.open);

  // ── Filter + sort ──────────────────────────────────────────────────────
  const displayedJobs = jobs
    .filter(j => getJobName(j).toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const na = getJobName(a).toLowerCase();
      const nb = getJobName(b).toLowerCase();
      return sortDir === "asc" ? na.localeCompare(nb) : nb.localeCompare(na);
    });

  return (
    <div ref={containerRef} className="min-h-full" style={{ background: "linear-gradient(160deg, #eff6ff 0%, #f8faff 40%, #f0f9ff 100%)" }}>
      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #eff6ff; border-radius: 999px; }
        ::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 999px; border: 2px solid #eff6ff; }
        ::-webkit-scrollbar-thumb:hover { background: #2563eb; }
        * { scrollbar-width: thin; scrollbar-color: #3b82f6 #eff6ff; }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── Gradient Header Banner ── */}
      <div style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)" }}
        className="px-6 py-5 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-inner border border-white/30">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">KPI Dashboard</h2>
              <p className="text-xs text-blue-200 mt-0.5 font-medium">
                {totalRecords > 0
                  ? `${totalRecords} record${totalRecords !== 1 ? "s" : ""} available · click Run to view results`
                  : "Loading available jobs…"}
              </p>
            </div>
          </div>
          <button
            onClick={fetchJobs}
            disabled={jobsLoading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-60 rounded-xl transition-all shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${jobsLoading ? "animate-spin" : ""}`} />
            {jobsLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {jobs.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-blue-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-blue-700">{totalRecords} Total Jobs</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-green-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-green-700">
              {Object.values(rows).filter(r => r.open).length} Results Open
            </span>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-xs bg-white border border-blue-200 rounded-lg px-3 py-1.5 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search file name..."
              className="flex-1 text-xs text-gray-700 placeholder-gray-400 bg-transparent outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-300 hover:text-gray-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search result count */}
          {searchQuery && (
            <span className="text-[10px] text-blue-400 font-medium whitespace-nowrap">
              {displayedJobs.length} result{displayedJobs.length !== 1 ? "s" : ""}
            </span>
          )}

          {anyOpen && (
            <button
              onClick={() => setRows(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(k => { next[k] = { ...next[k], open: false }; });
                return next;
              })}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
            >
              <X className="w-3 h-3" /> Close All
            </button>
          )}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 pb-8">

        {/* Global error */}
        {globalError && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{globalError}</span>
            <button onClick={() => setGlobalError(null)}><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* ── Jobs error ── */}
        {jobsError && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{jobsError}</span>
            <button onClick={fetchJobs} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-600">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {jobsLoading && jobs.length === 0 && (
          <div className="space-y-3 mt-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 rounded-xl border-2 border-blue-100 animate-pulse"
                style={{ background: "linear-gradient(90deg, #eff6ff, #dbeafe, #eff6ff)", backgroundSize: "200% 100%", opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!jobsLoading && !jobsError && jobs.length === 0 && (
          <div className="border-2 border-dashed border-blue-200 rounded-2xl p-14 text-center bg-white/60 mt-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-sm font-bold text-gray-600 mb-1">No KPI jobs found</p>
            <p className="text-xs text-gray-400 mb-5">Upload a file in the KPI Updates tab to generate jobs</p>
            <button onClick={fetchJobs} className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-md">
              <RefreshCw className="w-3 h-3" /> Check Again
            </button>
          </div>
        )}

        {/* ── Column headers with sort ── */}
        {jobs.length > 0 && (
          <div className="hidden sm:flex items-center gap-3 px-4 pb-2 mt-1">
            <div className="w-8 flex-shrink-0" />
            <div className="w-8 flex-shrink-0" />
            <button
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors group"
            >
              File Name
              {sortDir === "asc"
                ? <ArrowUp className="w-3 h-3 text-blue-500 group-hover:text-blue-700" />
                : <ArrowDown className="w-3 h-3 text-blue-500 group-hover:text-blue-700" />}
            </button>
            <div className="flex-1" />
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest pr-2">Action</div>
          </div>
        )}

        {/* ── Job list ── */}
        {jobs.length > 0 && (
          <div className="space-y-3">
            {displayedJobs.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">
                No jobs match "<span className="font-semibold text-blue-400">{searchQuery}</span>"
              </div>
            ) : displayedJobs.map((job, idx) => {
              const id = getJobId(job);
              const rs = rows[id] ?? { loading: false, error: null, data: null, open: false, slide: 0 };
              return (
                <JobRow
                  key={id || idx}
                  job={job}
                  rowState={rs}
                  onRun={() => handleRun(job)}
                  onClose={() => handleClose(id)}
                  onSlide={(n) => handleSlide(id, n)}
                  idx={idx}
                />
              );
            })}
          </div>
        )}

        {/* ── Footer ── */}
        {jobs.length > 0 && (
          <div className="mt-5 text-center text-[10px] text-blue-300 font-medium">
            {totalRecords} record{totalRecords !== 1 ? "s" : ""} · KPI Pipeline Dashboard
          </div>
        )}
      </div>

      {/* ── Scroll to Top ── */}
      {showTopBtn && (
        <button
          onClick={() => {
            // scroll both window and any parent container
            window.scrollTo({ top: 0, behavior: "smooth" });
            const parent = containerRef.current?.parentElement;
            if (parent) parent.scrollTo({ top: 0, behavior: "smooth" });
            document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-xl shadow-blue-300 transition-all"
          style={{ animation: "fadeInUp 0.2s ease" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 10V2M2 6l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Top
        </button>
      )}
    </div>
  );
}