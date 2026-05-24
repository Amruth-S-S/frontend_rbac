'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaSync, FaTimes, FaSearch, FaChevronLeft, FaChevronRight,
  FaTable, FaChartBar, FaCalendarAlt, FaFileAlt,
  FaCheckSquare, FaRegSquare, FaPlay, FaDownload,
  FaSort, FaSortUp, FaSortDown,
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
    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex-wrap gap-2 flex-shrink-0">
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

// ══════════════════════════════════════════════════════════════
// Data Table — sticky header · column sorting · bottom pagination
// ══════════════════════════════════════════════════════════════
interface DataTableProps {
  title: string;
  subtitle?: string;
  rows: Row[];
  loading?: boolean;
  accentClass: string;
  headerActions?: React.ReactNode;
  onClose?: () => void;
  /** Controls the outer card's max-height so pagination is always visible */
  maxHeight?: string;
  /** Explicit column list from the API (preserves order + shows all cols even if first row is null) */
  colDef?: string[];
}
function DataTable({
  title, subtitle, rows, loading, accentClass,
  headerActions, onClose, maxHeight, colDef,
}: DataTableProps) {
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const tableWrapRef = useRef<HTMLDivElement>(null);

  // Use explicit column list if provided, otherwise infer from first row
  const columns = colDef && colDef.length > 0
    ? colDef
    : rows.length > 0 ? Object.keys(rows[0]) : [];

  // Filter
  const filtered = search
    ? rows.filter(r => columns.some(c => String(r[c] ?? '').toLowerCase().includes(search.toLowerCase())))
    : rows;

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
      className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden"
      style={{ maxHeight: maxHeight || 'calc(100vh - 280px)' }}
    >
      {/* ── Card header ── */}
      <div className={`px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 flex-shrink-0 ${accentClass}`}>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {rows.length > 0 && (
            <div className="relative">
              <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={10} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search…"
                className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white w-36"
              />
            </div>
          )}
          {headerActions}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/60 transition-colors">
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
          {/* ── Scrollable table — flex-1 + min-h-0 lets it shrink inside the flex parent ── */}
          <div
            ref={tableWrapRef}
            className="flex-1 min-h-0 overflow-auto"
          >
            <table className="w-full text-xs border-collapse" style={{ minWidth: 600 }}>
              <thead>
                <tr className="bg-gray-50">
                  {/* Sticky # column */}
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-400 w-10 border-b-2 border-gray-200
                                  sticky top-0 left-0 z-30 bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    #
                  </th>
                  {columns.map(col => (
                    <th
                      key={col}
                      onClick={() => toggleSort(col)}
                      className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap
                                  border-b-2 border-gray-200 sticky top-0 z-20 bg-gray-50
                                  cursor-pointer select-none hover:bg-indigo-50 transition-colors group"
                    >
                      <div className="flex items-center gap-0.5">
                        {col}
                        <SortIcon col={col} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`hover:bg-indigo-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    {/* Sticky row number */}
                    <td className="px-3 py-2 text-gray-400 tabular-nums border-b border-gray-50
                                    sticky left-0 z-10 bg-inherit shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
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

          {/* ── Bottom pagination — flex-shrink-0 → always visible ── */}
          <PaginationBar
            page={safeP}
            total={total}
            count={pageRows.length}
            filtered={sorted.length}
            onChange={changePage}
          />
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

          {/* From / To — native date pickers */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'From Date', key: 'from', val: fromDate, set: setFromDate },
              { label: 'To Date',   key: 'to',   val: toDate,   set: setToDate  },
            ] as const).map(({ label, key, val, set }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  {label} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={val}
                  onChange={e => (set as (v: string) => void)(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 ${accentRing} cursor-pointer ${
                    errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                />
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-gray-400 text-[10px]">Format sent to API:</span>
                  <span className={`text-[10px] font-mono font-bold ${val ? 'text-blue-600' : 'text-gray-300'}`}>
                    {val ? val.replace(/-/g, '') : 'YYYYMMDD'}
                  </span>
                </div>
                {errors[key] && <p className="text-red-500 text-xs mt-0.5">{errors[key]}</p>}
              </div>
            ))}
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
  const [tableColumns, setTableColumns] = useState<string[]>([]); // explicit col order from API
  const [tableLoading, setTableLoading] = useState(false);
  const [runTableName, setRunTableName] = useState('');
  const [limit,        setLimit]        = useState(100);
  const [ledgerNames,  setLedgerNames]  = useState<string[]>([]);

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

  // ── API 2: fetch table data when user clicks a table ──────────
  const fetchTableData = useCallback(async (tableName: string, rowLimit: number) => {
    setTableLoading(true);
    setTableRows([]);
    setTableColumns([]);
    setMonthlyRows(null);
    setOutstandingRows(null);
    setRunTableName(tableName);
    try {
      const res = await fetch(
        `${API_BASE}/tables/${encodeURIComponent(tableName)}/data/?limit=${rowLimit}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const { rows, columns } = extractData(json); // reads API's "columns" array first
      setTableRows(rows);
      setTableColumns(columns);                     // store for DataTable colDef prop
      setLedgerNames(extractLedgerNames(rows));
    } catch (err) {
      console.error('Table data fetch failed', err);
    } finally {
      setTableLoading(false);
    }
  }, []);

  // Click a table → immediately fetch its data; click again → deselect
  const handleSelectTable = (table: string) => {
    if (selectedTable === table) {
      setSelectedTable(null);
      setTableRows([]);
      setTableColumns([]);
      setMonthlyRows(null);
      setOutstandingRows(null);
      setLedgerNames([]);
      return;
    }
    setSelectedTable(table);
    fetchTableData(table, limit);
  };

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
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/20">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-sm">
              <FaFileAlt className="text-white" size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-800">Reports</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {tablesLoading
                  ? 'Loading tables…'
                  : tables.length > 0
                    ? `${tables.length} tables · click any to load its data`
                    : 'No tables available'
                }
              </p>
            </div>
          </div>
          <button
            onClick={fetchTables}
            disabled={tablesLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-60"
          >
            <FaSync size={11} className={tablesLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-4 space-y-4">

        {/* ── Card 1 : Table Selector ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Card header */}
          <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FaTable className="text-white/80" size={14} />
              <h2 className="text-sm font-semibold text-white">Available Tables</h2>
              {!tablesLoading && tables.length > 0 && (
                <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full font-medium">
                  {tables.length}
                </span>
              )}
            </div>
            {/* Row limit */}
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
              <span className="text-white/70 text-xs">Rows limit:</span>
              <input
                type="number"
                value={limit}
                min={1}
                max={10000}
                onChange={e => setLimit(Math.max(1, Number(e.target.value)))}
                className="w-16 bg-transparent text-white text-xs focus:outline-none text-center font-medium"
              />
            </div>
          </div>

          {/* Table checkbox buttons */}
          <div className="p-4">
            {tablesLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <FaSync className="animate-spin mr-2" size={14} />
                <span className="text-sm">Loading tables…</span>
              </div>
            ) : tablesError ? (
              <div className="flex flex-col items-center py-8">
                <p className="text-red-500 text-sm font-medium">{tablesError}</p>
                <button onClick={fetchTables} className="mt-2 text-indigo-600 text-xs hover:underline">Retry</button>
              </div>
            ) : tables.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">No tables found</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {tables.map(table => {
                    const isSel      = selectedTable === table;
                    const isSpinning = isSel && tableLoading;
                    return (
                      <button
                        key={table}
                        onClick={() => handleSelectTable(table)}
                        disabled={tableLoading && !isSel}
                        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all select-none ${
                          isSel
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-50'
                        }`}
                      >
                        {isSpinning
                          ? <FaSync size={12} className="animate-spin text-indigo-500 flex-shrink-0" />
                          : isSel
                            ? <FaCheckSquare size={13} className="text-indigo-600 flex-shrink-0" />
                            : <FaRegSquare   size={13} className="text-gray-400 flex-shrink-0" />
                        }
                        {table}
                      </button>
                    );
                  })}
                </div>

                {/* Hint when nothing selected */}
                {!selectedTable && (
                  <p className="text-xs text-gray-400 italic mt-3">
                    ☝ Click any table above to load and view its data.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Card 2 : Table Data ───────────────────────────── */}
        {hasData && (
          <DataTable
            title={runTableName}
            subtitle={
              tableLoading
                ? 'Fetching rows…'
                : `${tableRows.length} rows · ${tableColumns.length || Object.keys(tableRows[0] ?? {}).length} columns · click any column header to sort`
            }
            rows={tableRows}
            loading={tableLoading}
            accentClass="bg-gradient-to-r from-indigo-50 to-blue-50/50"
            colDef={tableColumns}
            onClose={() => {
              setTableRows([]);
              setTableColumns([]);
              setMonthlyRows(null);
              setOutstandingRows(null);
              setLedgerNames([]);
              setSelectedTable(null);
            }}
            headerActions={
              !tableLoading && tableRows.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => downloadCSV(tableRows, `${runTableName}.csv`, tableColumns)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors shadow-sm whitespace-nowrap">
                    <FaDownload size={10} />
                    Excel
                  </button>
                  <button
                    onClick={() => { setMonthlyRows(null); setShowResultModal(null); setActiveModal('monthly'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors shadow-sm whitespace-nowrap">
                    <FaCalendarAlt size={11} />
                    Monthly Provision
                  </button>
                  <button
                    onClick={() => { setOutstandingRows(null); setShowResultModal(null); setActiveModal('outstanding'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap">
                    <FaChartBar size={11} />
                    Outstanding Report
                  </button>
                </div>
              ) : null
            }
          />
        )}

        {/* ── Empty state ───────────────────────────────────── */}
        {!hasData && !tablesLoading && tables.length === 0 && tablesError && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <FaTable size={28} className="text-indigo-300" />
            </div>
            <h3 className="text-sm font-semibold text-gray-600 mb-1">No tables available</h3>
            <p className="text-xs text-gray-400 mb-3">Could not load the table list from the server.</p>
            <button
              onClick={fetchTables}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
              Retry
            </button>
          </div>
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
