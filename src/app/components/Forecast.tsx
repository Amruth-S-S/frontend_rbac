'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  TrendingUp, Database, RefreshCw, ChevronDown, Play, X, Download,
  CheckCircle2, AlertCircle, AlertTriangle, Loader2, Search as SearchIcon, ArrowUpDown,
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// The forecasting API only knows how to build a time series out of a table that has
// exactly these three columns (case-sensitive) — a row id, a date, and an amount.
const REQUIRED_COLUMNS = ['GUID', 'Date', 'Amount'];

type Frequency = 'weekly' | 'monthly';

interface TableRow { GUID: string; Date: string; Amount: number; }
interface LoadedData {
  table: string;
  filter_column: string | null;
  filter_value: string | null;
  rows: number;
  data: TableRow[];
}
interface ForecastPoint { Date: string; Forecast: number; }
interface ForecastResult {
  frequency: Frequency;
  forecast_count: number;
  historical_observations: number;
  season: number;
  data: ForecastPoint[];
}
let toastSeq = 0;

const formatNumber = (n: number | null | undefined, maxFractionDigits = 0) =>
  n === null || n === undefined || Number.isNaN(n)
    ? '—'
    : new Intl.NumberFormat('en-IN', { maximumFractionDigits: maxFractionDigits }).format(n);

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const extractErrorMessage = (payload: any, fallback: string): string => {
  const detail = payload?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (typeof detail?.message === 'string') return detail.message;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
};

export default function Forecast() {
  const [toasts, setToasts] = useState<{ id: number; type: 'success' | 'error' | 'info'; message: string }[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++toastSeq;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Tables + per-table columns (fetched lazily, one table at a time) ───────────
  // The forecasting API sits on a very small Postgres connection pool — firing all
  // 13+ tables' /columns calls in parallel on mount reliably exhausts it ("sorry,
  // too many clients already") and a handful come back as 500s, which made whatever
  // table happened to lose that race look "unsupported" even when it wasn't. Fetching
  // only the selected table's columns, one request at a time, avoids that entirely.
  const [tables, setTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [columnsByTable, setColumnsByTable] = useState<Record<string, string[]>>({});
  const [columnsLoading, setColumnsLoading] = useState(false);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const res = await fetch('/api/forecasting/tables');
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, 'Failed to load tables.'));
      setTables(Array.isArray(json?.tables) ? json.tables : []);
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to load tables.');
    } finally {
      setTablesLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const fetchColumnsFor = useCallback(async (t: string): Promise<string[]> => {
    if (columnsByTable[t]) return columnsByTable[t];
    const res = await fetch(`/api/forecasting/tables/${encodeURIComponent(t)}/columns`);
    const json = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(json, `Failed to load columns for ${t}.`));
    const cols: string[] = Array.isArray(json?.columns) ? json.columns : [];
    setColumnsByTable(prev => ({ ...prev, [t]: cols }));
    return cols;
  }, [columnsByTable]);

  const isEligible = (t: string) => REQUIRED_COLUMNS.every(c => (columnsByTable[t] || []).includes(c));

  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [tableSort, setTableSort] = useState<'asc' | 'desc'>('asc');
  const tableDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tableDropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (tableDropdownRef.current && !tableDropdownRef.current.contains(e.target as Node)) {
        setTableDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [tableDropdownOpen]);

  const visibleTables = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const filtered = q ? tables.filter(t => t.toLowerCase().includes(q)) : tables;
    const sorted = [...filtered].sort((a, b) => a.localeCompare(b));
    return tableSort === 'asc' ? sorted : sorted.reverse();
  }, [tables, tableSearch, tableSort]);

  // ── Step 1: table + filter selection, then "load" it server-side ───────────
  const [selectedTable, setSelectedTable] = useState('');

  // Filter column is a single choice (the API only takes one filter_column per call).
  // Filter value stays multi-select — the API's comma-separated filter_value list
  // handles picking several values within that one column.
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValueOptions, setFilterValueOptions] = useState<string[]>([]);
  const [selectedFilterValues, setSelectedFilterValues] = useState<string[]>([]);
  const [filterValuesLoading, setFilterValuesLoading] = useState(false);
  const [filterValueDropdownOpen, setFilterValueDropdownOpen] = useState(false);
  const filterValueDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterValueDropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (filterValueDropdownRef.current && !filterValueDropdownRef.current.contains(e.target as Node)) {
        setFilterValueDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [filterValueDropdownOpen]);

  // Custom dropdown for Filter column too (not a native <select>) — same reason as
  // Table: native selects sometimes open upward when there's no room below.
  const [filterColumnDropdownOpen, setFilterColumnDropdownOpen] = useState(false);
  const filterColumnDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterColumnDropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (filterColumnDropdownRef.current && !filterColumnDropdownRef.current.contains(e.target as Node)) {
        setFilterColumnDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [filterColumnDropdownOpen]);

  const handleSelectFilterColumn = async (col: string) => {
    setFilterColumn(col);
    setSelectedFilterValues([]);
    setFilterValueOptions([]);
    if (!col || !selectedTable) return;
    setFilterValuesLoading(true);
    try {
      const res = await fetch(`/api/forecasting/tables/${encodeURIComponent(selectedTable)}/columns/${encodeURIComponent(col)}/values`);
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, 'Failed to load filter values.'));
      setFilterValueOptions(Array.isArray(json?.values) ? json.values : []);
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to load filter values.');
    } finally {
      setFilterValuesLoading(false);
    }
  };

  const toggleFilterValue = (v: string) => {
    setSelectedFilterValues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const selectedColumns = columnsByTable[selectedTable] || [];
  const selectedEligible = selectedTable ? isEligible(selectedTable) : false;
  // Every column the backend returns is filterable — same list as Selected columns,
  // not just the ones outside GUID/Date/Amount.
  const filterColumnOptions = selectedColumns;

  // "Selected columns" — every column the backend reports for this table is shown as
  // a checkbox, freely toggleable (the API happens to require GUID + Date + Amount to
  // actually build a time series, so that's the default and any other pick surfaces
  // the API's own validation error as a toast, rather than being blocked client-side).
  const [selectedColumnsForLoad, setSelectedColumnsForLoad] = useState<string[]>(REQUIRED_COLUMNS);
  const [selectedColumnsDropdownOpen, setSelectedColumnsDropdownOpen] = useState(false);
  const selectedColumnsDropdownRef = useRef<HTMLDivElement>(null);
  const toggleSelectedColumnForLoad = (c: string) => {
    setSelectedColumnsForLoad(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };
  useEffect(() => {
    if (!selectedColumnsDropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (selectedColumnsDropdownRef.current && !selectedColumnsDropdownRef.current.contains(e.target as Node)) {
        setSelectedColumnsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [selectedColumnsDropdownOpen]);

  const [loadedData, setLoadedData] = useState<LoadedData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const resetDownstream = () => {
    setLoadedData(null);
    setForecastResult(null);
  };

  const handleSelectTable = async (t: string) => {
    setSelectedTable(t);
    setFilterColumn('');
    setSelectedFilterValues([]);
    setFilterValueOptions([]);
    setSelectedColumnsForLoad([]);
    resetDownstream();
    if (!t) return;
    setColumnsLoading(true);
    try {
      const cols = await fetchColumnsFor(t);
      // Default to the columns the API actually needs, but leave it freely editable.
      setSelectedColumnsForLoad(REQUIRED_COLUMNS.filter(c => cols.includes(c)));
    } catch (err: any) {
      addToast('error', err?.message || `Failed to load columns for ${t}.`);
    } finally {
      setColumnsLoading(false);
    }
  };

  const handleLoadData = async () => {
    if (!selectedTable || selectedColumnsForLoad.length === 0) return;
    setDataLoading(true);
    resetDownstream();
    try {
      const qs = new URLSearchParams({ selected_columns: selectedColumnsForLoad.join(',') });
      if (filterColumn && selectedFilterValues.length > 0) {
        qs.set('filter_column', filterColumn);
        qs.set('filter_value', selectedFilterValues.join(','));
      }
      const res = await fetch(`/api/forecasting/tables/${encodeURIComponent(selectedTable)}?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, 'Failed to load table data.'));
      setLoadedData({
        table: selectedTable,
        filter_column: json.filter_column ?? null,
        filter_value: json.filter_value ?? null,
        rows: json.rows ?? (json.data?.length || 0),
        data: Array.isArray(json.data) ? json.data : [],
      });
      addToast('success', `Loaded ${formatNumber(json.rows ?? json.data?.length ?? 0)} rows from ${selectedTable}.`);
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to load table data.');
    } finally {
      setDataLoading(false);
    }
  };

  const dataSummary = useMemo(() => {
    if (!loadedData || loadedData.data.length === 0) return null;
    let min = loadedData.data[0].Date, max = loadedData.data[0].Date, total = 0;
    for (const r of loadedData.data) {
      if (r.Date < min) min = r.Date;
      if (r.Date > max) max = r.Date;
      total += Number(r.Amount) || 0;
    }
    return { min, max, total, count: loadedData.data.length };
  }, [loadedData]);

  // Preview table search + sort (over the sample of rows the API returns).
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewSortCol, setPreviewSortCol] = useState<'Date' | 'Amount'>('Date');
  const [previewSortDir, setPreviewSortDir] = useState<'asc' | 'desc'>('asc');
  const togglePreviewSort = (col: 'Date' | 'Amount') => {
    if (previewSortCol === col) setPreviewSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setPreviewSortCol(col); setPreviewSortDir('asc'); }
  };
  const previewRows = useMemo(() => {
    if (!loadedData) return [];
    const q = previewSearch.trim().toLowerCase();
    const filtered = q
      ? loadedData.data.filter(r => formatDate(r.Date).toLowerCase().includes(q) || String(r.Amount).includes(q))
      : loadedData.data;
    const sorted = [...filtered].sort((a, b) => {
      const av = previewSortCol === 'Date' ? a.Date : a.Amount;
      const bv = previewSortCol === 'Date' ? b.Date : b.Amount;
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return previewSortDir === 'asc' ? sorted : sorted.reverse();
  }, [loadedData, previewSearch, previewSortCol, previewSortDir]);

  // ── Step 2: forecast ─────────────────────────────────────────────────────
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [periods, setPeriods] = useState(4);
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Results table — sortable columns + a period filter (multi-select on the actual
  // forecasted periods; e.g. with Monthly frequency, pick just the month(s) you want).
  const [forecastSortCol, setForecastSortCol] = useState<'Date' | 'Forecast'>('Date');
  const [forecastSortDir, setForecastSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleForecastSort = (col: 'Date' | 'Forecast') => {
    if (forecastSortCol === col) setForecastSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setForecastSortCol(col); setForecastSortDir('asc'); }
  };
  const [selectedForecastPeriods, setSelectedForecastPeriods] = useState<string[]>([]);
  const [periodFilterOpen, setPeriodFilterOpen] = useState(false);
  const periodFilterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!periodFilterOpen) return;
    const onClick = (e: MouseEvent) => {
      if (periodFilterRef.current && !periodFilterRef.current.contains(e.target as Node)) {
        setPeriodFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [periodFilterOpen]);
  const toggleForecastPeriod = (d: string) => {
    setSelectedForecastPeriods(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const visibleForecastRows = useMemo(() => {
    if (!forecastResult) return [];
    const filtered = selectedForecastPeriods.length > 0
      ? forecastResult.data.filter(d => selectedForecastPeriods.includes(d.Date))
      : forecastResult.data;
    const sorted = [...filtered].sort((a, b) => {
      const av = forecastSortCol === 'Date' ? a.Date : a.Forecast;
      const bv = forecastSortCol === 'Date' ? b.Date : b.Forecast;
      return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return forecastSortDir === 'asc' ? sorted : sorted.reverse();
  }, [forecastResult, selectedForecastPeriods, forecastSortCol, forecastSortDir]);

  const handleRunForecast = async () => {
    if (!loadedData) { addToast('error', 'Load a table’s data first.'); return; }
    setForecastLoading(true);
    setSelectedForecastPeriods([]);
    try {
      const qs = new URLSearchParams({ frequency, count: String(periods) });
      const res = await fetch(`/api/forecasting/forecast?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, 'Failed to generate forecast.'));
      setForecastResult(json);
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to generate forecast.');
    } finally {
      setForecastLoading(false);
    }
  };

  const downloadForecast = () => {
    if (!forecastResult) return;
    // Exports whatever the table is currently showing (filtered + sorted), not the raw response.
    const ws = XLSX.utils.json_to_sheet(visibleForecastRows.map(d => ({ Date: d.Date, Forecast: d.Forecast })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Forecast');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `forecast_${selectedTable}_${frequency}.xlsx`);
  };

  const chartData = useMemo(() => {
    if (!forecastResult) return null;
    return {
      labels: forecastResult.data.map(d => formatDate(d.Date)),
      datasets: [{
        label: 'Forecast',
        data: forecastResult.data.map(d => d.Forecast),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        pointBackgroundColor: '#2563eb',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
      }],
    };
  }, [forecastResult]);

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6">
      {/* Toasts */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-stretch gap-2 w-80">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-2 rounded-lg shadow-lg px-3 py-2.5 text-sm text-white ${
            t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            {t.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span className="leading-snug break-words">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Sales Forecasting</h2>
            <p className="text-xs text-gray-500">Pick a table and generate a time-series forecast</p>
          </div>
        </div>
      </div>

      {/* Step 1: Data Source */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">1</span>
            <h3 className="text-sm font-bold text-gray-800">Data Source</h3>
          </div>
          <button
            onClick={loadTables}
            disabled={tablesLoading}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${tablesLoading ? 'animate-spin' : ''}`} />
            Refresh tables
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Table — custom dropdown (not a native <select>) so the list always opens
              downward and scrolls, instead of the browser sometimes flipping it above
              the field when there isn't room below. */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Table</label>
            <div className="relative" ref={tableDropdownRef}>
              <button
                type="button"
                onClick={() => !tablesLoading && setTableDropdownOpen(o => !o)}
                disabled={tablesLoading}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
              >
                <span className={`truncate ${selectedTable ? 'text-gray-900' : 'text-gray-400'}`}>
                  {tablesLoading ? 'Loading tables…' : selectedTable || 'Select a table'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${tableDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {tableDropdownOpen && !tablesLoading && (
                <div className="absolute z-20 mt-1 w-full max-h-80 overflow-hidden border border-gray-300 rounded-lg bg-white shadow-lg flex flex-col">
                  <div className="flex items-center gap-1.5 p-1.5 border-b border-gray-100">
                    <div className="relative flex-1">
                      <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={tableSearch}
                        onChange={e => setTableSearch(e.target.value)}
                        placeholder="Search tables…"
                        className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setTableSort(s => s === 'asc' ? 'desc' : 'asc')}
                      title={tableSort === 'asc' ? 'Sorted A–Z' : 'Sorted Z–A'}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md border border-gray-200 flex-shrink-0"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      {tableSort === 'asc' ? 'A–Z' : 'Z–A'}
                    </button>
                  </div>
                  <div className="overflow-y-auto p-1">
                    {visibleTables.length === 0 ? (
                      <p className="px-2.5 py-1.5 text-xs text-gray-400">No tables found.</p>
                    ) : (
                      visibleTables.map(t => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => { handleSelectTable(t); setTableDropdownOpen(false); setTableSearch(''); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-sm truncate hover:bg-gray-50 ${t === selectedTable ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}`}
                        >
                          {t}{!isEligible(t) && columnsByTable[t] ? ' (unsupported schema)' : ''}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter column — custom dropdown (same reason as Table), single choice;
              every column the backend returns is listed, same as Selected columns. */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Filter column <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative" ref={filterColumnDropdownRef}>
              <button
                type="button"
                onClick={() => selectedTable && !columnsLoading && setFilterColumnDropdownOpen(o => !o)}
                disabled={!selectedTable || columnsLoading}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <span className={`truncate ${filterColumn ? 'text-gray-900' : 'text-gray-400'}`}>
                  {columnsLoading ? 'Loading columns…' : filterColumn || 'No filter'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${filterColumnDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {filterColumnDropdownOpen && selectedTable && !columnsLoading && (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-lg p-1">
                  <button
                    type="button"
                    onClick={() => { handleSelectFilterColumn(''); setFilterColumnDropdownOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-sm truncate hover:bg-gray-50 ${!filterColumn ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}`}
                  >
                    No filter
                  </button>
                  {filterColumnOptions.map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => { handleSelectFilterColumn(c); setFilterColumnDropdownOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-sm truncate hover:bg-gray-50 ${c === filterColumn ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected columns — every column the backend returns, freely multi-selectable */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Selected columns
              {selectedColumnsForLoad.length > 0 && (
                <span className="ml-1.5 font-normal text-gray-400">({selectedColumnsForLoad.length} selected)</span>
              )}
            </label>
            <div className="relative" ref={selectedColumnsDropdownRef}>
              <button
                type="button"
                onClick={() => selectedTable && !columnsLoading && setSelectedColumnsDropdownOpen(o => !o)}
                disabled={!selectedTable || columnsLoading}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <span className={`truncate ${selectedColumnsForLoad.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                  {columnsLoading
                    ? 'Loading columns…'
                    : selectedColumnsForLoad.length === 0
                      ? 'Select columns…'
                      : selectedColumnsForLoad.length <= 3
                        ? selectedColumnsForLoad.join(', ')
                        : `${selectedColumnsForLoad.length} columns selected`}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${selectedColumnsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {selectedColumnsDropdownOpen && selectedTable && !columnsLoading && (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-lg p-2 space-y-0.5">
                  <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-gray-100">
                    <button type="button" onClick={() => setSelectedColumnsForLoad(selectedColumns)} className="text-[11px] text-blue-600 hover:underline">Select all</button>
                    <button type="button" onClick={() => setSelectedColumnsForLoad(REQUIRED_COLUMNS.filter(c => selectedColumns.includes(c)))} className="text-[11px] text-gray-400 hover:underline">Reset to required</button>
                  </div>
                  {selectedColumns.map(c => {
                    const required = REQUIRED_COLUMNS.includes(c);
                    return (
                      <label key={c} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-gray-50 cursor-pointer rounded">
                        <input
                          type="checkbox"
                          checked={selectedColumnsForLoad.includes(c)}
                          onChange={() => toggleSelectedColumnForLoad(c)}
                          className="h-4 w-4 text-blue-600 rounded flex-shrink-0"
                        />
                        <span className={`text-sm truncate ${required ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                          {c}{required ? ' (required)' : ''}
                        </span>
                      </label>
                    );
                  })}
                  <p className="px-2 pt-1.5 mt-1 border-t border-gray-100 text-[11px] text-gray-400">
                    This API needs exactly GUID, Date and Amount to build a time series — other combinations will return an error.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter value — multi-select checkbox dropdown for the one active filter
            column; the API takes a comma-separated filter_value list. */}
        {filterColumn && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {filterColumn} values
                {selectedFilterValues.length > 0 && (
                  <span className="ml-1.5 font-normal text-gray-400">({selectedFilterValues.length} selected)</span>
                )}
              </label>
              <div className="relative" ref={filterValueDropdownRef}>
                <button
                  type="button"
                  onClick={() => !filterValuesLoading && setFilterValueDropdownOpen(o => !o)}
                  disabled={filterValuesLoading}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <span className={`truncate ${selectedFilterValues.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                    {filterValuesLoading
                      ? 'Loading…'
                      : selectedFilterValues.length === 0
                        ? 'All values'
                        : selectedFilterValues.length <= 2
                          ? selectedFilterValues.join(', ')
                          : `${selectedFilterValues.length} values selected`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${filterValueDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {filterValueDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-lg p-2 space-y-0.5">
                    {filterValueOptions.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-gray-400">No values found.</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-gray-100">
                          <button type="button" onClick={() => setSelectedFilterValues(filterValueOptions)} className="text-[11px] text-blue-600 hover:underline">Select all</button>
                          <button type="button" onClick={() => setSelectedFilterValues([])} className="text-[11px] text-gray-400 hover:underline">Clear</button>
                        </div>
                        {filterValueOptions.map(v => (
                          <label key={v} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedFilterValues.includes(v)}
                              onChange={() => toggleFilterValue(v)}
                              className="h-4 w-4 text-blue-600 rounded flex-shrink-0"
                            />
                            <span className="text-sm text-gray-900 truncate">{v}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              {selectedFilterValues.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedFilterValues.map(v => (
                    <span key={v} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded-full border border-blue-100">
                      {v}
                      <button type="button" onClick={() => toggleFilterValue(v)} className="hover:bg-blue-100 rounded-full p-0.5">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Eligibility banner */}
        {selectedTable && !columnsLoading && !selectedEligible && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              This table can&apos;t be forecast — it needs <b>GUID</b>, <b>Date</b> and <b>Amount</b> columns.
              {columnsByTable[selectedTable]?.length ? <> Found: {columnsByTable[selectedTable].join(', ')}.</> : null}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleLoadData}
            disabled={!selectedTable || columnsLoading || selectedColumnsForLoad.length === 0 || dataLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {dataLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Load Data
          </button>
          {loadedData && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {formatNumber(loadedData.rows)} rows loaded from <b className="text-gray-700">{loadedData.table}</b>
              {loadedData.filter_value && <> filtered to <b className="text-gray-700">{loadedData.filter_value}</b></>}
            </span>
          )}
        </div>

        {/* Summary — sits above the preview table */}
        {loadedData && dataSummary && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Rows</p>
              <p className="text-sm font-bold text-gray-800">{formatNumber(loadedData.rows)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Date range (preview)</p>
              <p className="text-xs font-bold text-gray-800">{formatDate(dataSummary.min)} – {formatDate(dataSummary.max)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total amount (preview)</p>
              <p className="text-sm font-bold text-gray-800">₹{formatNumber(dataSummary.total)}</p>
            </div>
          </div>
        )}

        {/* Preview — search + sortable columns, above the true row total */}
        {loadedData && dataSummary && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="relative w-48">
                <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={e => setPreviewSearch(e.target.value)}
                  placeholder="Search preview…"
                  className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <span className="text-[11px] text-gray-500 flex-shrink-0">
                Showing {formatNumber(previewRows.length)} of <b className="text-gray-700">{formatNumber(loadedData.rows)}</b> rows
              </span>
            </div>
            <div className="border border-gray-100 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-semibold text-gray-500">
                      <button type="button" onClick={() => togglePreviewSort('Date')} className="flex items-center gap-1 hover:text-gray-700">
                        Date <ArrowUpDown className={`w-3 h-3 ${previewSortCol === 'Date' ? 'text-blue-600' : 'text-gray-300'}`} />
                      </button>
                    </th>
                    <th className="text-right px-3 py-1.5 font-semibold text-gray-500">
                      <button type="button" onClick={() => togglePreviewSort('Amount')} className="flex items-center gap-1 ml-auto hover:text-gray-700">
                        Amount <ArrowUpDown className={`w-3 h-3 ${previewSortCol === 'Amount' ? 'text-blue-600' : 'text-gray-300'}`} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 ? (
                    <tr><td colSpan={2} className="px-3 py-3 text-center text-gray-400">No rows match "{previewSearch}".</td></tr>
                  ) : (
                    previewRows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-3 py-1.5 text-gray-600">{formatDate(r.Date)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-800 font-medium">₹{formatNumber(r.Amount, 2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Generate Forecast */}
      <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-4 transition-opacity ${!loadedData ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">2</span>
          <h3 className="text-sm font-bold text-gray-800">Generate Forecast</h3>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Frequency</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['weekly', 'monthly'] as Frequency[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                    frequency === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Periods ahead</label>
            <input
              type="number"
              min={1}
              max={52}
              value={periods}
              onChange={e => setPeriods(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handleRunForecast}
            disabled={!loadedData || forecastLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-40"
          >
            {forecastLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Forecast
          </button>
          {forecastResult && (
            <button
              onClick={downloadForecast}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors ml-auto"
            >
              <Download className="w-3.5 h-3.5" />
              Download Excel
            </button>
          )}
        </div>

        {forecastResult && (
          <div className="mt-5">
            <p className="text-[11px] text-gray-400 mb-3">
              Based on {formatNumber(forecastResult.historical_observations)} historical {forecastResult.frequency} observations · season length {forecastResult.season}
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr,1fr] gap-4">
              <div className="h-64 border border-gray-100 rounded-lg p-3">
                {chartData && (
                  <Line
                    data={chartData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { ticks: { callback: (v) => `₹${formatNumber(Number(v))}` } },
                      },
                    }}
                  />
                )}
              </div>
              <div>
                {/* Period filter — multi-select on the actual forecasted periods */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="relative flex-1" ref={periodFilterRef}>
                    <button
                      type="button"
                      onClick={() => setPeriodFilterOpen(o => !o)}
                      className="w-full flex items-center justify-between px-2.5 py-1 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <span className={`truncate ${selectedForecastPeriods.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                        {selectedForecastPeriods.length === 0
                          ? 'All periods'
                          : selectedForecastPeriods.length <= 2
                            ? selectedForecastPeriods.map(formatDate).join(', ')
                            : `${selectedForecastPeriods.length} periods selected`}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${periodFilterOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {periodFilterOpen && (
                      <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-lg p-2 space-y-0.5">
                        <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-gray-100">
                          <button type="button" onClick={() => setSelectedForecastPeriods(forecastResult.data.map(d => d.Date))} className="text-[11px] text-blue-600 hover:underline">Select all</button>
                          <button type="button" onClick={() => setSelectedForecastPeriods([])} className="text-[11px] text-gray-400 hover:underline">Clear</button>
                        </div>
                        {forecastResult.data.map(d => (
                          <label key={d.Date} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedForecastPeriods.includes(d.Date)}
                              onChange={() => toggleForecastPeriod(d.Date)}
                              className="h-4 w-4 text-blue-600 rounded flex-shrink-0"
                            />
                            <span className="text-sm text-gray-900 truncate">{formatDate(d.Date)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-500 flex-shrink-0">{formatNumber(visibleForecastRows.length)} of {formatNumber(forecastResult.data.length)}</span>
                </div>
                <div className="border border-gray-100 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-semibold text-gray-500">
                          <button type="button" onClick={() => toggleForecastSort('Date')} className="flex items-center gap-1 hover:text-gray-700">
                            Period <ArrowUpDown className={`w-3 h-3 ${forecastSortCol === 'Date' ? 'text-blue-600' : 'text-gray-300'}`} />
                          </button>
                        </th>
                        <th className="text-right px-3 py-1.5 font-semibold text-gray-500">
                          <button type="button" onClick={() => toggleForecastSort('Forecast')} className="flex items-center gap-1 ml-auto hover:text-gray-700">
                            Forecast <ArrowUpDown className={`w-3 h-3 ${forecastSortCol === 'Forecast' ? 'text-blue-600' : 'text-gray-300'}`} />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleForecastRows.length === 0 ? (
                        <tr><td colSpan={2} className="px-3 py-3 text-center text-gray-400">No periods selected.</td></tr>
                      ) : (
                        visibleForecastRows.map((d, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="px-3 py-1.5 text-gray-600">{formatDate(d.Date)}</td>
                            <td className="px-3 py-1.5 text-right text-blue-700 font-semibold">₹{formatNumber(d.Forecast, 2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
