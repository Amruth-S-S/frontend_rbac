'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search as SearchIcon, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Play, Loader2, AlertCircle,
} from 'lucide-react';

const formatNumber = (n: number) => new Intl.NumberFormat('en-IN').format(n);

const extractErrorMessage = (payload: any, fallback: string): string => {
  const detail = payload?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (typeof detail?.message === 'string') return detail.message;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
};

// Standalone "View Table" page — opened in its own browser tab/window from the
// Forecast tab's "View Table" button, since the table-data preview wants a lot
// more horizontal room (many columns) than the in-page modal could give it.
// Fetches its own table list and data; no shared state with the opener tab.
function ForecastViewTableInner() {
  const searchParams = useSearchParams();

  const [tables, setTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tableName, setTableName] = useState(searchParams.get('table') || '');
  const [rowLimit, setRowLimit] = useState(10);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const [resultSearch, setResultSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };

  const visibleRows = useMemo(() => {
    const q = resultSearch.trim().toLowerCase();
    let r = q
      ? rows.filter(row => columns.some(c => String(row[c] ?? '').toLowerCase().includes(q)))
      : rows;
    if (sortCol) {
      r = [...r].sort((a, b) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        const an = Number(av), bn = Number(bv);
        const cmp = av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn)
          ? an - bn
          : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, columns, resultSearch, sortCol, sortDir]);

  useEffect(() => {
    (async () => {
      setTablesLoading(true);
      try {
        const res = await fetch('/api/forecasting/tables');
        const json = await res.json();
        if (!res.ok) throw new Error(extractErrorMessage(json, 'Failed to load tables.'));
        const list: string[] = Array.isArray(json?.tables) ? json.tables : [];
        setTables(list);
        setTableName(prev => prev || list[0] || '');
      } catch (err: any) {
        setError(err?.message || 'Failed to load tables.');
      } finally {
        setTablesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [dropdownOpen]);

  const visibleTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? tables.filter(t => t.toLowerCase().includes(q)) : tables;
    const sorted = [...filtered].sort((a, b) => a.localeCompare(b));
    return sort === 'asc' ? sorted : sorted.reverse();
  }, [tables, search, sort]);

  const runViewTable = async () => {
    if (!tableName) return;
    setLoading(true);
    setRan(true);
    setError(null);
    setResultSearch('');
    setSortCol(null);
    setSortDir('asc');
    try {
      const qs = new URLSearchParams({
        table_name: tableName,
        page: '1',
        page_size: String(Math.max(1, rowLimit || 10)),
      });
      const res = await fetch(`/api/forecasting/table-data?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(json, 'Failed to load table data.'));
      const r: Record<string, unknown>[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.data) ? json.data
        : Array.isArray(json?.rows) ? json.rows
        : [];
      const cols: string[] = Array.isArray(json?.columns) && json.columns.length > 0
        ? json.columns
        : r.length > 0 ? Object.keys(r[0]) : [];
      setColumns(cols);
      setRows(r);
    } catch (err: any) {
      setError(err?.message || 'Failed to load table data.');
      setColumns([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run once the table list has loaded, if a table was passed in via ?table=
  useEffect(() => {
    if (!tablesLoading && searchParams.get('table') && tableName && !ran) {
      runViewTable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesLoading]);

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-tint flex items-center justify-center flex-shrink-0">
            <SearchIcon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 font-heading">View Table</h1>
            <p className="text-xs text-gray-500">Pick a table, run it, and browse the rows — full width, with horizontal scroll for wide tables.</p>
          </div>
        </div>

        <div className="bg-white border border-card-border rounded-2xl shadow-sm p-5 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Table name</label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => !tablesLoading && setDropdownOpen(o => !o)}
                  disabled={tablesLoading}
                  className="w-full flex items-center justify-between h-[50px] px-3 border border-card-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-50"
                >
                  <span className={`truncate ${tableName ? 'text-gray-900' : 'text-gray-400'}`}>
                    {tablesLoading ? 'Loading tables…' : tableName || 'Select a table'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && !tablesLoading && (
                  <div className="absolute z-20 mt-1 w-full max-h-[340px] overflow-hidden border border-card-border rounded-2xl bg-white shadow-xl flex flex-col">
                    {tables.length > 8 && (
                      <div className="flex items-center gap-1.5 p-1.5 border-b border-gray-100 flex-shrink-0">
                        <div className="relative flex-1">
                          <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search tables…"
                            className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSort(s => s === 'asc' ? 'desc' : 'asc')}
                          title={sort === 'asc' ? 'Sorted A–Z' : 'Sorted Z–A'}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md border border-gray-200 flex-shrink-0"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                          {sort === 'asc' ? 'A–Z' : 'Z–A'}
                        </button>
                      </div>
                    )}
                    <div className="overflow-y-auto p-1">
                      {visibleTables.length === 0 ? (
                        <p className="px-2.5 py-1.5 text-xs text-gray-400">No tables found.</p>
                      ) : (
                        visibleTables.map(t => (
                          <button
                            type="button"
                            key={t}
                            onClick={() => { setTableName(t); setDropdownOpen(false); setSearch(''); }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm truncate hover:bg-tint ${t === tableName ? 'bg-tint text-accent font-bold' : 'text-gray-900'}`}
                          >
                            {t}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="w-full sm:w-[220px]">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Rows limit</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={rowLimit}
                onChange={e => setRowLimit(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                disabled={loading}
                className="w-full h-[50px] px-3 border border-card-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-50"
              />
            </div>
            <button
              type="button"
              onClick={runViewTable}
              disabled={!tableName || loading}
              className="flex items-center justify-center gap-1.5 px-5 h-[50px] bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white border border-card-border rounded-2xl shadow-sm p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading data…</span>
            </div>
          ) : !ran ? (
            <p className="text-center py-16 text-sm text-gray-400">Pick a table and click Run to load its rows.</p>
          ) : rows.length === 0 ? (
            <p className="text-center py-16 text-sm text-gray-400">No rows returned.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-tint text-accent text-xs font-bold rounded-full">
                  {tableName} · {formatNumber(visibleRows.length)} of {formatNumber(rows.length)} rows
                </span>
                <div className="relative w-64">
                  <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resultSearch}
                    onChange={e => setResultSearch(e.target.value)}
                    placeholder="Search rows…"
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-card-border rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
              <div className="border border-card-border rounded-2xl overflow-auto" style={{ maxHeight: '70vh' }}>
                <table className="text-xs border-collapse" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr className="bg-tint">
                      {columns.map(col => (
                        <th
                          key={col}
                          onClick={() => toggleSort(col)}
                          className="px-3 py-2.5 text-left font-bold text-gray-800 whitespace-nowrap sticky top-0 bg-tint cursor-pointer select-none hover:bg-[#DCE8FD] transition-colors"
                        >
                          <span className="flex items-center gap-1">
                            {col}
                            {sortCol === col
                              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />)
                              : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="px-3 py-6 text-center text-gray-400">
                          No rows match &quot;{resultSearch}&quot;.
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row, i) => (
                        <tr key={i} className={`hover:bg-[#F3F7FF] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                          {columns.map(col => (
                            <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap border-t border-card-border tabular-nums">
                              {row[col] == null || row[col] === '' ? <span className="text-gray-400">—</span> : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForecastViewTablePage() {
  return (
    <Suspense fallback={null}>
      <ForecastViewTableInner />
    </Suspense>
  );
}
