'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FaSync, FaTimes, FaSearch, FaChevronLeft, FaChevronRight,
  FaTable, FaChartBar, FaCalendarAlt, FaFileAlt,
  FaCheckSquare, FaRegSquare, FaPlay, FaDownload,
  FaSort, FaSortUp, FaSortDown, FaChevronDown, FaSave, FaDatabase,
} from 'react-icons/fa';
import { MdArrowDropDown } from 'react-icons/md';

const API_BASE = 'https://temp-database.vercel.app';
const PER_PAGE = 20;

// ── Types ─────────────────────────────────────────────────────
type Row = Record<string, string | number | null | undefined>;

// ── Parse /tables/ → { total_tables, tables:[...] } OR plain array ──
function extractTableNames(res: unknown): string[] {
  if (Array.isArray(res)) return res.map(t => (typeof t === 'string' ? t : String(t)));
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    for (const k of ['tables', 'data', 'result', 'items']) {
      if (Array.isArray(r[k])) return (r[k] as unknown[]).map(t => (typeof t === 'string' ? t : String(t)));
    }
  }
  return [];
}

// ── Parse table data response → { rows, columns } ────────────
// Reads the explicit "columns" array from the API (preserves order + all cols)
// then falls back to Object.keys of the first row if not present.
function extractData(res: unknown): { rows: Row[]; columns: string[] } {
  let rows: Row[]       = [];
  let columns: string[] = [];

  if (Array.isArray(res)) {
    rows    = res as Row[];
    columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  } else if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    // Prefer the explicit 'columns' list — ensures ALL cols show, even if first row is all-null
    if (Array.isArray(r.columns)) {
      columns = (r.columns as unknown[]).map(c => String(c));
    }
    for (const k of ['data', 'rows', 'result', 'items', 'records']) {
      if (Array.isArray(r[k])) {
        rows = r[k] as Row[];
        if (columns.length === 0 && rows.length > 0) columns = Object.keys(rows[0]);
        break;
      }
    }
  }

  return { rows, columns };
}

// Convenience wrapper for callers that only need rows (monthly, outstanding)
function extractRows(res: unknown): Row[] {
  return extractData(res).rows;
}

// ── Extract unique ledger names from the loaded rows ──────────
function extractLedgerNames(rows: Row[]): string[] {
  const set = new Set<string>();
  const keys = ['ledger_name', 'Ledger_Name', 'LEDGER_NAME', 'Party Ledger', 'party_ledger', 'Ledger Name'];
  rows.forEach(row => {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim()) { set.add(String(row[k]).trim()); break; }
    }
  });
  return Array.from(set).sort();
}

// ── CSV / Excel download helper ───────────────────────────────
function downloadCSV(rows: Row[], filename: string, colList?: string[]) {
  if (rows.length === 0) return;
  const cols   = colList && colList.length > 0 ? colList : Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    cols.map(escape).join(','),
    ...rows.map(r => cols.map(c => escape(r[c])).join(',')),
  ];
  const BOM  = '﻿'; // UTF-8 BOM → Excel opens accented chars correctly
  const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════
// Pagination Bar — bottom only
// ══════════════════════════════════════════════════════════════
interface PaginationProps {
  page: number;
  total: number;
  count: number;
  filtered: number;
  onChange: (p: number) => void;
}
function PaginationBar({ page, total, count, filtered, onChange }: PaginationProps) {
  const start = Math.max(1, Math.min(page - 2, total - 4));
  const nums  = Array.from({ length: Math.min(5, total) }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t border-gray-200 flex-wrap gap-1.5 flex-shrink-0">
      <p className="text-xs text-gray-500 whitespace-nowrap">
        Page <strong className="text-gray-700">{page}</strong> of{' '}
        <strong className="text-gray-700">{total}</strong>
        &nbsp;·&nbsp;
        <strong className="text-gray-700">{count}</strong> / {filtered} rows
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(1)} disabled={page === 1}
          className="px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
          «
        </button>
        <button
          onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 transition-colors">
          <FaChevronLeft size={9} />
        </button>
        {nums.map(n => (
          <button key={n} onClick={() => onChange(n)}
            className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${
              n === page
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
            }`}>
            {n}
          </button>
        ))}
        <button
          onClick={() => onChange(page + 1)} disabled={page === total}
          className="p-1.5 rounded border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 transition-colors">
          <FaChevronRight size={9} />
        </button>
        <button
          onClick={() => onChange(total)} disabled={page === total}
          className="px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
          »
        </button>
      </div>
    </div>
  );
}

// Parses date strings in ISO (2024-04-02T…) and YYYYMMDD (20240402) formats
function parseRowDate(v: unknown): Date | null {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  if (/^\d{8}$/.test(s)) s = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ══════════════════════════════════════════════════════════════
// Quick-Select Dropdown — always opens downward (fixed position)
// ══════════════════════════════════════════════════════════════
function QuickSelectDropdown({
  value, options, onChange, placeholder, active,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  placeholder: string;
  active?: boolean;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const btnRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Compute panel position fresh at render time — avoids stale-state upward opening
  const getPanelStyle = (): React.CSSProperties => {
    if (!btnRef.current) return { position: 'fixed', top: 0, left: 0, zIndex: 9999 };
    const r = btnRef.current.getBoundingClientRect();
    return {
      position: 'fixed',
      top:      r.bottom + 4,
      left:     r.left,
      minWidth: Math.max(r.width, 160),
      zIndex:   9999,
    };
  };

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative flex-shrink-0">
      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setSearch(''); setOpen(v => !v); }}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs border rounded focus:outline-none bg-white transition-colors ${
          active
            ? 'border-violet-400 text-violet-700 font-medium'
            : 'border-gray-200 text-gray-500 hover:border-gray-300'
        }`}
        style={{ minWidth: 110 }}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <FaChevronDown size={8} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel — position computed inline so it always opens downward */}
      {open && (
        <div ref={panelRef} style={getPanelStyle()}
          className="bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-1.5 border-b border-gray-100">
            <div className="relative">
              <FaSearch size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
          </div>
          {/* Scrollable list */}
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {filtered.length === 0
              ? <p className="text-xs text-gray-400 text-center py-3">No results</p>
              : filtered.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors whitespace-nowrap ${
                      o.value === value
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-gray-700 hover:bg-indigo-50/60'
                    }`}
                  >
                    {o.value === value
                      ? <FaCheckSquare size={10} className="text-indigo-500 flex-shrink-0" />
                      : <FaRegSquare   size={10} className="text-gray-300 flex-shrink-0" />
                    }
                    {o.label}
                  </button>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Data Table — column filters · hide/unhide · filtered Excel
// ══════════════════════════════════════════════════════════════
interface DataTableProps {
  title: string;
  subtitle?: string;
  rows: Row[];
  loading?: boolean;
  accentClass: string;
  headerActions?: React.ReactNode;
  onClose?: () => void;
  maxHeight?: string;
  colDef?: string[];
}
function DataTable({
  title, subtitle, rows, loading, accentClass,
  headerActions, onClose, maxHeight, colDef,
}: DataTableProps) {
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [sortCol,     setSortCol]     = useState<string | null>(null);
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('asc');
  const [colFilters,  setColFilters]  = useState<Record<string, string>>({});
  const [hiddenCols,  setHiddenCols]  = useState<Set<string>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const [filterMonth, setFilterMonth] = useState(0);   // 0 = all months
  const [filterYear,  setFilterYear]  = useState('');  // '' = all years
  const colMenuRef = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const allColumns = colDef && colDef.length > 0
    ? colDef
    : rows.length > 0 ? Object.keys(rows[0]) : [];
  const columns = allColumns.filter(c => !hiddenCols.has(c));

  // Pick the date-named column with the MOST parseable values (best coverage)
  const dateColForFilter = useMemo(() => {
    if (rows.length === 0) return null;
    const pool = allColumns.filter(c => /date|time/i.test(c));
    const search = pool.length > 0 ? pool : allColumns;
    let best: string | null = null;
    let bestCount = 0;
    for (const c of search) {
      const count = rows.reduce((n, r) => n + (parseRowDate(r[c]) !== null ? 1 : 0), 0);
      if (count > bestCount) { bestCount = count; best = c; }
    }
    return bestCount > 0 ? best : null;
  }, [allColumns, rows]);

  const uniqueYears = useMemo(() => {
    if (!dateColForFilter) return [];
    const ys = new Set<string>();
    rows.forEach(r => {
      const d = parseRowDate(r[dateColForFilter]);
      if (d) ys.add(String(d.getFullYear()));
    });
    return Array.from(ys).sort();
  }, [rows, dateColForFilter]);

  // Close column menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Global search + per-column filters + month / year quick-filter
  const filtered = rows.filter(r => {
    if (search && !allColumns.some(c => String(r[c] ?? '').toLowerCase().includes(search.toLowerCase()))) return false;
    for (const [col, val] of Object.entries(colFilters)) {
      if (val && !String(r[col] ?? '').toLowerCase().includes(val.toLowerCase())) return false;
    }
    if (dateColForFilter && (filterMonth > 0 || filterYear)) {
      const d = parseRowDate(r[dateColForFilter]);
      if (!d) return false;                                              // no date → exclude
      if (filterMonth > 0 && d.getMonth() + 1 !== filterMonth) return false;
      if (filterYear && String(d.getFullYear()) !== filterYear) return false;
    }
    return true;
  });

  // Sort
  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        const an = Number(av), bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn)
          ? an - bn
          : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const activeColFilters = Object.values(colFilters).filter(Boolean).length;

  const total    = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safeP    = Math.min(page, total);
  const pageRows = sorted.slice((safeP - 1) * PER_PAGE, safeP * PER_PAGE);

  const changePage = (p: number) => setPage(Math.max(1, Math.min(total, p)));

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  // Sort icon helper
  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <FaSort size={9} className="text-gray-300 ml-0.5 flex-shrink-0" />;
    return sortDir === 'asc'
      ? <FaSortUp   size={10} className="text-indigo-500 ml-0.5 flex-shrink-0" />
      : <FaSortDown size={10} className="text-indigo-500 ml-0.5 flex-shrink-0" />;
  };

  return (
    /* Outer card: flex-col so header + table + pagination stack cleanly */
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden"
      style={{ maxHeight: maxHeight || 'calc(100vh - 220px)' }}
    >
      {/* ── Card header ── */}
      <div className={`px-3 py-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 flex-shrink-0 ${accentClass}`}>
        <div>
          <h3 className="text-xs font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {rows.length > 0 && (
            <div className="relative">
              <FaSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={9} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search…"
                className="pl-6 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white w-28"
              />
            </div>
          )}
          {/* Month quick-filter */}
          {rows.length > 0 && dateColForFilter && (
            <select
              value={filterMonth}
              onChange={e => { setFilterMonth(Number(e.target.value)); setPage(1); }}
              className={`px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white ${
                filterMonth > 0 ? 'border-indigo-400 text-indigo-700 font-medium' : 'border-gray-200 text-gray-500'
              }`}
            >
              <option value={0}>All Months</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          )}
          {/* Period / Year quick-filter */}
          {rows.length > 0 && dateColForFilter && uniqueYears.length > 0 && (
            <select
              value={filterYear}
              onChange={e => { setFilterYear(e.target.value); setPage(1); }}
              className={`px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white ${
                filterYear ? 'border-indigo-400 text-indigo-700 font-medium' : 'border-gray-200 text-gray-500'
              }`}
            >
              <option value="">All Periods</option>
              {uniqueYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          {/* Columns toggle */}
          {rows.length > 0 && (
            <div className="relative" ref={colMenuRef}>
              <button
                onClick={() => setShowColMenu(v => !v)}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
                  hiddenCols.size > 0
                    ? 'border-indigo-400 text-indigo-600 bg-indigo-50'
                    : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
                }`}
              >
                <FaTable size={9} />
                Cols {hiddenCols.size > 0 && <span className="bg-indigo-600 text-white text-[9px] rounded-full px-1">{allColumns.length - hiddenCols.size}/{allColumns.length}</span>}
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 max-h-64 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-600 uppercase">Toggle Columns</span>
                    <button onClick={() => setHiddenCols(new Set())} className="text-[10px] text-blue-500 hover:underline">Show All</button>
                  </div>
                  {allColumns.map(col => (
                    <label key={col} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={!hiddenCols.has(col)}
                        onChange={() => setHiddenCols(prev => {
                          const n = new Set(prev);
                          n.has(col) ? n.delete(col) : n.add(col);
                          return n;
                        })}
                        className="w-3 h-3 accent-indigo-600"
                      />
                      <span className="text-xs text-gray-700 truncate">{col}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Excel — downloads only visible filtered rows */}
          {rows.length > 0 && (
            <button
              onClick={() => downloadCSV(sorted, `${title}.csv`, columns)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
              title={`Download ${sorted.length} filtered rows`}
            >
              <FaDownload size={9} /> Excel ({sorted.length})
            </button>
          )}
          {headerActions}
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/60 transition-colors">
              <FaTimes size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex items-center justify-center py-14 text-gray-400 flex-1">
          <FaSync className="animate-spin mr-2" size={14} />
          <span className="text-sm">Loading data…</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center py-10 text-sm text-gray-400 flex-1">No data returned</p>
      ) : (
        <>
          <div ref={tableWrapRef} className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 600 }}>
              <thead>
                {/* ── Sort header ── */}
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-400 w-10 border-b border-gray-200 sticky top-0 left-0 z-30 bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">#</th>
                  {columns.map(col => (
                    <th key={col} onClick={() => toggleSort(col)}
                      className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-b border-gray-200 sticky top-0 z-20 bg-gray-50 cursor-pointer select-none hover:bg-indigo-50 transition-colors group">
                      <div className="flex items-center gap-0.5">
                        {col}
                        <SortIcon col={col} />
                      </div>
                    </th>
                  ))}
                </tr>
                {/* ── Per-column filter row (always visible) ── */}
                <tr className="bg-violet-50/60">
                  <th className="px-2 py-1 sticky top-[33px] left-0 z-30 bg-violet-50/60">
                    {activeColFilters > 0 && (
                      <button onClick={() => setColFilters({})} title="Clear all column filters"
                        className="text-[9px] text-violet-500 hover:text-violet-700">✕</button>
                    )}
                  </th>
                  {columns.map(col => (
                    <th key={col} className="px-1.5 py-1 sticky top-[33px] z-20 bg-violet-50/60">
                      <input
                        type="text"
                        value={colFilters[col] || ''}
                        onChange={e => { setColFilters(f => ({ ...f, [col]: e.target.value })); setPage(1); }}
                        placeholder="Filter…"
                        className="w-full px-1.5 py-0.5 text-[10px] border border-violet-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={i} className={`hover:bg-indigo-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-3 py-2 text-gray-400 tabular-nums border-b border-gray-50 sticky left-0 z-10 bg-inherit shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                      {(safeP - 1) * PER_PAGE + i + 1}
                    </td>
                    {columns.map(col => (
                      <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap border-b border-gray-50">
                        {row[col] == null ? <span className="text-gray-300">—</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={safeP} total={total} count={pageRows.length} filtered={sorted.length} onChange={changePage} />
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Modal Form (API 3 Monthly / API 4 Outstanding)
// ══════════════════════════════════════════════════════════════
interface ModalFormProps {
  type: 'monthly' | 'outstanding';
  ledgerNames: string[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (params: Record<string, string>) => void;
}
function ReportModalForm({ type, ledgerNames, loading, onClose, onSubmit }: ModalFormProps) {
  const isMonthly   = type === 'monthly';
  const accent      = 'bg-blue-600';
  const accentHover = 'hover:bg-blue-700';
  const accentRing  = 'focus:ring-blue-400';
  const Icon        = isMonthly ? FaCalendarAlt : FaChartBar;

  const [ledger,   setLedger]   = useState(ledgerNames[0] || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');
  const [period,   setPeriod]   = useState('Day');
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [ledgerQ,  setLedgerQ]  = useState('');
  const [dropOpen, setDropOpen] = useState(false);

  const filteredLedgers = ledgerQ
    ? ledgerNames.filter(n => n.toLowerCase().includes(ledgerQ.toLowerCase()))
    : ledgerNames;

  // Convert HTML date picker value (YYYY-MM-DD) → YYYYMMDD for the API
  const toAPIDate = (d: string) => d.replace(/-/g, '');

  const validate = () => {
    const e: Record<string, string> = {};
    if (!ledger)   e.ledger = 'Select a ledger name';
    if (!fromDate) e.from   = 'Pick a from date';
    if (!toDate)   e.to     = 'Pick a to date';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const p: Record<string, string> = {
      ledger_name: ledger,
      from_date:   toAPIDate(fromDate),
      to_date:     toAPIDate(toDate),
    };
    if (isMonthly) p.period = period;
    onSubmit(p);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className={`${accent} px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Icon className="text-white" size={15} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">
                {isMonthly ? 'Monthly Provision' : 'Outstanding Report'}
              </h3>
              <p className="text-white/70 text-xs mt-0.5">
                {isMonthly ? '/monthly_provision/' : '/outstanding_report_data/'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <FaTimes size={15} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">

          {/* Ledger searchable dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Ledger Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropOpen(v => !v)}
                className={`w-full flex items-center justify-between border rounded-xl px-3 py-2.5 text-sm text-left ${
                  errors.ledger ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                } focus:outline-none focus:ring-2 ${accentRing}`}
              >
                <span className={`truncate ${ledger ? 'text-gray-800' : 'text-gray-400'}`}>
                  {ledger || 'Select ledger…'}
                </span>
                <MdArrowDropDown size={20} className="text-gray-400 flex-shrink-0" />
              </button>
              {dropOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={10} />
                      <input
                        autoFocus
                        value={ledgerQ}
                        onChange={e => setLedgerQ(e.target.value)}
                        placeholder="Search ledger…"
                        className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredLedgers.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-4">No ledger found</p>
                      : filteredLedgers.map(name => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => { setLedger(name); setDropOpen(false); setLedgerQ(''); }}
                            className={`w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 transition-colors truncate ${
                              ledger === name ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {name}
                          </button>
                        ))
                    }
                  </div>
                </div>
              )}
            </div>
            {errors.ledger && <p className="text-red-500 text-xs mt-1">{errors.ledger}</p>}
          </div>

          {/* From / To — custom date pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                From Date <span className="text-red-500">*</span>
              </label>
              <div className={errors.from ? 'ring-2 ring-red-300 rounded-xl' : ''}>
                <DateField label="" value={fromDate} onChange={setFromDate} />
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-gray-400 text-[10px]">API format:</span>
                <span className={`text-[10px] font-mono font-bold ${fromDate ? 'text-blue-600' : 'text-gray-300'}`}>
                  {fromDate ? fromDate.replace(/-/g, '') : 'YYYYMMDD'}
                </span>
              </div>
              {errors.from && <p className="text-red-500 text-xs mt-0.5">{errors.from}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                To Date <span className="text-red-500">*</span>
              </label>
              <div className={errors.to ? 'ring-2 ring-red-300 rounded-xl' : ''}>
                <DateField label="" value={toDate} onChange={setToDate} />
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-gray-400 text-[10px]">API format:</span>
                <span className={`text-[10px] font-mono font-bold ${toDate ? 'text-blue-600' : 'text-gray-300'}`}>
                  {toDate ? toDate.replace(/-/g, '') : 'YYYYMMDD'}
                </span>
              </div>
              {errors.to && <p className="text-red-500 text-xs mt-0.5">{errors.to}</p>}
            </div>
          </div>

          {/* Period (monthly only) */}
          {isMonthly && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Period <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Day', 'Month', 'Year'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      period === p
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${accent} ${accentHover} disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm`}
          >
            {loading
              ? <><FaSync className="animate-spin" size={12} /> Fetching…</>
              : <><FaPlay size={11} /> Run Report</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Result Modal — wide overlay for Monthly / Outstanding results
// ══════════════════════════════════════════════════════════════
interface ResultModalProps {
  type: 'monthly' | 'outstanding';
  rows: Row[];
  onBack: () => void;
  onClose: () => void;
}
function ResultModal({ type, rows, onBack, onClose }: ResultModalProps) {
  const isMonthly = type === 'monthly';
  const title     = isMonthly ? 'Monthly Provision' : 'Outstanding Report';
  const endpoint  = isMonthly ? '/monthly_provision/' : '/outstanding_report_data/';
  const filename  = isMonthly ? 'Monthly_Provision.csv' : 'Outstanding_Report.csv';
  const Icon      = isMonthly ? FaCalendarAlt : FaChartBar;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
    >
      {/* Modal container — wide but not full screen, respects 92vh */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ maxHeight: '92vh' }}
      >
        {/* ── Blue header ── */}
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
          {/* Left: icon + title + meta */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Icon className="text-white" size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-sm tracking-wide truncate">{title}</h2>
              <p className="text-white/70 text-xs mt-0.5 truncate">
                <span className="font-semibold text-white">{rows.length}</span> records &nbsp;·&nbsp;
                {PER_PAGE} per page &nbsp;·&nbsp;
                <span className="font-mono opacity-70">{endpoint}</span>
              </p>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Download Excel (CSV) */}
            <button
              onClick={() => downloadCSV(rows, filename)}
              title="Download as Excel / CSV"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors border border-white/20">
              <FaDownload size={11} />
              <span className="hidden sm:inline">Excel</span>
            </button>
            {/* Back — re-opens form */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors border border-white/20">
              <FaChevronLeft size={10} />
              Back
            </button>
            {/* Close — clears result */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors shadow-sm">
              <FaTimes size={10} />
              Close
            </button>
          </div>
        </div>

        {/* ── DataTable fills remaining modal height ── */}
        <div className="flex-1 min-h-0 p-4">
          <DataTable
            title={title}
            subtitle={`${rows.length} records · ${PER_PAGE} per page · click any column header to sort`}
            rows={rows}
            accentClass={
              isMonthly
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50/40'
                : 'bg-gradient-to-r from-sky-50 to-blue-50/40'
            }
            /* height = modal (92vh) - modal-header (72px) - outer-padding (32px) - inner-padding (32px) */
            maxHeight="calc(92vh - 136px)"
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Multi-select dropdown for filter values
// ══════════════════════════════════════════════════════════════
function MultiSelectDropdown({
  values, selected, onChange, loading, disabled,
}: {
  values: string[]; selected: string[];
  onChange: (vals: string[]) => void;
  loading?: boolean; disabled?: boolean;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = search ? values.filter(v => v.toLowerCase().includes(search.toLowerCase())) : values;
  const toggle = (val: string) => onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled || loading}
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between border rounded px-2 py-1 text-xs bg-gray-50 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-40 ${
          selected.length > 0 ? 'border-violet-400 text-violet-700' : 'border-gray-200 text-gray-500'
        }`}>
        <span className="truncate">
          {loading ? 'Loading values…'
            : disabled ? 'Select a column first'
            : selected.length === 0 ? 'Select values…'
            : `${selected.length} selected: ${selected.slice(0,2).join(', ')}${selected.length > 2 ? '…' : ''}`}
        </span>
        <FaChevronRight size={8} className={`text-gray-400 ml-1 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && !disabled && (
        <div
          className="bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col"
          style={{
            position: 'fixed', zIndex: 9999, width: 280,
            top: ref.current ? ref.current.getBoundingClientRect().bottom + 4 : 0,
            left: ref.current ? ref.current.getBoundingClientRect().left : 0,
          }}
        >
          <div className="p-1.5 border-b border-gray-100">
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search values…"
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-400" />
          </div>
          {selected.length > 0 && (
            <div className="px-2 py-1 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-violet-600 font-semibold">{selected.length} selected</span>
              <button onClick={() => onChange([])} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear all</button>
            </div>
          )}
          <div className="overflow-y-auto max-h-44">
            {filtered.length === 0
              ? <p className="text-xs text-gray-400 text-center py-3">No values found</p>
              : filtered.map(val => (
                  <label key={val} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-violet-50 cursor-pointer">
                    <input type="checkbox" checked={selected.includes(val)} onChange={() => toggle(val)}
                      className="w-3 h-3 accent-violet-600 flex-shrink-0" />
                    <span className="text-xs text-gray-700 truncate">{val}</span>
                  </label>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Filter types
// ══════════════════════════════════════════════════════════════
interface FilterState {
  selectedColumns: string[];   // which columns to fetch (empty = all)
  filterColumn:    string;
  filterValues:    string[];   // multi-select → joined with comma for API
  dateColumn:      string;
  fromDate:        string;
  toDate:          string;
  groupBy:         string;
  aggFunc:         string;
  saveToDb:        boolean;
  saveTableName:   string;
}
// Default dates = first and last day of the current month
const _now = new Date();
const _y = _now.getFullYear();
const _m = _now.getMonth() + 1;
const _firstDay = `${_y}-${String(_m).padStart(2,'0')}-01`;
const _lastDay  = new Date(_y, _m, 0);
const _lastDayStr = `${_lastDay.getFullYear()}-${String(_lastDay.getMonth()+1).padStart(2,'0')}-${String(_lastDay.getDate()).padStart(2,'0')}`;

const EMPTY_FILTERS: FilterState = {
  selectedColumns: [],
  filterColumn: '', filterValues: [], dateColumn: '',
  fromDate: '', toDate: '',
  groupBy: '', aggFunc: 'sum',
  saveToDb: false, saveTableName: '',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ══════════════════════════════════════════════════════════════
// Custom Date Picker — year grid → month grid → day grid
// ══════════════════════════════════════════════════════════════
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function DateField({
  label, value, onChange, disabled,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;

  const [open,       setOpen]       = useState(false);
  const [view,       setView]       = useState<'day'|'month'|'year'>('day');
  const [dispY,      setDispY]      = useState(parsed?.getFullYear()  ?? today.getFullYear());
  const [dispM,      setDispM]      = useState(parsed?.getMonth()     ?? today.getMonth());
  const [yrBase,     setYrBase]     = useState(Math.floor((parsed?.getFullYear() ?? today.getFullYear()) / 12) * 12);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const wrapRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const openPicker = () => {
    if (disabled) return;
    const base = parsed?.getFullYear() ?? today.getFullYear();
    setDispY(parsed?.getFullYear() ?? today.getFullYear());
    setDispM(parsed?.getMonth()    ?? today.getMonth());
    setYrBase(Math.floor(base / 12) * 12);
    setView('day');
    // Calculate fixed position from trigger element
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 320) {
        // Not enough space below → open upward
        setPopupStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: 256 });
      } else {
        setPopupStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: 256 });
      }
    }
    setOpen(true);
  };

  const selectDate = (y: number, m: number, d: number) => {
    onChange(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    setOpen(false);
  };

  // Day grid helpers
  const daysInMonth  = (y: number, m: number) => new Date(y, m+1, 0).getDate();
  const firstWeekday = (y: number, m: number) => new Date(y, m, 1).getDay();

  const display = parsed
    ? parsed.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : '';

  return (
    <div className="flex-1">
      {label && <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>}

      {/* Trigger */}
      <div ref={triggerRef} onClick={openPicker}
        className={`flex items-center rounded-lg border transition-all select-none ${
          disabled
            ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
            : 'bg-white border-gray-300 hover:border-blue-400 cursor-pointer' + (open ? ' border-blue-500 ring-2 ring-blue-100' : '')
        }`}
      >
        <FaCalendarAlt size={11} className="ml-2.5 text-blue-400 flex-shrink-0" />
        <div className="flex-1 px-2 py-2 min-w-0">
          {display
            ? <span className="text-xs font-medium text-gray-800">{display}</span>
            : <span className="text-xs text-gray-400">Select date</span>
          }
        </div>
        {value && !disabled && (
          <button type="button" onClick={e => { e.stopPropagation(); onChange(''); }}
            className="mr-2 text-gray-300 hover:text-red-400 flex-shrink-0">
            <FaTimes size={9} />
          </button>
        )}
      </div>

      {/* Popup — fixed so it escapes any overflow-hidden parent */}
      {open && (
        <div ref={wrapRef} style={popupStyle} className="z-[9999] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">

          {/* ─── YEAR VIEW ─── */}
          {view === 'year' && (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <button onClick={() => setYrBase(b => b - 12)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronLeft size={9} />
                </button>
                <span className="text-xs font-bold text-gray-700">{yrBase} – {yrBase+11}</span>
                <button onClick={() => setYrBase(b => b + 12)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronRight size={9} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 p-2">
                {Array.from({length:12},(_,i)=>yrBase+i).map(yr => (
                  <button key={yr} onClick={() => { setDispY(yr); setView('month'); }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      yr === (parsed?.getFullYear() ?? -1)
                        ? 'bg-blue-600 text-white shadow-sm'
                        : yr === today.getFullYear()
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : yr > today.getFullYear() + 5
                            ? 'text-gray-300 cursor-default'
                            : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    {yr}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ─── MONTH VIEW ─── */}
          {view === 'month' && (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <button onClick={() => { setDispY(y => y-1); }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronLeft size={9} />
                </button>
                <button onClick={() => setView('year')}
                  className="text-xs font-bold text-gray-700 hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-gray-50">
                  {dispY}
                </button>
                <button onClick={() => { setDispY(y => y+1); }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronRight size={9} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 p-2">
                {MONTHS.map((m, mi) => (
                  <button key={m} onClick={() => { setDispM(mi); setView('day'); }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      mi === (parsed?.getMonth() ?? -1) && dispY === (parsed?.getFullYear() ?? -1)
                        ? 'bg-blue-600 text-white shadow-sm'
                        : mi === today.getMonth() && dispY === today.getFullYear()
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ─── DAY VIEW ─── */}
          {view === 'day' && (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <button onClick={() => { if (dispM === 0) { setDispM(11); setDispY(y=>y-1); } else setDispM(m=>m-1); }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronLeft size={9} />
                </button>
                <button onClick={() => setView('month')}
                  className="text-xs font-bold text-gray-700 hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-gray-50">
                  {MONTHS[dispM]} {dispY}
                </button>
                <button onClick={() => { if (dispM === 11) { setDispM(0); setDispY(y=>y+1); } else setDispM(m=>m+1); }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronRight size={9} />
                </button>
              </div>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 px-1.5 pt-1.5">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[9px] font-bold text-gray-400 py-0.5">{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 px-1.5 pb-1.5 gap-y-0.5">
                {Array.from({length: firstWeekday(dispY, dispM)}).map((_,i) => <div key={'e'+i} />)}
                {Array.from({length: daysInMonth(dispY, dispM)},(_,i)=>i+1).map(d => {
                  const isSelected = parsed?.getFullYear()===dispY && parsed?.getMonth()===dispM && parsed?.getDate()===d;
                  const isToday    = today.getFullYear()===dispY && today.getMonth()===dispM && today.getDate()===d;
                  return (
                    <button key={d} onClick={() => selectDate(dispY, dispM, d)}
                      className={`h-6 w-full rounded-full text-[11px] font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-sm'
                          : isToday
                            ? 'bg-blue-50 text-blue-600 border border-blue-300'
                            : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                      }`}>
                      {d}
                    </button>
                  );
                })}
              </div>
              {/* Today shortcut */}
              <div className="pb-2 text-center border-t border-gray-100 pt-1.5">
                <button onClick={() => selectDate(today.getFullYear(), today.getMonth(), today.getDate())}
                  className="text-[10px] font-semibold text-blue-500 hover:text-blue-700 hover:underline">
                  Today
                </button>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── Table selector dropdown — custom, always opens downward ──
function TableDropdown({
  tables, selected, loading, error, disabled, onSelect, onRetry,
}: {
  tables: string[]; selected: string | null;
  loading: boolean; error: string; disabled: boolean;
  onSelect: (t: string) => void; onRetry: () => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref    = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [style, setStyle]   = useState<React.CSSProperties>({});

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const openDropdown = () => {
    if (disabled || loading || error) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setStyle({ position: 'fixed', top: r.bottom + 2, left: r.left, width: r.width, zIndex: 9999 });
    }
    setSearch('');
    setOpen(v => !v);
  };

  const filtered = search ? tables.filter(t => t.toLowerCase().includes(search.toLowerCase())) : tables;

  if (loading) return (
    <div className="flex items-center gap-1.5 text-gray-400 text-xs">
      <FaSync className="animate-spin" size={11} /> Loading tables…
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-2">
      <span className="text-red-500 text-xs">{error}</span>
      <button onClick={onRetry} className="text-indigo-600 text-xs hover:underline">Retry</button>
    </div>
  );

  return (
    <div className="flex-1 min-w-[200px] max-w-xs">
      {/* Trigger */}
      <button ref={btnRef} type="button" onClick={openDropdown}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 border rounded-lg text-xs transition-all ${
          open ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-300 hover:border-indigo-400'
        } bg-white`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <FaTable size={10} className="text-indigo-500 flex-shrink-0" />
          <span className={`truncate ${selected ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
            {selected || '— Select a table —'}
          </span>
        </div>
        <FaChevronDown size={9} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel — fixed position, always below */}
      {open && (
        <div ref={ref} style={style}
          className="bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-1.5 border-b border-gray-100">
            <div className="relative">
              <FaSearch size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tables…"
                className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400" />
            </div>
          </div>
          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0
              ? <p className="text-xs text-gray-400 text-center py-3">No tables found</p>
              : filtered.map(t => (
                  <button key={t} type="button"
                    onClick={() => { onSelect(t); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      t === selected
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-gray-700 hover:bg-indigo-50/60'
                    }`}
                  >
                    <FaTable size={9} className={t === selected ? 'text-indigo-500' : 'text-gray-400'} />
                    {t}
                    {t === selected && <FaCheckSquare size={10} className="ml-auto text-indigo-500" />}
                  </button>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// Main Report Component
// ══════════════════════════════════════════════════════════════
export default function ReportComponent() {
  // Table list
  const [tables,        setTables]        = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError,   setTablesError]   = useState('');

  // Table data
  const [tableRows,    setTableRows]    = useState<Row[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [runTableName, setRunTableName] = useState('');
  const [limit,        setLimit]        = useState(100);
  const [ledgerNames,  setLedgerNames]  = useState<string[]>([]);

  // Filters
  const [filters,       setFilters]       = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters,   setShowFilters]   = useState(false);
  const [uniqueValues,  setUniqueValues]  = useState<string[]>([]);
  const [uniqueLoading, setUniqueLoading] = useState(false);

  // Modal (form)
  const [activeModal,     setActiveModal]     = useState<'monthly' | 'outstanding' | null>(null);
  const [modalLoading,    setModalLoading]    = useState(false);

  // Result modal
  const [showResultModal, setShowResultModal] = useState<'monthly' | 'outstanding' | null>(null);

  // Report results
  const [monthlyRows,     setMonthlyRows]     = useState<Row[] | null>(null);
  const [outstandingRows, setOutstandingRows] = useState<Row[] | null>(null);

  // ── API 1: fetch table list ───────────────────────────────────
  const fetchTables = useCallback(async () => {
    setTablesLoading(true);
    setTablesError('');
    try {
      const res = await fetch(`${API_BASE}/tables/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTables(extractTableNames(data));
    } catch (err) {
      setTablesError(err instanceof Error ? err.message : 'Failed to load tables');
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  // ── Fetch unique values when filter column changes ────────────
  useEffect(() => {
    if (!filters.filterColumn || !selectedTable) { setUniqueValues([]); return; }
    setUniqueLoading(true);
    fetch(`${API_BASE}/tables/${encodeURIComponent(selectedTable)}/unique-values/?column=${encodeURIComponent(filters.filterColumn)}`)
      .then(r => r.ok ? r.json() : { values: [] })
      .then(data => setUniqueValues((data.values ?? []).map(String).sort()))
      .catch(() => setUniqueValues([]))
      .finally(() => setUniqueLoading(false));
  }, [filters.filterColumn, selectedTable]);

  // ── API 2: fetch table data (with optional filters) ───────────
  const fetchTableData = useCallback(async (
    tableName: string,
    rowLimit: number,
    f: FilterState = EMPTY_FILTERS,
  ) => {
    setTableLoading(true);
    setTableRows([]);
    setTableColumns([]);
    setMonthlyRows(null);
    setOutstandingRows(null);
    setRunTableName(tableName);
    try {
      const p = new URLSearchParams({ limit: String(rowLimit) });
      if (f.selectedColumns.length > 0) p.set('columns', f.selectedColumns.join(','));
      if (f.filterColumn && f.filterValues.length > 0) {
        p.set('filter_column', f.filterColumn);
        p.set('filter_value',  f.filterValues.join(','));
      }
      if (f.dateColumn) {
        p.set('date_column', f.dateColumn);
        if (f.fromDate) p.set('from_date', f.fromDate);
        if (f.toDate)   p.set('to_date',   f.toDate);
      }
      if (f.groupBy)     p.set('group_by',    f.groupBy);
      if (f.groupBy)     p.set('agg_func',    f.aggFunc || 'sum');
      if (f.saveToDb) {
        p.set('save_to_db', 'true');
        if (f.saveTableName.trim()) p.set('save_table_name', f.saveTableName.trim());
      }

      const res = await fetch(
        `${API_BASE}/tables/${encodeURIComponent(tableName)}/data/?${p}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const { rows, columns } = extractData(json);
      setTableRows(rows);
      setTableColumns(columns);
      setLedgerNames(extractLedgerNames(rows));
    } catch (err) {
      console.error('Table data fetch failed', err);
    } finally {
      setTableLoading(false);
    }
  }, []);

  // Click a table chip → show inline filter + data; click again → deselect
  const handleSelectTable = (table: string) => {
    if (selectedTable === table) {
      setSelectedTable(null);
      setTableRows([]);
      setTableColumns([]);
      setMonthlyRows(null);
      setOutstandingRows(null);
      setLedgerNames([]);
      setShowFilters(false);
      return;
    }
    setFilters(EMPTY_FILTERS);
    setSelectedTable(table);
    setShowFilters(true);
    fetchTableData(table, limit, EMPTY_FILTERS);
  };

  const handleApplyFilters = () => {
    if (selectedTable) fetchTableData(selectedTable, limit, filters);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    if (selectedTable) fetchTableData(selectedTable, limit, EMPTY_FILTERS);
  };

  const activeFilterCount = [
    filters.selectedColumns.length > 0,
    filters.filterColumn && filters.filterValues.length > 0,
    filters.dateColumn && (filters.fromDate || filters.toDate),
    filters.saveToDb,
  ].filter(Boolean).length;

  // ── API 3: Monthly Provision ─────────────────────────────────
  const handleMonthlySubmit = async (params: Record<string, string>) => {
    setModalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/monthly_provision/?${new URLSearchParams(params)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMonthlyRows(extractRows(await res.json()));
      setActiveModal(null);          // close form modal
      setShowResultModal('monthly'); // open result modal
    } catch (err) {
      console.error('Monthly provision failed', err);
    } finally {
      setModalLoading(false);
    }
  };

  // ── API 4: Outstanding Report ────────────────────────────────
  const handleOutstandingSubmit = async (params: Record<string, string>) => {
    setModalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/outstanding_report_data/?${new URLSearchParams(params)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOutstandingRows(extractRows(await res.json()));
      setActiveModal(null);               // close form modal
      setShowResultModal('outstanding');  // open result modal
    } catch (err) {
      console.error('Outstanding report failed', err);
    } finally {
      setModalLoading(false);
    }
  };

  const hasData = tableRows.length > 0 || tableLoading;

  // ════════════════════════════════════════════════════════════
  return (
    <div className="w-full bg-gray-50">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="w-full bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 py-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FaFileAlt className="text-indigo-600" size={13} />
            <span className="text-xs font-bold text-gray-800">Reports</span>
            <span className="text-xs text-gray-400">
              {tablesLoading ? 'Loading…' : tables.length > 0 ? `${tables.length} tables · click any to load its data` : 'No tables available'}
            </span>
          </div>
          <button
            onClick={fetchTables}
            disabled={tablesLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-60"
          >
            <FaSync size={9} className={tablesLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-2 space-y-2">

        {/* ── Table Selector — compact single row ─────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-3 flex-wrap">
          {/* Label */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <FaTable className="text-indigo-600" size={12} />
            <span className="text-xs font-semibold text-gray-700">Available Tables</span>
            {!tablesLoading && tables.length > 0 && (
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-full font-medium">
                {tables.length}
              </span>
            )}
          </div>

          {/* Custom dropdown — always opens downward */}
          <TableDropdown
            tables={tables}
            selected={selectedTable}
            loading={tablesLoading}
            error={tablesError}
            disabled={tableLoading}
            onSelect={handleSelectTable}
            onRetry={fetchTables}
          />

          {/* Rows limit */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-gray-500 whitespace-nowrap">Rows limit:</span>
            <input
              type="number" value={limit} min={1} max={10000}
              onChange={e => setLimit(Math.max(1, Number(e.target.value)))}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Currently loaded indicator */}
          {selectedTable && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {tableLoading
                ? <FaSync size={10} className="animate-spin text-indigo-500" />
                : <FaCheckSquare size={11} className="text-indigo-600" />
              }
              <span className="text-xs font-medium text-indigo-700">{selectedTable}</span>
              <button onClick={() => {
                setSelectedTable(null); setTableRows([]); setTableColumns([]);
                setMonthlyRows(null); setOutstandingRows(null); setLedgerNames([]);
                setShowFilters(false);
              }} className="text-gray-400 hover:text-red-400 transition-colors">
                <FaTimes size={10} />
              </button>
            </div>
          )}
        </div>

        {/* ── Inline Filter Panel ───────────────────────────── */}
        {selectedTable && showFilters && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 bg-gradient-to-r from-violet-600 to-purple-500 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaSearch className="text-white/80" size={11} />
                <span className="text-xs font-semibold text-white">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-white/25 text-white text-[10px] rounded-full font-bold">
                    {activeFilterCount} active
                  </span>
                )}
                <span className="text-white/60 text-[10px]">— {selectedTable}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={handleResetFilters}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded transition-colors">
                  <FaSync size={8} /> Reset
                </button>
                <button onClick={handleApplyFilters} disabled={tableLoading}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-purple-700 bg-white hover:bg-purple-50 rounded transition-colors disabled:opacity-60">
                  <FaPlay size={8} /> Apply
                </button>
                <button onClick={() => setShowFilters(false)}
                  className="p-1 text-white/60 hover:text-white rounded transition-colors">
                  <FaTimes size={11} />
                </button>
              </div>
            </div>

            {/* Filter body */}
            <div className="p-3 grid grid-cols-1 sm:grid-cols-4 gap-3">

              {/* ── Columns selector — shown first ── */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />Columns
                  {filters.selectedColumns.length > 0 && (
                    <span className="ml-auto text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded-full font-bold">{filters.selectedColumns.length} selected</span>
                  )}
                </p>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">
                    Select columns to fetch
                    <span className="ml-1 text-gray-400">(empty = all)</span>
                  </label>
                  <MultiSelectDropdown
                    values={tableColumns}
                    selected={filters.selectedColumns}
                    onChange={vals => setFilters(f => ({ ...f, selectedColumns: vals }))}
                    disabled={tableColumns.length === 0}
                  />
                  {filters.selectedColumns.length > 0 && (
                    <p className="text-[9px] text-indigo-600 mt-0.5 truncate">
                      {filters.selectedColumns.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Value Filter */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />Value Filter
                </p>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Filter Column</label>
                  <select value={filters.filterColumn}
                    onChange={e => setFilters(f => ({ ...f, filterColumn: e.target.value, filterValues: [] }))}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-violet-400">
                    <option value="">— none —</option>
                    {tableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block flex items-center gap-1">
                    Filter Values
                    {uniqueLoading && <FaSync size={8} className="animate-spin text-violet-400" />}
                    {filters.filterValues.length > 0 && (
                      <span className="ml-auto text-[9px] bg-violet-100 text-violet-700 px-1 rounded-full font-bold">{filters.filterValues.length} selected</span>
                    )}
                  </label>
                  <MultiSelectDropdown
                    values={uniqueValues}
                    selected={filters.filterValues}
                    onChange={vals => setFilters(f => ({ ...f, filterValues: vals }))}
                    loading={uniqueLoading}
                    disabled={!filters.filterColumn}
                  />
                  {filters.filterValues.length > 0 && (
                    <p className="text-[9px] text-violet-600 mt-0.5 truncate">
                      API: {filters.filterValues.join(',')}
                    </p>
                  )}
                </div>
              </div>

              {/* Date Range + Month Quick-Select */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />Date Range
                </p>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Date Column</label>
                  <select value={filters.dateColumn}
                    onChange={e => setFilters(f => ({ ...f, dateColumn: e.target.value, fromDate: '', toDate: '' }))}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400">
                    <option value="">— none —</option>
                    {tableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <DateField label="From" value={filters.fromDate}
                    onChange={v => setFilters(f => ({ ...f, fromDate: v }))}
                    disabled={!filters.dateColumn} />
                  <DateField label="To" value={filters.toDate}
                    onChange={v => setFilters(f => ({ ...f, toDate: v }))}
                    disabled={!filters.dateColumn} />
                </div>
              </div>

              {/* Save to DB */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Save to DB
                </p>
                {/* Save to DB */}
                <div className="pt-1 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setFilters(f => ({ ...f, saveToDb: !f.saveToDb }))}
                      className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${filters.saveToDb ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${filters.saveToDb ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <div className="flex items-center gap-1">
                      <FaDatabase size={9} className={filters.saveToDb ? 'text-emerald-600' : 'text-gray-400'} />
                      <span className="text-[10px] font-semibold text-gray-600">Save result to DB</span>
                    </div>
                  </label>
                  {filters.saveToDb && (
                    <div className="mt-1.5">
                      <label className="text-[10px] text-gray-500 mb-0.5 block">Save as table name</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={filters.saveTableName}
                          onChange={e => setFilters(f => ({ ...f, saveTableName: e.target.value }))}
                          placeholder="e.g. filtered_advance_2026"
                          className="flex-1 border border-emerald-300 rounded px-2 py-1 text-xs text-gray-700 bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                        <FaSave size={12} className="self-center text-emerald-500 flex-shrink-0" />
                      </div>
                      <p className="text-[9px] text-gray-400 mt-0.5">Applied on next Apply click</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Active filter pills */}
            {activeFilterCount > 0 && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {filters.selectedColumns.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-full font-medium">
                    cols: {filters.selectedColumns.length === 1 ? filters.selectedColumns[0] : `${filters.selectedColumns.length} columns`}
                    <button onClick={() => setFilters(f => ({ ...f, selectedColumns: [] }))}><FaTimes size={8} /></button>
                  </span>
                )}
                {filters.filterColumn && filters.filterValues.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] rounded-full font-medium">
                    {filters.filterColumn} = {filters.filterValues.length === 1 ? `"${filters.filterValues[0]}"` : `${filters.filterValues.length} values`}
                    <button onClick={() => setFilters(f => ({ ...f, filterColumn: '', filterValues: [] }))}><FaTimes size={8} /></button>
                  </span>
                )}
                {filters.dateColumn && (filters.fromDate || filters.toDate) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-medium">
                    {filters.dateColumn}: {filters.fromDate || '…'} → {filters.toDate || '…'}
                    <button onClick={() => setFilters(f => ({ ...f, dateColumn: '', fromDate: '', toDate: '' }))}><FaTimes size={8} /></button>
                  </span>
                )}
                {filters.saveToDb && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-medium">
                    <FaDatabase size={8} /> save → {filters.saveTableName || '(no name)'}
                    <button onClick={() => setFilters(f => ({ ...f, saveToDb: false, saveTableName: '' }))}><FaTimes size={8} /></button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Data Table ────────────────────────────────────── */}
        {(tableRows.length > 0 || tableLoading) && (
          <DataTable
            title={runTableName}
            subtitle={tableLoading ? 'Fetching rows…' : `${tableRows.length} rows · ${tableColumns.length || Object.keys(tableRows[0] ?? {}).length} columns · click any column header to sort`}
            rows={tableRows}
            loading={tableLoading}
            accentClass="bg-gradient-to-r from-indigo-50 to-blue-50/50"
            colDef={tableColumns}
            onClose={() => { setTableRows([]); setTableColumns([]); setMonthlyRows(null); setOutstandingRows(null); setLedgerNames([]); setSelectedTable(null); setShowFilters(false); }}
            headerActions={!tableLoading && tableRows.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setMonthlyRows(null); setShowResultModal(null); setActiveModal('monthly'); }}
                  className="flex items-center gap-1 px-2 py-1 bg-violet-600 text-white text-xs rounded hover:bg-violet-700 transition-colors whitespace-nowrap">
                  <FaCalendarAlt size={9} /> Monthly Provision
                </button>
                <button onClick={() => { setOutstandingRows(null); setShowResultModal(null); setActiveModal('outstanding'); }}
                  className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition-colors whitespace-nowrap">
                  <FaChartBar size={9} /> Outstanding Report
                </button>
              </div>
            ) : null}
          />
        )}
      </div>

      {/* ── Form Modal (Monthly / Outstanding input) ── */}
      {activeModal && (
        <ReportModalForm
          type={activeModal}
          ledgerNames={ledgerNames}
          loading={modalLoading}
          onClose={() => setActiveModal(null)}
          onSubmit={activeModal === 'monthly' ? handleMonthlySubmit : handleOutstandingSubmit}
        />
      )}

      {/* ── Result Modal (Monthly Provision) ── */}
      {showResultModal === 'monthly' && monthlyRows && (
        <ResultModal
          type="monthly"
          rows={monthlyRows}
          onBack={() => {
            setShowResultModal(null);
            setActiveModal('monthly');
          }}
          onClose={() => {
            setShowResultModal(null);
            setMonthlyRows(null);
          }}
        />
      )}

      {/* ── Result Modal (Outstanding Report) ── */}
      {showResultModal === 'outstanding' && outstandingRows && (
        <ResultModal
          type="outstanding"
          rows={outstandingRows}
          onBack={() => {
            setShowResultModal(null);
            setActiveModal('outstanding');
          }}
          onClose={() => {
            setShowResultModal(null);
            setOutstandingRows(null);
          }}
        />
      )}
    </div>
  );
}
