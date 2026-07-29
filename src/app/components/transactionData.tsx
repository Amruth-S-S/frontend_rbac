'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload, X, FolderOpen, FileSpreadsheet, PlayCircle, Loader2,
  CheckCircle2, AlertCircle, RefreshCw, Database, FileCode2, Copy, ChevronDown,
  Search, ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';

// The Tally → GCS → PostgreSQL extraction service (NEXT_PUBLIC_TALLY_API_BASE_URL)
// doesn't send CORS headers for this app's origin, so the browser can't call it
// directly — everything is proxied through this app's own /api/tally/* routes,
// which forward the request to that host server-side (see src/app/api/tally/*).

type ExtractKind = 'brs' | 'gst' | 'provisions' | 'ledger' | 'bills' | 'stock';

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ExtractTabState {
  source: string;
  fileName: string;
  loading: boolean;
  result: string | null;
  error: string | null;
  tableFilter: string;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc';
  activeSection: number;
}

const emptyTabState = (): ExtractTabState => ({
  source: '', fileName: '', loading: false, result: null, error: null,
  tableFilter: '', sortColumn: null, sortDir: 'asc', activeSection: 0,
});

const TABS: { key: ExtractKind; label: string; description: string }[] = [
  { key: 'brs', label: 'BRS', description: 'Bank Reconciliation Statement extraction' },
  { key: 'gst', label: 'GST', description: 'GST data extraction' },
  { key: 'provisions', label: 'Provisions', description: 'Provisions extraction' },
  { key: 'ledger', label: 'Ledger', description: 'Ledger extraction' },
  { key: 'bills', label: 'Bills', description: 'Outstanding bills — top 10 rows per bill type' },
  { key: 'stock', label: 'Stock', description: 'Stock extraction — top 10 rows' },
];

type TableRow = Record<string, unknown>;

interface ResultSection {
  title: string;
  rows: TableRow[];
}

const isFlatRowArray = (value: unknown): value is TableRow[] =>
  Array.isArray(value) && value.length > 0 && value.every(row => row !== null && typeof row === 'object' && !Array.isArray(row));

const titleCase = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Most extraction endpoints (BRS, GST, Ledger, Provisions) return a flat JSON
// array of row objects — one table. Bills (and potentially others) return a
// nested shape instead, e.g. { bill_types: { "New Ref": [...], ... }, outstanding: [...] }
// — walk one level deep and turn every array-of-row-objects found into its own
// labeled table section. Anything with no tabular data anywhere falls back to
// the raw JSON/text view.
const parseResultSections = (result: string | null): ResultSection[] | null => {
  if (!result) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(result); } catch { return null; }

  if (isFlatRowArray(parsed)) return [{ title: '', rows: parsed }];

  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const sections: ResultSection[] = [];
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (isFlatRowArray(value)) {
        sections.push({ title: titleCase(key), rows: value });
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
          if (isFlatRowArray(nestedValue)) {
            sections.push({ title: `${titleCase(key)}: ${nestedKey}`, rows: nestedValue });
          }
        });
      }
    });
    return sections.length > 0 ? sections : null;
  }

  return null;
};

const getColumnsFromRows = (rows: TableRow[]): string[] => {
  const seen = new Set<string>();
  const columns: string[] = [];
  rows.forEach(row => {
    Object.keys(row).forEach(key => {
      if (!seen.has(key)) { seen.add(key); columns.push(key); }
    });
  });
  return columns;
};

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const compareValues = (a: unknown, b: unknown): number => {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return String(a).localeCompare(String(b));
};

export default function TransactionData() {
  // ─── Toasts ─────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const showToast = (type: ToastMessage['type'], message: string) => {
    const id = toastIdRef.current++;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  // ─── Upload modal state ─────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Extraction tabs state ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ExtractKind>('brs');
  const [sourceFiles, setSourceFiles] = useState<string[]>([]);
  const [sourceFilesLoading, setSourceFilesLoading] = useState(false);
  const [tabStates, setTabStates] = useState<Record<ExtractKind, ExtractTabState>>(() => ({
    brs: emptyTabState(), gst: emptyTabState(), provisions: emptyTabState(),
    ledger: emptyTabState(), bills: emptyTabState(), stock: emptyTabState(),
  }));
  // Bumped each time a tab's extraction is (re)started, so a stale poll loop from a
  // superseded run can tell it's no longer the latest and stop touching state.
  const pollTokensRef = useRef<Record<ExtractKind, number>>({
    brs: 0, gst: 0, provisions: 0, ledger: 0, bills: 0, stock: 0,
  });

  const currentState = tabStates[activeTab];
  const setCurrentState = (updater: (prev: ExtractTabState) => ExtractTabState) => {
    setTabStates(prev => ({ ...prev, [activeTab]: updater(prev[activeTab]) }));
  };

  // ─── GET /List_folders ──────────────────────────────────────────────────
  const fetchFolders = useCallback(async (): Promise<string[]> => {
    setFoldersLoading(true);
    try {
      const res = await fetch('/api/tally/folders', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Failed to load folders (${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setFolders(list);
      return list;
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to load folders');
      return [];
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  // ─── GET /files?prefix=... ──────────────────────────────────────────────
  const fetchFilesForPrefix = async (prefix: string): Promise<string[]> => {
    try {
      const res = await fetch(`/api/tally/files?prefix=${encodeURIComponent(prefix)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  // ─── Combine List Folders + Files so the Source dropdown shows every saved file ──
  const refreshSourceFiles = useCallback(async () => {
    setSourceFilesLoading(true);
    try {
      const folderList = await fetchFolders();
      const perFolder = await Promise.all(folderList.map(fetchFilesForPrefix));
      const flat = perFolder.flat();
      // GCS "folders" are just prefix placeholders (they end with '/') — drop them, keep real files only.
      const uniqueFiles = Array.from(new Set(flat)).filter(uri => !uri.endsWith('/'));
      setSourceFiles(uniqueFiles);
    } catch {
      showToast('error', 'Failed to load saved files');
    } finally {
      setSourceFilesLoading(false);
    }
  }, [fetchFolders]);

  useEffect(() => { refreshSourceFiles(); }, [refreshSourceFiles]);

  // ─── Upload modal handlers ──────────────────────────────────────────────
  const openUploadModal = () => {
    setSelectedFile(null);
    setSelectedFolder('');
    setShowUploadModal(true);
    fetchFolders();
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setShowUploadModal(false);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!selectedFile) { showToast('error', 'Please choose a file to upload'); return; }
    if (!selectedFolder) { showToast('error', 'Please select a destination folder'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('destination_blob_name', selectedFolder);

      const res = await fetch('/api/tally/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      showToast('success', `Uploaded: ${data.gcs_uri || selectedFile.name}`);
      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedFolder('');
      setActiveTab('brs');
      await refreshSourceFiles();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ─── Extraction (BRS / GST) ─────────────────────────────────────────────
  const deriveFileName = (uri: string) => {
    const last = uri.split('/').filter(Boolean).pop() || '';
    return last.replace(/_\d{8}$/, '').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]+/g, '_');
  };

  const handleSourceChange = (uri: string) => {
    setCurrentState(prev => ({
      ...prev,
      source: uri,
      fileName: prev.fileName || deriveFileName(uri),
      result: null,
      error: null,
      tableFilter: '',
      sortColumn: null,
      sortDir: 'asc',
      activeSection: 0,
    }));
  };

  const handleFileNameChange = (value: string) => {
    setCurrentState(prev => ({ ...prev, fileName: value }));
  };

  const runExtraction = async () => {
    const kind = activeTab;
    const state = tabStates[kind];
    if (!state.source) { showToast('error', 'Please select a source file'); return; }
    if (!state.fileName.trim()) { showToast('error', 'Please enter a file name'); return; }

    // Invalidate any poll loop still running from a previous submission on this tab.
    const myToken = ++pollTokensRef.current[kind];
    const applyToKind = (updater: (prev: ExtractTabState) => ExtractTabState) => {
      if (pollTokensRef.current[kind] !== myToken) return;
      setTabStates(prev => ({ ...prev, [kind]: updater(prev[kind]) }));
    };

    applyToKind(prev => ({ ...prev, loading: true, result: null, error: null, tableFilter: '', sortColumn: null, sortDir: 'asc', activeSection: 0 }));

    try {
      const params = new URLSearchParams({ source: state.source, file_name: state.fileName.trim() });
      const res = await fetch(`/api/tally/extract/${kind}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* not JSON */ }

      if (!res.ok) throw new Error((parsed && (parsed.error || parsed.detail)) || text || `Extraction failed (${res.status})`);

      const jobId: string | undefined = parsed?.job_id;
      if (!jobId) {
        // No job_id — treat the response as the final result directly.
        const formatted = parsed !== null ? JSON.stringify(parsed, null, 2) : text;
        applyToKind(prev => ({ ...prev, loading: false, result: formatted }));
        showToast('success', `${kind.toUpperCase()} extraction completed`);
        return;
      }

      // Job submitted — poll GET /api/tally/jobs/{job_id} until status is "done" or "error".
      const poll = async () => {
        if (pollTokensRef.current[kind] !== myToken) return;
        try {
          const jr = await fetch(`/api/tally/jobs/${encodeURIComponent(jobId)}`, {
            headers: { Accept: 'application/json' },
          });
          const jtext = await jr.text();
          let job: any;
          try { job = JSON.parse(jtext); } catch { throw new Error(jtext || `Job status check failed (${jr.status})`); }
          if (!jr.ok) throw new Error(job?.error || job?.detail || `Job status check failed (${jr.status})`);

          if (job.status === 'running') {
            setTimeout(poll, 3000);
            return;
          }
          if (job.status === 'error') {
            const msg = job.error || `${kind.toUpperCase()} extraction failed`;
            applyToKind(prev => ({ ...prev, loading: false, error: msg }));
            showToast('error', msg);
            return;
          }
          // status === 'done'
          applyToKind(prev => ({ ...prev, loading: false, result: JSON.stringify(job.result, null, 2) }));
          showToast('success', `${kind.toUpperCase()} extraction completed`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Job status check failed';
          applyToKind(prev => ({ ...prev, loading: false, error: msg }));
          showToast('error', msg);
        }
      };
      poll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Extraction failed';
      applyToKind(prev => ({ ...prev, loading: false, error: msg }));
      showToast('error', msg);
    }
  };

  const handleTableFilterChange = (value: string) => {
    setCurrentState(prev => ({ ...prev, tableFilter: value }));
  };

  const handleSort = (column: string) => {
    setCurrentState(prev => ({
      ...prev,
      sortColumn: column,
      sortDir: prev.sortColumn === column && prev.sortDir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSectionChange = (index: number) => {
    setCurrentState(prev => ({ ...prev, activeSection: index }));
  };

  const copyResult = async () => {
    if (!currentState.result) return;
    try {
      await navigator.clipboard.writeText(currentState.result);
      showToast('info', 'Result copied to clipboard');
    } catch { /* clipboard not available */ }
  };

  const basename = (uri: string) => uri.split('/').filter(Boolean).pop() || uri;

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // ─── Table view(s) of the current tab's result (falls back to raw JSON when there's no tabular data) ──
  const resultSections = useMemo(() => parseResultSections(currentState.result), [currentState.result]);
  const processedSections = useMemo(() => {
    if (!resultSections) return [];
    const q = currentState.tableFilter.trim().toLowerCase();
    return resultSections.map(section => {
      const columns = getColumnsFromRows(section.rows);
      let rows = q
        ? section.rows.filter(row => columns.some(col => formatCell(row[col]).toLowerCase().includes(q)))
        : section.rows;
      if (currentState.sortColumn && columns.includes(currentState.sortColumn)) {
        const col = currentState.sortColumn;
        const dir = currentState.sortDir === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => compareValues(a[col], b[col]) * dir);
      }
      return { title: section.title, columns, rows };
    });
  }, [resultSections, currentState.tableFilter, currentState.sortColumn, currentState.sortDir]);
  const totalRawRows = useMemo(() => (resultSections ? resultSections.reduce((sum, s) => sum + s.rows.length, 0) : 0), [resultSections]);
  const totalFilteredRows = useMemo(() => processedSections.reduce((sum, s) => sum + s.rows.length, 0), [processedSections]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6">
      {/* Toasts */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-stretch gap-2 w-80">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-2 rounded-lg shadow-lg px-3 py-2.5 text-sm text-white ${
              t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span className="leading-snug break-words">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Transaction Data</h2>
            <p className="text-xs text-gray-500">Upload Tally XML exports and run BRS, GST, Provisions, Ledger, Bills &amp; Stock extraction</p>
          </div>
        </div>
        <button
          onClick={openUploadModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex-shrink-0"
        >
          <Upload className="w-4 h-4" />
          Upload Files
        </button>
      </div>

      {/* Extraction card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-3 pt-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.description}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 border border-gray-200 border-b-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Source + File Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">Source File</label>
                <button
                  onClick={refreshSourceFiles}
                  disabled={sourceFilesLoading}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${sourceFilesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <div className="relative">
                <select
                  value={currentState.source}
                  onChange={e => handleSourceChange(e.target.value)}
                  disabled={sourceFilesLoading}
                  className="w-full appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
                >
                  <option value="">
                    {sourceFilesLoading ? 'Loading saved files…' : sourceFiles.length === 0 ? 'No saved files found' : 'Select a saved file'}
                  </option>
                  {sourceFiles.map(uri => (
                    <option key={uri} value={uri} title={uri}>{basename(uri)}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {currentState.source && (
                <p className="mt-1 text-[11px] text-gray-400 truncate" title={currentState.source}>{currentState.source}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                File Name <span className="text-gray-400 font-normal"></span>
              </label>
              <input
                type="text"
                value={currentState.fileName}
                onChange={e => handleFileNameChange(e.target.value)}
                placeholder="e.g. eal_schedule_july_2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Run button */}
          <div className="mt-4">
            <button
              onClick={runExtraction}
              disabled={currentState.loading || !currentState.source || !currentState.fileName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {currentState.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              Run {activeTab.toUpperCase()} Extraction
            </button>
            {currentState.loading && (
              <p className="mt-2 text-xs text-gray-500">Processing… large files can take 20–30 minutes or more. Please keep this tab open until it finishes.</p>
            )}
          </div>

          {/* Result panel */}
          {(currentState.result || currentState.error) && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${currentState.error ? 'text-red-600' : 'text-emerald-600'}`}>
                  {currentState.error ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {currentState.error
                    ? 'Error'
                    : resultSections
                      ? `Result — ${totalFilteredRows} of ${totalRawRows} rows${processedSections.length > 1 ? ` across ${processedSections.length} tables` : ''}`
                      : 'Result'}
                </div>

                <div className="flex items-center gap-3">
                  {resultSections && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={currentState.tableFilter}
                        onChange={e => handleTableFilterChange(e.target.value)}
                        placeholder="Filter results…"
                        className="pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 w-80"
                      />
                    </div>
                  )}
                  {currentState.result && (
                    <button onClick={copyResult} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700">
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  )}
                </div>
              </div>

              {currentState.error ? (
                <pre className="text-xs rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap break-words border bg-red-50 border-red-200 text-red-700">
                  {currentState.error}
                </pre>
              ) : resultSections ? (
                <>
                  <style>{`
                    .tx-table-scroll::-webkit-scrollbar { height: 12px; width: 12px; }
                    .tx-table-scroll::-webkit-scrollbar-track { background: #eff6ff; border-radius: 6px; }
                    .tx-table-scroll::-webkit-scrollbar-thumb { background: #2563eb; border-radius: 6px; border: 2px solid #eff6ff; }
                    .tx-table-scroll::-webkit-scrollbar-thumb:hover { background: #1d4ed8; }
                  `}</style>
                  {(() => {
                    const activeIdx = Math.min(currentState.activeSection, processedSections.length - 1);
                    const section = processedSections[activeIdx];
                    if (!section) return null;
                    return (
                      <div>
                        {processedSections.length > 1 && (
                          <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-0.5">
                            {processedSections.map((s, idx) => (
                              <button
                                key={s.title || idx}
                                onClick={() => handleSectionChange(idx)}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                                  idx === activeIdx
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {s.title || 'Result'} <span className="opacity-70">({s.rows.length})</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Caps at ~8 rows tall so long results still scroll here (not below a page-scroll's worth of rows), but shrinks to fit when there are only a few rows so the scrollbar hugs the actual data instead of floating below empty space */}
                        <div
                          ref={tableScrollRef}
                          className="tx-table-scroll border border-gray-200 rounded-lg overflow-auto max-h-80"
                          style={{ scrollbarWidth: 'auto', scrollbarColor: '#2563eb #eff6ff' }}
                        >
                          <table className="min-w-full text-xs border-collapse">
                            <thead className="sticky top-0 z-10">
                              <tr>
                                {section.columns.map(col => {
                                  const isSorted = currentState.sortColumn === col;
                                  return (
                                    <th
                                      key={col}
                                      onClick={() => handleSort(col)}
                                      className="bg-gray-100 text-left font-semibold text-gray-700 px-3 py-2 border-b border-gray-200 whitespace-nowrap cursor-pointer select-none hover:bg-gray-200 transition-colors"
                                    >
                                      <span className="flex items-center gap-1">
                                        {col}
                                        {isSorted
                                          ? (currentState.sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />)
                                          : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                                      </span>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {section.rows.length === 0 ? (
                                <tr>
                                  <td colSpan={section.columns.length} className="text-center py-6 text-gray-400">
                                    No rows match &quot;{currentState.tableFilter}&quot;
                                  </td>
                                </tr>
                              ) : (
                                section.rows.map((row, idx) => (
                                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                                    {section.columns.map(col => (
                                      <td key={col} className="px-3 py-1.5 border-b border-gray-100 text-gray-700 whitespace-nowrap">
                                        {formatCell(row[col])}
                                      </td>
                                    ))}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <pre className="text-xs rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap break-words border bg-gray-900 border-gray-800 text-emerald-300">
                  {currentState.result}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" /> Upload File
              </h3>
              <button onClick={closeUploadModal} disabled={uploading} className="text-gray-400 hover:text-gray-700 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* File picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">File</label>
                <input ref={fileInputRef} type="file" onChange={handleFilePick} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <FileSpreadsheet className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{selectedFile ? selectedFile.name : 'Choose a file to upload'}</span>
                </button>
              </div>

              {/* Destination folder dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700">Destination Folder</label>
                  <button
                    onClick={fetchFolders}
                    disabled={foldersLoading}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${foldersLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                <div className="relative">
                  <select
                    value={selectedFolder}
                    onChange={e => setSelectedFolder(e.target.value)}
                    disabled={foldersLoading}
                    className="w-full appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
                  >
                    <option value="">
                      {foldersLoading ? 'Loading folders…' : folders.length === 0 ? 'No folders found' : 'Select a folder'}
                    </option>
                    {folders.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <FolderOpen className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeUploadModal}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !selectedFolder}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
