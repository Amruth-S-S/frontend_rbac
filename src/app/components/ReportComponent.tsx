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
// Filter types
// ══════════════════════════════════════════════════════════════
interface FilterState {
  filterColumn: string;
  filterValue:  string;
  dateColumn:   string;
  fromDate:     string;
  toDate:       string;
  groupBy:      string;
  aggFunc:      string;
}
const EMPTY_FILTERS: FilterState = {
  filterColumn: '', filterValue: '', dateColumn: '',
  fromDate: '', toDate: '', groupBy: '', aggFunc: 'sum',
};

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
  const [filters,      setFilters]      = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters,  setShowFilters]  = useState(false);

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
      if (f.filterColumn && f.filterValue) {
        p.set('filter_column', f.filterColumn);
        p.set('filter_value',  f.filterValue);
      }
      if (f.dateColumn)  p.set('date_column', f.dateColumn);
      if (f.fromDate)    p.set('from_date',   f.fromDate);
      if (f.toDate)      p.set('to_date',     f.toDate);
      if (f.groupBy)     p.set('group_by',    f.groupBy);
      if (f.groupBy)     p.set('agg_func',    f.aggFunc || 'sum');

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
    filters.filterColumn && filters.filterValue,
    filters.dateColumn && (filters.fromDate || filters.toDate),
    filters.groupBy,
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

        {/* ── Card 1 : Table Selector ─────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">

          {/* Card header */}
          <div className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FaTable className="text-white/80" size={12} />
              <h2 className="text-xs font-semibold text-white">Available Tables</h2>
              {!tablesLoading && tables.length > 0 && (
                <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] rounded-full font-medium">
                  {tables.length}
                </span>
              )}
            </div>
            {/* Row limit */}
            <div className="flex items-center gap-1 bg-white/10 rounded px-2 py-1">
              <span className="text-white/70 text-[10px]">Rows limit:</span>
              <input
                type="number"
                value={limit}
                min={1}
                max={10000}
                onChange={e => setLimit(Math.max(1, Number(e.target.value)))}
                className="w-14 bg-transparent text-white text-[10px] focus:outline-none text-center font-medium"
              />
            </div>
          </div>

          {/* Table checkbox buttons */}
          <div className="p-2.5">
            {tablesLoading ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <FaSync className="animate-spin mr-2" size={12} />
                <span className="text-xs">Loading tables…</span>
              </div>
            ) : tablesError ? (
              <div className="flex flex-col items-center py-4">
                <p className="text-red-500 text-xs font-medium">{tablesError}</p>
                <button onClick={fetchTables} className="mt-1 text-indigo-600 text-xs hover:underline">Retry</button>
              </div>
            ) : tables.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-3">No tables found</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {tables.map(table => {
                    const isSel      = selectedTable === table;
                    const isSpinning = isSel && tableLoading;
                    return (
                      <button
                        key={table}
                        onClick={() => handleSelectTable(table)}
                        disabled={tableLoading && !isSel}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all select-none ${
                          isSel
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-50'
                        }`}
                      >
                        {isSpinning
                          ? <FaSync size={10} className="animate-spin text-indigo-500 flex-shrink-0" />
                          : isSel
                            ? <FaCheckSquare size={11} className="text-indigo-600 flex-shrink-0" />
                            : <FaRegSquare   size={11} className="text-gray-400 flex-shrink-0" />
                        }
                        {table}
                      </button>
                    );
                  })}
                </div>

                {!selectedTable && (
                  <p className="text-[10px] text-gray-400 italic mt-2">
                    ☝ Click any table above to load and view its data.
                  </p>
                )}
              </>
            )}
          </div>
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
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* Value Filter */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />Value Filter
                </p>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Filter Column</label>
                  <select value={filters.filterColumn}
                    onChange={e => setFilters(f => ({ ...f, filterColumn: e.target.value, filterValue: '' }))}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-violet-400">
                    <option value="">— none —</option>
                    {tableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Filter Value</label>
                  <input type="text" value={filters.filterValue}
                    onChange={e => setFilters(f => ({ ...f, filterValue: e.target.value }))}
                    placeholder="e.g. Advance" disabled={!filters.filterColumn}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-40" />
                </div>
              </div>

              {/* Date Range — new DateField design */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />Date Range
                </p>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Date Column</label>
                  <select value={filters.dateColumn}
                    onChange={e => setFilters(f => ({ ...f, dateColumn: e.target.value }))}
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

              {/* Grouping */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Grouping
                </p>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Group By</label>
                  <select value={filters.groupBy}
                    onChange={e => setFilters(f => ({ ...f, groupBy: e.target.value }))}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-400">
                    <option value="">— none —</option>
                    {tableColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Aggregation</label>
                  <div className="flex gap-1 flex-wrap">
                    {['sum','count','avg','min','max'].map(fn => (
                      <button key={fn} disabled={!filters.groupBy}
                        onClick={() => setFilters(f => ({ ...f, aggFunc: fn }))}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all disabled:opacity-40 ${
                          filters.aggFunc === fn && filters.groupBy
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-300'
                        }`}>{fn}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Active filter pills */}
            {activeFilterCount > 0 && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {filters.filterColumn && filters.filterValue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] rounded-full font-medium">
                    {filters.filterColumn} = &ldquo;{filters.filterValue}&rdquo;
                    <button onClick={() => setFilters(f => ({ ...f, filterColumn: '', filterValue: '' }))}><FaTimes size={8} /></button>
                  </span>
                )}
                {filters.dateColumn && (filters.fromDate || filters.toDate) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-medium">
                    {filters.dateColumn}: {filters.fromDate || '…'} → {filters.toDate || '…'}
                    <button onClick={() => setFilters(f => ({ ...f, dateColumn: '', fromDate: '', toDate: '' }))}><FaTimes size={8} /></button>
                  </span>
                )}
                {filters.groupBy && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-medium">
                    group by {filters.groupBy} ({filters.aggFunc})
                    <button onClick={() => setFilters(f => ({ ...f, groupBy: '', aggFunc: 'sum' }))}><FaTimes size={8} /></button>
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => downloadCSV(tableRows, `${runTableName}.csv`, tableColumns)}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors whitespace-nowrap">
                  <FaDownload size={9} /> Excel
                </button>
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
