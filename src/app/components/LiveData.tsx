'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  FaTimes, FaChartLine, FaBoxes, FaPlay, FaCalendarAlt, FaDownload,
  FaFileInvoiceDollar, FaExchangeAlt, FaBalanceScale, FaChevronLeft,
  FaChevronRight, FaDatabase, FaSpinner, FaSearch, FaSort, FaSortUp, FaSortDown,
  FaBook, FaWarehouse, FaLayerGroup, FaCubes, FaChartBar, FaRandom, FaChevronDown, FaPercentage,
  FaStop, FaBookOpen, FaMoneyCheckAlt, FaFileInvoice, FaMinusCircle, FaSave, FaClipboardList,
  FaShoppingCart, FaExclamationCircle, FaHistory, FaChartPie, FaBuilding, FaTachometerAlt,
} from 'react-icons/fa'
import { toast } from 'react-toastify';

const LIVE_API_BASE = 'https://tuneeelin-g-tally.vercel.app';
const API_HEADERS = { 'x-api-key': '7904685929' };
const PER_PAGE = 10;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const REPORT_NAMES = ['Sales Register', 'Purchase Register', 'Funds Flow', 'Cash Flow'];
const PERIOD_OPTIONS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
const LEDGER_PERIOD_OPTIONS = ['Day', 'Week', 'Monthly', 'Yearly'];

type Row = Record<string, string | number | null | undefined>;

// ── Parse API response → { rows, columns } ──────────────────────
function extractData(res: unknown): { rows: Row[]; columns: string[] } {
  let rows: Row[] = [];
  let columns: string[] = [];

  if (Array.isArray(res)) {
    rows = res as Row[];
    columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  } else if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    if (Array.isArray(r.columns)) columns = (r.columns as unknown[]).map(c => String(c));
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

// ── CSV / Excel download helper ──────────────────────────────────
function downloadCSV(rows: Row[], filename: string, colList?: string[]) {
  if (rows.length === 0) return;
  const cols = colList && colList.length > 0 ? colList : Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(escape).join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))];
  const BOM = '﻿';
  const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const toAPIDate = (d: string) => d.replace(/-/g, '');

function getCurrentYearRange() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

// ══════════════════════════════════════════════════════════════
// Date field — same calendar-grid design used in the Reports tab
// ══════════════════════════════════════════════════════════════
function DateField({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'day' | 'month' | 'year'>('day');
  const [dispY, setDispY] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [dispM, setDispM] = useState(parsed?.getMonth() ?? today.getMonth());
  const [yrBase, setYrBase] = useState(Math.floor((parsed?.getFullYear() ?? today.getFullYear()) / 12) * 12);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

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
    const base = parsed?.getFullYear() ?? today.getFullYear();
    setDispY(parsed?.getFullYear() ?? today.getFullYear());
    setDispM(parsed?.getMonth() ?? today.getMonth());
    setYrBase(Math.floor(base / 12) * 12);
    setView('day');
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 320) {
        setPopupStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, width: 256 });
      } else {
        setPopupStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: 256 });
      }
    }
    setOpen(true);
  };

  const selectDate = (y: number, m: number, d: number) => {
    onChange(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setOpen(false);
  };

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstWeekday = (y: number, m: number) => new Date(y, m, 1).getDay();

  const display = parsed
    ? parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="flex-1">
      {label && <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>}

      <div ref={triggerRef} onClick={openPicker}
        className={`flex items-center rounded-lg border bg-white border-gray-300 hover:border-blue-400 cursor-pointer transition-all select-none ${open ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
        <FaCalendarAlt size={11} className="ml-2.5 text-blue-400 flex-shrink-0" />
        <div className="flex-1 px-2 py-2 min-w-0">
          {display
            ? <span className="text-xs font-medium text-gray-800">{display}</span>
            : <span className="text-xs text-gray-400">Select date</span>
          }
        </div>
      </div>

      {open && (
        <div ref={wrapRef} style={popupStyle} className="z-[9999] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">

          {view === 'year' && (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <button onClick={() => setYrBase(b => b - 12)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronLeft size={9} />
                </button>
                <span className="text-xs font-bold text-gray-700">{yrBase} – {yrBase + 11}</span>
                <button onClick={() => setYrBase(b => b + 12)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronRight size={9} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 p-2">
                {Array.from({ length: 12 }, (_, i) => yrBase + i).map(yr => (
                  <button key={yr} onClick={() => { setDispY(yr); setView('month'); }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      yr === (parsed?.getFullYear() ?? -1)
                        ? 'bg-blue-600 text-white shadow-sm'
                        : yr === today.getFullYear()
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}>
                    {yr}
                  </button>
                ))}
              </div>
            </>
          )}

          {view === 'month' && (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <button onClick={() => setDispY(y => y - 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronLeft size={9} />
                </button>
                <button onClick={() => setView('year')} className="text-xs font-bold text-gray-700 hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-gray-50">
                  {dispY}
                </button>
                <button onClick={() => setDispY(y => y + 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
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

          {view === 'day' && (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <button onClick={() => { if (dispM === 0) { setDispM(11); setDispY(y => y - 1); } else setDispM(m => m - 1); }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronLeft size={9} />
                </button>
                <button onClick={() => setView('month')} className="text-xs font-bold text-gray-700 hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-gray-50">
                  {MONTHS[dispM]} {dispY}
                </button>
                <button onClick={() => { if (dispM === 11) { setDispM(0); setDispY(y => y + 1); } else setDispM(m => m + 1); }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                  <FaChevronRight size={9} />
                </button>
              </div>
              <div className="grid grid-cols-7 px-1.5 pt-1.5">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[9px] font-bold text-gray-400 py-0.5">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 px-1.5 pb-1.5 gap-y-0.5">
                {Array.from({ length: firstWeekday(dispY, dispM) }).map((_, i) => <div key={'e' + i} />)}
                {Array.from({ length: daysInMonth(dispY, dispM) }, (_, i) => i + 1).map(d => {
                  const isSelected = parsed?.getFullYear() === dispY && parsed?.getMonth() === dispM && parsed?.getDate() === d;
                  const isToday = today.getFullYear() === dispY && today.getMonth() === dispM && today.getDate() === d;
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
// Searchable dropdown — used for the Stock Item Name selector
// ══════════════════════════════════════════════════════════════
function SearchableSelect({
  label, value, options, onChange, loading, placeholder,
}: { label?: string; value: string; options: string[]; onChange: (v: string) => void; loading?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

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

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        setPopupStyle({
          position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left,
          width: rect.width, maxHeight: Math.min(240, spaceAbove - 16),
        });
      } else {
        setPopupStyle({
          position: 'fixed', top: rect.bottom + 4, left: rect.left,
          width: rect.width, maxHeight: Math.min(240, spaceBelow - 16),
        });
      }
    }
    setSearch('');
    setOpen(o => !o);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div className="flex-1">
      {label && <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>}

      <div ref={triggerRef} onClick={openDropdown}
        className={`flex items-center justify-between rounded-lg border bg-white border-gray-300 hover:border-blue-400 cursor-pointer transition-all select-none px-2.5 py-2 ${open ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}>
        <span className={`text-xs truncate ${value ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
          {loading ? 'Loading…' : (value || placeholder || 'Select…')}
        </span>
        <FaChevronDown size={9} className="text-gray-400 ml-2 flex-shrink-0" />
      </div>

      {open && (
        <div ref={wrapRef} style={popupStyle} className="z-[9999] bg-white rounded-xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <FaSearch size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No matches</div>
            )}
            {filtered.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${o === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Result table — sticky header, zebra rows, pagination, Excel export
// ══════════════════════════════════════════════════════════════
function ResultTable({
  rows, columns, loading, onDownload,
}: { rows: Row[]; columns: string[]; loading: boolean; onDownload: () => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { setPage(1); }, [rows, search]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(r => columns.some(c => String(r[c] ?? '').toLowerCase().includes(q)));
  }, [rows, columns, search]);

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const an = parseFloat(String(av));
      const bn = parseFloat(String(bv));
      let cmp: number;
      if (!isNaN(an) && !isNaN(bn) && String(av).trim() !== '' && String(bv).trim() !== '') {
        cmp = an - bn;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortDir]);

  const toggleSort = (c: string) => {
    if (sortCol === c) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(c);
      setSortDir('asc');
    }
  };

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PER_PAGE));
  const start = (page - 1) * PER_PAGE;
  const pageRows = sortedRows.slice(start, start + PER_PAGE);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <FaSpinner className="animate-spin mr-2" size={14} /> Loading…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
        <FaDatabase size={28} className="mb-2 opacity-40" />
        <p className="text-xs">No records found for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
          {sortedRows.length} of {rows.length} records
        </span>
        <div className="relative flex-1 max-w-xs">
          <FaSearch size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter results…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>
        <button onClick={onDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap">
          <FaDownload size={9} /> Excel
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-blue-50 z-10">
            <tr>
              {columns.map(c => (
                <th key={c} onClick={() => toggleSort(c)}
                  className="px-3 py-2 text-left font-semibold text-blue-700 border-b border-blue-100 whitespace-nowrap cursor-pointer select-none hover:bg-blue-100 transition-colors">
                  <span className="inline-flex items-center gap-1.5">
                    {c}
                    {sortCol === c
                      ? (sortDir === 'asc' ? <FaSortUp size={10} /> : <FaSortDown size={10} />)
                      : <FaSort size={9} className="text-blue-300" />
                    }
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={start + i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                {columns.map(c => (
                  <td key={c} className="px-3 py-1.5 text-gray-700 border-b border-gray-50 whitespace-nowrap">
                    {r[c] == null ? '' : String(r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedRows.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs py-6">
          No rows match your filter.
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <span className="text-[11px] text-gray-500">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40">
              <FaChevronLeft size={9} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40">
              <FaChevronRight size={9} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Finance — tab-wise layout for the 3 Tally APIs
// ══════════════════════════════════════════════════════════════
interface ApiDef {
  key: string;
  label: string;
  endpoint: string;
  icon: React.ReactNode;
  hasReportName?: boolean;
  reportNameOptions?: string[];
  reportNameKey?: string;
  hasPeriod?: boolean;
  periodOptions?: string[];
  hasLedgerwise?: boolean;
  hasStockItemName?: boolean;
  stockItemKey?: string;
  hasLedgerName?: boolean;
}

const FINANCE_APIS: ApiDef[] = [
  { key: 'multi',   label: 'Multi Transaction', endpoint: '/multi-transaction', icon: <FaExchangeAlt size={12} />,   hasReportName: true, hasPeriod: true },
  { key: 'balance', label: 'Balance Sheet',     endpoint: '/balance-sheet',     icon: <FaBalanceScale size={12} /> },
  { key: 'pnl',     label: 'Profit & Loss',     endpoint: '/profit-and-loss',   icon: <FaFileInvoiceDollar size={12} /> },
  { key: 'trial',   label: 'Trial Balance',     endpoint: '/trial-balance',     icon: <FaBook size={12} />, hasLedgerwise: true },
  { key: 'ratio',   label: 'Ratio Analysis',    endpoint: '/ratio-analysis',    icon: <FaPercentage size={12} /> },
];

const STOCK_APIS: ApiDef[] = [
  { key: 'godown',     label: 'Godown Summary',         endpoint: '/godown-summary',          icon: <FaWarehouse size={12} /> },
  { key: 'stockcat',   label: 'Stock Category Summary', endpoint: '/stock-category-summary',  icon: <FaLayerGroup size={12} /> },
  { key: 'stockgroup', label: 'Stock Group Summary',    endpoint: '/stock-group-summary',     icon: <FaCubes size={12} /> },
  { key: 'stockanalysis', label: 'Stock Analysis',      endpoint: '/stock-analysis',          icon: <FaChartBar size={12} />, hasStockItemName: true },
  { key: 'movement',   label: 'Movement Analysis',      endpoint: '/movement-analysis',       icon: <FaRandom size={12} /> },
  { key: 'stockquery', label: 'Stock Purchase History', endpoint: '/stock-Query',             icon: <FaHistory size={12} />, hasStockItemName: true, stockItemKey: 'stock_item' },
];

const LEDGER_APIS: ApiDef[] = [
  { key: 'ledgertxn',  label: 'Ledger Transaction', endpoint: '/Ledeger_Transaction',       icon: <FaMoneyCheckAlt size={12} />, hasPeriod: true, periodOptions: LEDGER_PERIOD_OPTIONS, hasLedgerName: true },
  { key: 'ledgerout',  label: 'Ledger Outstanding', endpoint: '/Ledger_outstanding-report', icon: <FaFileInvoice size={12} />,   hasLedgerName: true },
  { key: 'negledger',  label: 'Negative Ledgers',   endpoint: '/negative-ledgers',          icon: <FaMinusCircle size={12} /> },
];

const OUTSTANDING_REPORT_NAMES = ['Overdue Payables', 'Overdue Receivables'];

const OUTSTANDING_APIS: ApiDef[] = [
  { key: 'orderout',  label: 'Order Outstandings', endpoint: '/order-outstandings', icon: <FaShoppingCart size={12} /> },
  { key: 'overduepay', label: 'Overdue Payables',  endpoint: '/overdue-payables',  icon: <FaExclamationCircle size={12} />, hasReportName: true, reportNameOptions: OUTSTANDING_REPORT_NAMES, reportNameKey: 'ReportName' },
];

const SUMMARY_APIS: ApiDef[] = [
  { key: 'costcenter', label: 'Cost Center Summary', endpoint: '/cost-center-summary', icon: <FaBuilding size={12} /> },
  { key: 'statistics', label: 'Statistics',          endpoint: '/statistics',          icon: <FaTachometerAlt size={12} /> },
];

const LEDGERWISE_OPTIONS = ['NO', 'YES'];

function ApiTabPanel({ apis }: { apis: ApiDef[] }) {
  const initial = getCurrentYearRange();

  const [activeApi, setActiveApi] = useState(apis[0].key);
  const [fromDate, setFromDate]   = useState(initial.from);
  const [toDate, setToDate]       = useState(initial.to);
  const [reportName, setReportName] = useState((apis[0].reportNameOptions ?? REPORT_NAMES)[0]);
  const [period, setPeriod]       = useState(PERIOD_OPTIONS[0]);
  const [ledgerwise, setLedgerwise] = useState(LEDGERWISE_OPTIONS[0]);
  const [fileName, setFileName]   = useState('');
  const [stockItemName, setStockItemName] = useState('');
  const [stockItemOptions, setStockItemOptions] = useState<string[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [ledgerName, setLedgerName] = useState('');
  const [ledgerNameOptions, setLedgerNameOptions] = useState<string[]>([]);
  const [loadingLedgerNames, setLoadingLedgerNames] = useState(false);

  const [rows, setRows]       = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [hasRun, setHasRun]   = useState(false);

  const api = apis.find(a => a.key === activeApi)!;

  // Populate the Stock Item Name dropdown from the stock_pro_tech table
  useEffect(() => {
    if (!api.hasStockItemName) return;
    let cancelled = false;
    setLoadingItems(true);
    (async () => {
      try {
        const res = await fetch(`${LIVE_API_BASE}/tables/stock_pro_tech/data?limit=1000`, { headers: API_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const { rows: r, columns: c } = extractData(json);
        const nameCol = c.find(col => /name/i.test(col)) ?? c[0];
        const names = nameCol
          ? Array.from(new Set(r.map(row => String(row[nameCol] ?? '').trim()).filter(Boolean)))
          : [];
        if (cancelled) return;
        setStockItemOptions(names);
        setStockItemName(prev => (names.includes(prev) ? prev : (names[0] ?? '')));
      } catch (err) {
        console.error('Failed to load stock item names', err);
        if (!cancelled) {
          setStockItemOptions([]);
          setStockItemName('');
        }
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api.hasStockItemName]);

  // Populate the Ledger Name dropdown from the Ledger table
  useEffect(() => {
    if (!api.hasLedgerName) return;
    let cancelled = false;
    setLoadingLedgerNames(true);
    (async () => {
      try {
        const res = await fetch(`${LIVE_API_BASE}/tables/leder_name/data?limit=1000`, { headers: API_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const { rows: r, columns: c } = extractData(json);
        const nameCol = c.find(col => /name/i.test(col)) ?? c[0];
        const names = nameCol
          ? Array.from(new Set(r.map(row => String(row[nameCol] ?? '').trim()).filter(Boolean)))
          : [];
        if (cancelled) return;
        setLedgerNameOptions(names);
        setLedgerName(prev => (names.includes(prev) ? prev : (names[0] ?? '')));
      } catch (err) {
        console.error('Failed to load ledger names', err);
        if (!cancelled) {
          setLedgerNameOptions([]);
          setLedgerName('');
        }
      } finally {
        if (!cancelled) setLoadingLedgerNames(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api.hasLedgerName]);

  const switchApi = (key: string) => {
    setActiveApi(key);
    setRows([]);
    setColumns([]);
    setHasRun(false);
    setError('');
    const nextApi = apis.find(a => a.key === key)!;
    setPeriod((nextApi.periodOptions ?? PERIOD_OPTIONS)[0]);
    setReportName((nextApi.reportNameOptions ?? REPORT_NAMES)[0]);
  };

  const abortRef = useRef<AbortController | null>(null);

  const handleRun = async (isSave = false) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (api.hasReportName) params.set(api.reportNameKey ?? 'report_name', reportName);
      params.set('from_date', toAPIDate(fromDate));
      params.set('to_date', toAPIDate(toDate));
      if (api.hasPeriod) params.set('period', period);
      if (api.hasLedgerwise) params.set('ledgerwise', ledgerwise);
      if (api.hasStockItemName) params.set(api.stockItemKey ?? 'StockItemName', stockItemName);
      if (api.hasLedgerName) params.set('ledger_name', ledgerName);
      if (fileName.trim()) params.set('file_name', fileName.trim());

      const res = await fetch(`${LIVE_API_BASE}${api.endpoint}?${params.toString()}`, { signal: controller.signal, headers: API_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const { rows: r, columns: c } = extractData(json);
      setRows(r);
      setColumns(c.length > 0 ? c : (r.length > 0 ? Object.keys(r[0]) : []));
      if (isSave) toast.success(`Saved as "${fileName.trim()}".`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request stopped.');
      } else {
        console.error('Live data fetch failed', err);
        const message = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(message);
        if (isSave) toast.error(`Save failed: ${message}`);
      }
      setRows([]);
      setColumns([]);
    } finally {
      setLoading(false);
      setHasRun(true);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex flex-col h-full">
      {/* API tabs */}
      <div className="flex gap-1 px-4 pt-3 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
        {apis.map(a => (
          <button key={a.key} onClick={() => switchApi(a.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              activeApi === a.key
                ? 'text-blue-700 border-blue-600 bg-blue-50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          {api.hasLedgerName && (
            <div className="w-56">
              <SearchableSelect
                label="Ledger Name"
                value={ledgerName}
                onChange={setLedgerName}
                options={ledgerNameOptions}
                loading={loadingLedgerNames}
                placeholder={ledgerNameOptions.length === 0 ? 'No ledgers found' : 'Select ledger…'}
              />
            </div>
          )}

          {api.hasReportName && (
            <div className="w-48">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Report Name</label>
              <select value={reportName} onChange={e => setReportName(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400">
                {(api.reportNameOptions ?? REPORT_NAMES).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}

          <div className="w-40">
            <DateField label="From Date" value={fromDate} onChange={setFromDate} />
          </div>
          <div className="w-40">
            <DateField label="To Date" value={toDate} onChange={setToDate} />
          </div>

          {api.hasPeriod && (
            <div className="w-36">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Period</label>
              <select value={period} onChange={e => setPeriod(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400">
                {(api.periodOptions ?? PERIOD_OPTIONS).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {api.hasLedgerwise && (
            <div className="w-36">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Ledgerwise</label>
              <select value={ledgerwise} onChange={e => setLedgerwise(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400">
                {LEDGERWISE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {api.hasStockItemName && (
            <div className="w-56">
              <SearchableSelect
                label="Stock Item Name"
                value={stockItemName}
                onChange={setStockItemName}
                options={stockItemOptions}
                loading={loadingItems}
                placeholder={stockItemOptions.length === 0 ? 'No items found' : 'Select item…'}
              />
            </div>
          )}

          <div className="w-48">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">File Name (optional)</label>
            <input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. company.tally"
              className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
          </div>

          <button onClick={() => handleRun()} disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60 shadow-sm">
            {loading ? <FaSpinner className="animate-spin" size={11} /> : <FaPlay size={10} />}
            {loading ? 'Running…' : 'Run'}
          </button>

          <button onClick={() => handleRun(true)} disabled={loading || !fileName.trim()}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-60 shadow-sm">
            <FaSave size={10} />
            Save
          </button>

          {loading && (
            <button onClick={handleStop}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">
              <FaStop size={10} />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 p-4">
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
            {error}
          </div>
        )}
        {hasRun && !error && (
          <ResultTable
            rows={rows} columns={columns} loading={loading}
            onDownload={() => downloadCSV(rows, `${api.label.replace(/\s+/g, '_')}.csv`, columns)}
          />
        )}
        {!hasRun && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
            <FaDatabase size={28} className="mb-2 opacity-40" />
            <p className="text-xs">Set your filters above and click <span className="font-semibold text-gray-500">Run</span> to fetch live data.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Finance / Stock panels — each renders its own tab-wise API set
// ══════════════════════════════════════════════════════════════
function FinancePanel() {
  return <ApiTabPanel apis={FINANCE_APIS} />;
}

function StockPanel() {
  return <ApiTabPanel apis={STOCK_APIS} />;
}

function LedgerPanel() {
  return <ApiTabPanel apis={LEDGER_APIS} />;
}

function OutstandingPanel() {
  return <ApiTabPanel apis={OUTSTANDING_APIS} />;
}

function SummaryPanel() {
  return <ApiTabPanel apis={SUMMARY_APIS} />;
}

// ══════════════════════════════════════════════════════════════
// Modal — sidebar (Finance / Stock) + content
// ══════════════════════════════════════════════════════════════
const SIDEBAR_MENU: { key: 'finance' | 'stock' | 'ledger' | 'outstanding' | 'summary'; label: string; icon: React.ReactNode }[] = [
  { key: 'finance',     label: 'Finance',     icon: <FaChartLine size={13} /> },
  { key: 'stock',       label: 'Stock',       icon: <FaBoxes size={13} /> },
  { key: 'ledger',      label: 'Ledger',      icon: <FaBookOpen size={13} /> },
  { key: 'outstanding', label: 'Outstanding', icon: <FaClipboardList size={13} /> },
  { key: 'summary',     label: 'Summary',     icon: <FaChartPie size={13} /> },
];

function LiveDataModal({ onClose }: { onClose: () => void }) {
  const [activeMenu, setActiveMenu] = useState<'finance' | 'stock' | 'ledger' | 'outstanding' | 'summary'>('finance');
  const selectMenu = (key: 'finance' | 'stock' | 'ledger' | 'outstanding' | 'summary') => {
    setActiveMenu(key);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden" style={{ maxWidth: '98vw', width: '1600px', height: '94vh', maxHeight: '98vh' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <FaDatabase className="text-white" size={15} />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm tracking-wide">Live Data</h2>
              <p className="text-white/70 text-[11px]">Real-time reports from connected APIs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors border border-white/20">
              <FaChevronLeft size={10} />
              Back
            </button>
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <FaTimes size={14} />
            </button>
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-44 border-r border-gray-100 bg-gray-50 flex-shrink-0 p-2 space-y-1">
            {SIDEBAR_MENU.map(m => (
              <button key={m.key} onClick={() => selectMenu(m.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeMenu === m.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white hover:text-gray-800'
                }`}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {activeMenu === 'finance' ? <FinancePanel />
              : activeMenu === 'stock' ? <StockPanel />
              : activeMenu === 'ledger' ? <LedgerPanel />
              : activeMenu === 'outstanding' ? <OutstandingPanel />
              : <SummaryPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Default export — tab trigger + modal
// ══════════════════════════════════════════════════════════════
export default function LiveData() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-xs whitespace-nowrap text-gray-500 hover:text-gray-700 hover:bg-gray-50"
      >
        <FaDatabase size={11} className="text-blue-500" />
        Live Data
      </button>
      {open && <LiveDataModal onClose={() => setOpen(false)} />}
    </>
  );
}
