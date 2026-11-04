"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Plus, RefreshCw, Loader2, AlertTriangle, Trash2, Edit3, Check,
  Coins, Hash, Percent, Info, Database, ChevronDown,
  Search, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";

// ─────────────────────────── TYPES ───────────────────────────
// Mirrors the backend's /currency-settings/* API (see OpenAPI: Currency Settings tag).
interface Currency { code: string; name: string; symbol: string; default_format: string; }
interface NumberFormatOption { value: string; label: string; example: string; }
interface SettingTypeOption { value: string; label: string; description: string; uses_symbol: boolean; }
interface NumericColumn { column_name: string; sample_values: (number | string)[]; }
interface AvailableColumnSource {
  data_source_id: number;
  source_name: string;
  source_type: string;
  numeric_columns: NumericColumn[];
}
interface CurrencySetting {
  id: number;
  board_id: number;
  column_name: string;
  setting_type: string; // CURRENCY | NUMBER | PERCENTAGE
  currency_code: string | null;
  currency_symbol: string | null;
  symbol_position: string | null; // PREFIX | SUFFIX
  number_format: string | null; // INDIAN | WESTERN
  decimal_places: number | null;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}
interface BoardSettingsResponse {
  board_id: number;
  is_enabled: boolean;
  number_format: string;
  settings: CurrencySetting[];
}
interface ToastMessage { id: number; type: "success" | "error" | "info" | "warning"; message: string; }

interface SettingForm {
  // Multiple columns only apply on create — the same setting gets applied to each
  // (one POST per column, since the API only accepts one column per request).
  // Edit mode always holds exactly the one column being edited.
  column_names: string[];
  setting_type: string;
  currency_code: string;
  currency_symbol: string;
  symbol_position: string;
  number_format: string;
  decimal_places: number;
}
const emptyForm = (): SettingForm => ({
  column_names: [], setting_type: "CURRENCY", currency_code: "", currency_symbol: "",
  symbol_position: "PREFIX", number_format: "INDIAN", decimal_places: 0,
});

interface CurrencySettingsProps {
  boardId?: string | number;
  // When provided, a "Master Data" tab button is shown in the header
  // that switches the panel back to the master-data table view.
  onSwitchToMasterData?: () => void;
}

// ─────────────────────────── COMPONENT ───────────────────────────
export default function CurrencySettings(props: CurrencySettingsProps = {}) {
  const API_BASE = process.env.NEXT_PUBLIC_GBUSINESS_API_URL || "https://gbus-rbac-35486280762.us-central1.run.app";
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "KSgyfqwe@&!IBCwqregtyyqrtvTTXCTvbjjj>Custrbac&**&@$!989812005HbghbbwswswIPuyvar781";

  const getHeaders = (json = false) => {
    const h: Record<string, string> = { "X-API-Key": API_KEY };
    if (json) h["Content-Type"] = "application/json";
    return h;
  };

  const boardIdNum = Number(props.boardId || 0);

  // ─────────── TOAST ───────────
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastCounterRef = useRef(0);
  const showToast = (type: ToastMessage["type"], message: string) => {
    const id = toastCounterRef.current++;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const toastColor = (t: string) => ({ success: "bg-green-500", error: "bg-red-500", warning: "bg-yellow-500", info: "bg-blue-500" }[t] || "bg-gray-500");
  const toastIcon = (t: string) => t === "success" ? <Check className="h-5 w-5" /> : t === "error" ? <X className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />;

  // ─────────── LOOKUP DATA (fetched once) ───────────
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [numberFormats, setNumberFormats] = useState<NumberFormatOption[]>([]);
  const [settingTypes, setSettingTypes] = useState<SettingTypeOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  const fetchLookups = useCallback(async () => {
    setLoadingLookups(true);
    try {
      const [curRes, fmtRes, typeRes] = await Promise.all([
        fetch(`${API_BASE}/currency-settings/currencies`, { headers: getHeaders() }),
        fetch(`${API_BASE}/currency-settings/number-formats`, { headers: getHeaders() }),
        fetch(`${API_BASE}/currency-settings/setting-types`, { headers: getHeaders() }),
      ]);
      if (curRes.ok) { const j = await curRes.json(); setCurrencies(j.currencies || []); }
      if (fmtRes.ok) { const j = await fmtRes.json(); setNumberFormats(j.number_formats || []); }
      if (typeRes.ok) { const j = await typeRes.json(); setSettingTypes(j.setting_types || []); }
    } catch { showToast("error", "Failed to load currency options"); }
    finally { setLoadingLookups(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchLookups(); }, [fetchLookups]);

  // ─────────── BOARD SETTINGS (toggle + list) ───────────
  const [isEnabled, setIsEnabled] = useState(false);
  const [defaultFormat, setDefaultFormat] = useState("INDIAN");
  const [settings, setSettings] = useState<CurrencySetting[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const fetchBoardSettings = useCallback(async () => {
    if (!boardIdNum) return;
    setLoadingSettings(true);
    try {
      const res = await fetch(`${API_BASE}/currency-settings/board/${boardIdNum}`, { headers: getHeaders() });
      if (res.ok) {
        const j: BoardSettingsResponse = await res.json();
        setIsEnabled(!!j.is_enabled);
        setDefaultFormat(j.number_format || "INDIAN");
        setSettings(Array.isArray(j.settings) ? j.settings : []);
      } else {
        showToast("error", "Failed to load currency settings");
      }
    } catch { showToast("error", "Network error loading currency settings"); }
    finally { setLoadingSettings(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardIdNum]);

  useEffect(() => { if (boardIdNum) fetchBoardSettings(); }, [boardIdNum, fetchBoardSettings]);

  // Board-level: turn currency formatting on/off, and pick the default number format —
  // upserts via POST /config so it works whether or not a config row exists yet.
  const saveConfig = async (nextEnabled: boolean, nextFormat: string) => {
    if (!boardIdNum) return;
    setIsSavingConfig(true);
    try {
      const res = await fetch(`${API_BASE}/currency-settings/board/${boardIdNum}/config`, {
        method: "POST", headers: getHeaders(true),
        body: JSON.stringify({ is_enabled: nextEnabled, number_format: nextFormat }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setIsEnabled(nextEnabled);
      setDefaultFormat(nextFormat);
      showToast("success", nextEnabled ? "Currency formatting enabled" : "Currency formatting disabled");
    } catch { showToast("error", "Failed to update board settings"); }
    finally { setIsSavingConfig(false); }
  };

  // ─────────── AVAILABLE COLUMNS (auto-fetched when the Create modal opens) ───────────
  const [availableColumns, setAvailableColumns] = useState<AvailableColumnSource[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  const fetchAvailableColumns = useCallback(async () => {
    if (!boardIdNum) return;
    setLoadingColumns(true);
    try {
      const res = await fetch(`${API_BASE}/currency-settings/board/${boardIdNum}/available-columns`, { headers: getHeaders() });
      if (res.ok) {
        const j = await res.json();
        // Live response is { board_id, sources: [...] } — not the bare array the docs example shows.
        const sources = Array.isArray(j) ? j : Array.isArray(j?.sources) ? j.sources : [];
        setAvailableColumns(sources);
      } else {
        showToast("error", "Failed to load columns for this board");
      }
    } catch { showToast("error", "Network error loading columns"); }
    finally { setLoadingColumns(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardIdNum]);

  // ─────────── CREATE / EDIT MODAL ───────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<CurrencySetting | null>(null);
  const [form, setForm] = useState<SettingForm>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  const openCreateModal = () => {
    setEditingSetting(null);
    setForm(emptyForm());
    setIsModalOpen(true);
    fetchAvailableColumns(); // auto-fetch columns as soon as the modal opens
  };

  const openEditModal = (s: CurrencySetting) => {
    setEditingSetting(s);
    setForm({
      column_names: [s.column_name],
      setting_type: s.setting_type,
      currency_code: s.currency_code || "",
      currency_symbol: s.currency_symbol || "",
      symbol_position: s.symbol_position || "PREFIX",
      number_format: s.number_format || "INDIAN",
      decimal_places: s.decimal_places ?? 0,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingSetting(null); setColumnDropdownOpen(false); };

  const handleTypeChange = (type: string) => {
    setForm(f => ({ ...f, setting_type: type, decimal_places: type === "PERCENTAGE" ? 2 : 0 }));
  };

  const toggleColumn = (col: string) => {
    setForm(f => ({
      ...f,
      column_names: f.column_names.includes(col)
        ? f.column_names.filter(c => c !== col)
        : [...f.column_names, col],
    }));
  };

  // Columns field is a dropdown-style multi-select — closed by default, opens on click,
  // closes on an outside click.
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!columnDropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target as Node)) {
        setColumnDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [columnDropdownOpen]);

  const handleCurrencyChange = (code: string) => {
    const c = currencies.find(c => c.code === code);
    setForm(f => ({
      ...f,
      currency_code: code,
      currency_symbol: c?.symbol ?? f.currency_symbol,
      number_format: c?.default_format ?? f.number_format,
    }));
  };

  const parseApiError = async (res: Response, fallback: string) => {
    try {
      const e = await res.json();
      if (Array.isArray(e?.detail) && e.detail[0]?.msg) return e.detail[0].msg;
      return e?.detail || e?.message || fallback;
    } catch { return fallback; }
  };

  const buildTypeFields = (f: SettingForm) => {
    if (f.setting_type === "CURRENCY") {
      return {
        currency_code: f.currency_code,
        currency_symbol: f.currency_symbol,
        symbol_position: f.symbol_position,
        number_format: f.number_format,
        decimal_places: f.decimal_places,
      };
    }
    if (f.setting_type === "NUMBER") return { number_format: f.number_format };
    return { decimal_places: f.decimal_places }; // PERCENTAGE
  };

  const handleSubmit = async () => {
    if (!boardIdNum) { showToast("error", "Board not found"); return; }
    if (form.column_names.length === 0) { showToast("error", "Please select at least one column"); return; }
    if (form.setting_type === "CURRENCY" && !form.currency_code) { showToast("error", "Please select a currency"); return; }

    setIsSaving(true);
    try {
      if (editingSetting) {
        const res = await fetch(`${API_BASE}/currency-settings/${editingSetting.id}`, {
          method: "PUT", headers: getHeaders(true), body: JSON.stringify(buildTypeFields(form)),
        });
        if (!res.ok) throw new Error(await parseApiError(res, "Update failed"));
        showToast("success", `"${form.column_names[0]}" updated`);
        closeModal();
        fetchBoardSettings();
      } else {
        // Create — same setting applied to every selected column (one POST each,
        // since the API only accepts a single column per request).
        const typeFields = buildTypeFields(form);
        const results = await Promise.allSettled(
          form.column_names.map(async (col) => {
            const res = await fetch(`${API_BASE}/currency-settings/board/${boardIdNum}`, {
              method: "POST", headers: getHeaders(true),
              body: JSON.stringify({ column_name: col, setting_type: form.setting_type, ...typeFields }),
            });
            if (!res.ok) throw new Error(await parseApiError(res, `Failed for "${col}"`));
            return col;
          })
        );
        const succeeded = results.filter(r => r.status === "fulfilled").length;
        const failed = results.length - succeeded;
        if (succeeded > 0) {
          showToast("success", `Configured ${succeeded} column${succeeded === 1 ? "" : "s"}${failed ? ` — ${failed} failed` : ""}`);
        }
        if (failed > 0 && succeeded === 0) {
          showToast("error", "Failed to create settings for the selected columns");
        } else if (failed > 0) {
          showToast("error", `${failed} column${failed === 1 ? "" : "s"} could not be configured — they may already have a setting`);
        }
        if (succeeded > 0) { closeModal(); fetchBoardSettings(); }
      }
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────── DELETE ───────────
  const [deleteTarget, setDeleteTarget] = useState<CurrencySetting | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/currency-settings/${deleteTarget.id}`, { method: "DELETE", headers: getHeaders() });
      if (!res.ok) throw new Error("Delete failed");
      showToast("success", `"${deleteTarget.column_name}" removed`);
      setDeleteTarget(null);
      fetchBoardSettings();
    } catch { showToast("error", "Failed to delete setting"); }
    finally { setIsDeleting(false); }
  };

  // ─────────── DISPLAY HELPERS ───────────
  const typeBadge = (type: string) => {
    if (type === "CURRENCY") return { icon: <Coins className="h-3 w-3" />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (type === "PERCENTAGE") return { icon: <Percent className="h-3 w-3" />, cls: "bg-purple-50 text-purple-700 border-purple-200" };
    return { icon: <Hash className="h-3 w-3" />, cls: "bg-blue-50 text-blue-700 border-blue-200" };
  };

  // Digit grouping only (no symbol) — INDIAN uses 2-digit groups after the
  // leading thousands (lakh/crore style), WESTERN is plain 3-digit groups.
  const formatNumberGrouping = (n: number, fmt: string) => {
    const sign = n < 0 ? "-" : "";
    const abs = String(Math.trunc(Math.abs(n)));
    if (fmt !== "INDIAN") return sign + Number(abs).toLocaleString("en-US");
    if (abs.length <= 3) return sign + abs;
    const last3 = abs.slice(-3);
    const rest = abs.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `${sign}${rest},${last3}`;
  };

  const formatDisplay = (s: CurrencySetting) => {
    if (s.setting_type === "CURRENCY") {
      const sym = s.currency_symbol || "";
      const example = s.symbol_position === "SUFFIX" ? `1,20,000${sym}` : `${sym}1,20,000`;
      return `${s.currency_code || ""} · ${s.number_format || ""} (${example})`;
    }
    if (s.setting_type === "PERCENTAGE") return `${s.decimal_places ?? 0} decimal place${(s.decimal_places ?? 0) === 1 ? "" : "s"}`;
    return s.number_format || "—";
  };

  // ─────────── TABLE SEARCH + SORT ───────────
  const [tableFilter, setTableFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<"column" | "type" | "format" | "status" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (col: "column" | "type" | "format" | "status") => {
    if (sortColumn === col) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  };

  const visibleSettings = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    let rows = settings;
    if (q) {
      rows = rows.filter(s =>
        s.column_name.toLowerCase().includes(q) ||
        s.setting_type.toLowerCase().includes(q) ||
        formatDisplay(s).toLowerCase().includes(q)
      );
    }
    if (sortColumn) {
      const sortValue = (s: CurrencySetting): string | number => {
        if (sortColumn === "column") return s.column_name.toLowerCase();
        if (sortColumn === "type") return s.setting_type.toLowerCase();
        if (sortColumn === "format") return formatDisplay(s).toLowerCase();
        return s.is_active !== false ? 1 : 0; // status
      };
      rows = [...rows].sort((a, b) => {
        const av = sortValue(a), bv = sortValue(b);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, tableFilter, sortColumn, sortDir]);

  const selectedTypeInfo = settingTypes.find(t => t.value === form.setting_type);

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  if (!boardIdNum) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <Coins className="h-10 w-10 text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Select a board to manage currency settings.</p>
      </div>
    );
  }

  return (
    <div>
      {/* TOASTS */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`${toastColor(t.type)} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px] animate-slide-in`}>
            <div className="flex-shrink-0">{toastIcon(t.type)}</div>
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="flex-shrink-0 hover:bg-white/20 rounded p-1"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* HEADER */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-tint flex items-center justify-center flex-shrink-0">
              <Coins className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 font-heading">Currency Settings</h1>
              <p className="text-xs text-gray-500">Format amount, number & percentage columns for this board</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {props.onSwitchToMasterData && (
              <button
                onClick={props.onSwitchToMasterData}
                className="flex items-center gap-1.5 h-11 px-4 bg-white border border-card-border text-gray-700 rounded-full hover:border-accent hover:bg-tint transition-all text-sm font-medium"
              >
                <Database className="w-4 h-4" />
                <span>Master Data</span>
              </button>
            )}
            <button onClick={fetchBoardSettings} disabled={loadingSettings}
              className="h-11 px-4 bg-white border border-card-border text-gray-700 rounded-full flex items-center gap-1.5 hover:border-accent hover:bg-tint transition-all disabled:opacity-50 text-sm font-medium">
              <RefreshCw className={`h-4 w-4 ${loadingSettings ? "animate-spin text-blue-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={openCreateModal}
              className="h-11 px-4 bg-accent text-white rounded-full flex items-center gap-2 shadow-sm hover:bg-accent-hover transition-all font-medium text-sm">
              <Plus className="h-4 w-4" />
              <span>Create Currency</span>
            </button>
          </div>
        </div>

        {/* TOGGLE + DEFAULT FORMAT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Currency Formatting toggle card */}
          <div className="bg-white rounded-2xl border border-card-border shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="text-base font-bold text-gray-800 font-heading">Currency Formatting</h3>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isEnabled ? "bg-tint text-accent" : "bg-gray-100 text-gray-400"}`}>
                {isEnabled ? "ON" : "OFF"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {isEnabled ? "Column settings below are applied to prompt results." : "Prompt results run unformatted until this is turned on."}
            </p>
            <button
              onClick={() => saveConfig(!isEnabled, defaultFormat)}
              disabled={isSavingConfig}
              className="flex items-center gap-2.5 disabled:opacity-50 mb-4"
            >
              <span className={`relative w-11 h-6 rounded-full transition-colors ${isEnabled ? "bg-accent" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isEnabled ? "left-5" : "left-0.5"}`} />
              </span>
              <span className="text-sm font-medium text-gray-700">
                {isEnabled ? "Turn off formatting" : "Turn on to format results"}
              </span>
            </button>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Example</span>
              <span className="text-lg font-bold text-gray-900">
                {isEnabled ? formatNumberGrouping(1845200, defaultFormat) : "1845200"}
              </span>
            </div>
          </div>

          {/* Default format card */}
          <div className="bg-white rounded-2xl border border-card-border shadow-sm p-5">
            <h3 className="text-base font-bold text-gray-800 font-heading mb-1">Default format</h3>
            <p className="text-xs text-gray-500 mb-4">Used for every currency column in this board.</p>
            <div className="grid grid-cols-2 gap-3">
              {(numberFormats.length > 0 ? numberFormats : [{ value: "INDIAN", label: "Indian", example: "1,00,000" }, { value: "WESTERN", label: "Western", example: "1,000,000" }]).map(f => {
                const selected = defaultFormat === f.value;
                const symbol = f.value === "INDIAN" ? "₹" : "$";
                return (
                  <button
                    key={f.value}
                    onClick={() => saveConfig(isEnabled, f.value)}
                    disabled={isSavingConfig}
                    className={`relative text-left rounded-xl border-2 p-4 transition-colors disabled:opacity-50 ${
                      selected ? "border-accent" : "border-card-border hover:border-blue-300"
                    }`}
                  >
                    {selected && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <p className="text-sm font-bold text-gray-900">
                      {f.label}{f.example ? <span className="font-normal text-gray-400"> ({f.example})</span> : null}
                    </p>
                    <p className="text-lg font-bold text-accent mt-1">
                      {symbol}{formatNumberGrouping(f.value === "INDIAN" ? 120000 : 1200000, f.value)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SETTINGS TABLE */}
        <div className="bg-white rounded-2xl border border-card-border shadow-sm overflow-hidden">
          {loadingSettings ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-3 bg-tint rounded animate-pulse" style={{ width: `${60 - i * 10}%` }} />
              ))}
            </div>
          ) : settings.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-48">
              <Coins className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium text-sm">Click "Create Currency" to format your first column</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableFilter}
                    onChange={e => setTableFilter(e.target.value)}
                    placeholder="Search column, type, format…"
                    className="pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
                  />
                </div>
                {tableFilter && (
                  <span className="text-xs text-gray-400">{visibleSettings.length} of {settings.length}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                {visibleSettings.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-32">
                    <p className="text-gray-400 text-sm">No settings match &quot;{tableFilter}&quot;</p>
                  </div>
                ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-blue-600">
                    <tr>
                      {([
                        ["column", "Column"],
                        ["type", "Type"],
                        ["format", "Format"],
                        ["status", "Status"],
                      ] as const).map(([key, label]) => {
                        const isSorted = sortColumn === key;
                        return (
                          <th
                            key={key}
                            onClick={() => handleSort(key)}
                            className="text-left px-4 py-2.5 font-bold text-white text-xs uppercase tracking-wide cursor-pointer select-none hover:bg-blue-700 transition-colors"
                          >
                            <span className="flex items-center gap-1">
                              {label}
                              {isSorted
                                ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-white" /> : <ArrowDown className="w-3 h-3 text-white" />)
                                : <ArrowUpDown className="w-3 h-3 text-blue-200" />}
                            </span>
                          </th>
                        );
                      })}
                      <th className="text-right px-4 py-2.5 font-bold text-white text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSettings.map(s => {
                    const badge = typeBadge(s.setting_type);
                    return (
                      <tr key={s.id} className="odd:bg-white even:bg-gray-50 border-b border-card-border last:border-0 hover:bg-[#F3F7FF] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.column_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.cls}`}>
                            {badge.icon}{s.setting_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{formatDisplay(s)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            s.is_active !== false ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}>
                            {s.is_active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditModal(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[95vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-card-border flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-tint flex items-center justify-center flex-shrink-0">
                  <Coins className="h-4 w-4 text-accent" />
                </div>
                <h3 className="text-sm font-bold text-gray-800 font-heading">{editingSetting ? "Edit Setting" : "Create Currency Setting"}</h3>
              </div>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-4 space-y-2.5">
              {/* Column(s) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {editingSetting ? "Column" : "Columns"}
                  {!editingSetting && form.column_names.length > 0 && (
                    <span className="ml-1.5 font-normal text-gray-400">({form.column_names.length} selected)</span>
                  )}
                </label>
                {editingSetting ? (
                  <input value={form.column_names[0] || ""} disabled className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-gray-50 text-gray-500" />
                ) : loadingColumns ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching numeric columns from this board's data sources...
                  </div>
                ) : (
                  <div className="relative" ref={columnDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setColumnDropdownOpen(o => !o)}
                      className="w-full h-11 flex items-center justify-between px-3 border border-card-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <span className={form.column_names.length === 0 ? "text-gray-400" : "text-gray-900"}>
                        {form.column_names.length === 0
                          ? "Select columns..."
                          : form.column_names.length <= 2
                            ? form.column_names.join(", ")
                            : `${form.column_names.length} columns selected`}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${columnDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {columnDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-lg p-2 space-y-2">
                        {availableColumns.map(src => (
                          <div key={src.data_source_id}>
                            <p className="px-2 py-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                              {src.source_name} ({src.source_type})
                            </p>
                            {src.numeric_columns.map(col => (
                              <label key={col.column_name} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-gray-50 cursor-pointer rounded">
                                <input
                                  type="checkbox"
                                  checked={form.column_names.includes(col.column_name)}
                                  onChange={() => toggleColumn(col.column_name)}
                                  className="h-4 w-4 text-blue-600 rounded"
                                />
                                <span className="text-sm text-gray-900">
                                  {col.column_name}
                                  {col.sample_values?.length ? (
                                    <span className="text-gray-400"> — e.g. {col.sample_values.slice(0, 3).join(", ")}</span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!editingSetting && !loadingColumns && availableColumns.length === 0 && (
                  <p className="mt-0.5 text-[11px] text-amber-600 flex items-center gap-1"><Info className="h-3 w-3" /> No numeric columns found — add a data source to this board first.</p>
                )}
              </div>

              {/* Setting type — locked once created; changing it after the fact would
                  silently reinterpret an already-in-use format, so Edit shows it read-only. */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                  Setting Type
                  {loadingLookups && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                </label>
                {editingSetting ? (
                  <input
                    value={selectedTypeInfo?.label || form.setting_type}
                    disabled
                    className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-gray-50 text-gray-500"
                  />
                ) : (
                  <select
                    value={form.setting_type}
                    onChange={e => handleTypeChange(e.target.value)}
                    disabled={loadingLookups}
                    className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:bg-gray-50"
                  >
                    {(settingTypes.length > 0 ? settingTypes : [
                      { value: "CURRENCY", label: "Currency", description: "", uses_symbol: true },
                      { value: "NUMBER", label: "Plain Number", description: "", uses_symbol: false },
                      { value: "PERCENTAGE", label: "Percentage", description: "", uses_symbol: true },
                    ]).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                )}
                {selectedTypeInfo?.description && (
                  <p className="mt-0.5 text-[11px] text-gray-500">{selectedTypeInfo.description}</p>
                )}
              </div>

              {/* CURRENCY fields */}
              {form.setting_type === "CURRENCY" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Currency</label>
                    <select
                      value={form.currency_code}
                      onChange={e => handleCurrencyChange(e.target.value)}
                      className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">Select a currency...</option>
                      {currencies.map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Symbol</label>
                      <input
                        value={form.currency_symbol}
                        onChange={e => setForm(f => ({ ...f, currency_symbol: e.target.value }))}
                        className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="₹"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Position</label>
                      <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                        {["PREFIX", "SUFFIX"].map(pos => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, symbol_position: pos }))}
                            className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                              form.symbol_position === pos ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {pos === "PREFIX" ? `${form.currency_symbol || "₹"}100` : `100${form.currency_symbol || "₹"}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Number Format</label>
                      <select
                        value={form.number_format}
                        onChange={e => setForm(f => ({ ...f, number_format: e.target.value }))}
                        className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {(numberFormats.length > 0 ? numberFormats : [{ value: "INDIAN", label: "Indian", example: "" }, { value: "WESTERN", label: "Western", example: "" }]).map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Decimal Places</label>
                      <input
                        type="number" min={0} max={4}
                        value={form.decimal_places}
                        onChange={e => setForm(f => ({ ...f, decimal_places: Math.max(0, Math.min(4, Number(e.target.value) || 0)) }))}
                        className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* NUMBER fields */}
              {form.setting_type === "NUMBER" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Number Format</label>
                  <select
                    value={form.number_format}
                    onChange={e => setForm(f => ({ ...f, number_format: e.target.value }))}
                    className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {(numberFormats.length > 0 ? numberFormats : [{ value: "INDIAN", label: "Indian", example: "" }, { value: "WESTERN", label: "Western", example: "" }]).map(f => (
                      <option key={f.value} value={f.value}>{f.label}{f.example ? ` (${f.example})` : ""}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* PERCENTAGE fields */}
              {form.setting_type === "PERCENTAGE" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Decimal Places</label>
                  <input
                    type="number" min={0} max={4}
                    value={form.decimal_places}
                    onChange={e => setForm(f => ({ ...f, decimal_places: Math.max(0, Math.min(4, Number(e.target.value) || 0)) }))}
                    className="w-full h-11 px-3 border border-card-border rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p className="mt-0.5 text-[11px] text-gray-500">Shown as e.g. {(45.67).toFixed(form.decimal_places)}%</p>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-card-border bg-white flex justify-end gap-2 sticky bottom-0 rounded-b-2xl">
              <button onClick={closeModal} disabled={isSaving} className="h-11 px-4 text-sm font-medium text-gray-700 bg-white border border-card-border rounded-xl hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleSubmit} disabled={isSaving || form.column_names.length === 0} className="h-11 px-4 text-sm font-medium text-white bg-accent rounded-xl hover:bg-accent-hover disabled:opacity-50 flex items-center gap-1.5">
                {isSaving
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{editingSetting ? "Saving..." : "Creating..."}</>
                  : editingSetting ? "Save Changes" : `Create${form.column_names.length > 1 ? ` (${form.column_names.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-gray-700">Delete setting for <strong className="text-red-800">"{deleteTarget.column_name}"</strong>?</p>
                <p className="text-sm text-gray-500 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50">
                {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Deleting...</span></> : <><Trash2 className="h-4 w-4" /><span>Delete</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
