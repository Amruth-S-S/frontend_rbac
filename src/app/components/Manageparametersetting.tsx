"use client";
import React, { useMemo, useCallback, memo, useState, useEffect, useRef } from "react";
import {
  X, FileText, FileSpreadsheet, FileJson, Check, Eye, Database, Plus, Loader2,
  AlertTriangle, RefreshCw, Trash2, Edit3, Type, Filter, Calendar, RotateCcw,
  History, Save, Hash, BookMarked, SaveAll, Settings2, ChevronDown, ChevronUp,
  Info, Layers, ToggleLeft, ToggleRight, Tag
} from "lucide-react";

// ─────────────────────────── TYPES ───────────────────────────
type FileType = "csv" | "excel" | "json";

interface ParameterSetting {
  id: number;
  name: string;
  description: string;
  board_id: number;
  data_source_id: number;
  is_active?: boolean;
  is_filter_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  data_source?: { id: number; source_name: string; source_type: string };
}

interface SelectedDataset {
  param_id: number;
  name: string;
  description: string;
  type: FileType;
  rows: number;
  columns: number;
  fullData?: any[];
  columnHeaders?: string[];
}

interface ToastMessage {
  id: number;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

interface HistoryItem { track_id: string; note: string; }

interface VersionInfo {
  version: number;
  version_name: string;
  row_count_original?: number | null;
  row_count_filtered?: number | null;
  source_type?: string;
}

interface FilterSummaryItem {
  filter_type: string;
  note: string;
  params?: Record<string, any>;
}

interface ExternalDataSource {
  name: string;
  id: number | string;
  source_name: string;
  slot_number?: number;
  source_type_display?: string;
  description?: string;
}

interface ManageParameterSettingProps {
  boardId?: string | number;
  userId?: string | number;
  orgId?: string | number;
  dataSources?: ExternalDataSource[];
  onFilterToggle?: () => void;
}

// ─────────────────────────── COMPONENT ───────────────────────────
export default function ManageParameterSetting(props: ManageParameterSettingProps = {}) {
  const API_BASE = process.env.NEXT_PUBLIC_GBUSINESS_API_URL || "https://gbus-dev1-35486280762.us-central1.run.app";
  const API_KEY  = process.env.NEXT_PUBLIC_API_KEY || "";

  const getHeaders = (json = false) => {
    const h: Record<string, string> = { "X-API-Key": API_KEY };
    if (json) h["Content-Type"] = "application/json";
    return h;
  };

  const [boardId, setBoardId] = useState<number>(Number(props.boardId || 0));
  const [userId,  setUserId]  = useState<number>(Number(props.userId  || 0));
  const [orgId,   setOrgId]   = useState<number>(Number(props.orgId   || 0));

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!props.boardId) setBoardId(Number(sessionStorage.getItem("board_id") || 0));
      if (!props.userId)  setUserId(Number(sessionStorage.getItem("user_id") || 0));
      if (!props.orgId)   setOrgId(Number(sessionStorage.getItem("organization_id") || 0));
    }
  }, [props.boardId, props.userId, props.orgId]);

  // ─────────── TOAST ───────────
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastCounterRef = useRef(0);
  const showToast = (type: ToastMessage["type"], message: string) => {
    const id = toastCounterRef.current++;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  // ─────────── PARAMETER SETTINGS ───────────
  const [parameterSettings, setParameterSettings] = useState<ParameterSetting[]>([]);
  const [loadingSettings, setLoadingSettings]     = useState(false);
  const [togglingIds, setTogglingIds]             = useState<Set<number>>(new Set());
  const [loadingCardIds, setLoadingCardIds]       = useState<Set<number>>(new Set());
  const [loadingVersionIds, setLoadingVersionIds] = useState<Set<number>>(new Set());
  const [paramVersions, setParamVersions]         = useState<Record<number, VersionInfo>>({});
  const [openVersionDropdowns, setOpenVersionDropdowns] = useState<Set<number>>(new Set());

  // ── NEW: Track loaded params & filter summaries ──
  const [loadedParamIds, setLoadedParamIds]     = useState<Set<number>>(new Set());
  const [filterSummaries, setFilterSummaries]   = useState<Record<number, FilterSummaryItem[]>>({});

  const toggleVersionDropdown = (id: number) => {
    setOpenVersionDropdowns(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // ── Helper: fetch & store filter summary for one param ──
  const fetchFilterSummary = async (paramId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/parameter-settings/${paramId}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const val = await res.json();
        const summary: FilterSummaryItem[] = val.filter_summary ?? val.parameter_setting?.filter_summary ?? [];
      setFilterSummaries(prev => ({ ...prev, [Number(paramId)]: Array.isArray(summary) ? summary : [] }));
      }
    } catch {}
  };

  const fetchParameterSettings = async () => {
    setLoadingSettings(true);
    try {
      const sources = props.dataSources && props.dataSources.length > 0 ? props.dataSources : [];
      if (sources.length === 0) { setParameterSettings([]); setLoadingSettings(false); return; }

      const paramIds: number[] = [];
      await Promise.allSettled(sources.map(async ds => {
        try {
          const res = await fetch(`${API_BASE}/api/parameter-settings/data-source/${ds.id}/settings`, { method: "GET", headers: getHeaders() });
          if (!res.ok) return;
          const json = await res.json();
          const items: any[] = Array.isArray(json) ? json
            : Array.isArray(json.settings) ? json.settings
            : json.parameter_setting ? [json.parameter_setting]
            : json.id ? [json] : [];
          items.forEach(item => {
            const id = Number(item.id ?? item.param_id);
            if (id && !paramIds.includes(id)) paramIds.push(id);
          });
        } catch { }
      }));

      if (paramIds.length === 0) { setParameterSettings([]); setLoadingSettings(false); return; }

      const fullResults = await Promise.allSettled(
        paramIds.map(id => fetch(`${API_BASE}/api/parameter-settings/${id}`, { method: "GET", headers: getHeaders() }).then(r => r.ok ? r.json() : null))
      );

      const allSettings: ParameterSetting[] = [];
      fullResults.forEach(result => {
        if (result.status === "fulfilled" && result.value) {
          const val = result.value;
          const ps: ParameterSetting = val.parameter_setting
            ? { ...val.parameter_setting, data_source: val.data_source }
            : val.id ? val : null;
          if (ps) {
            allSettings.push(ps);
            // ── NEW: Extract and store filter_summary ──
            const summary: FilterSummaryItem[] = val.filter_summary ?? val.parameter_setting?.filter_summary ?? [];
            if (Array.isArray(summary)) {
            setFilterSummaries(prev => ({ ...prev, [Number(ps.id)]: Array.isArray(summary) ? summary : [] }));
            }
          }
        }
      });
      setParameterSettings(allSettings);
      allSettings.forEach(ps => fetchLatestVersion(ps.id));
    } catch {
      showToast("error", "Failed to load parameter settings");
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchLatestVersion = async (paramId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/parameter-settings/${paramId}/versions`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const versions: any[] = data.versions || (Array.isArray(data) ? data : []);
        if (versions.length > 0) {
          const latest = versions[versions.length - 1];
          setParamVersions(prev => ({
            ...prev,
            [paramId]: {
              version:            latest.version,
              version_name:       latest.version_name || latest.name || `v${latest.version}`,
              row_count_original: latest.row_count_original ?? null,
              row_count_filtered: latest.row_count_filtered ?? null,
              source_type:        latest.source_type ?? "csv",
            }
          }));
        }
      }
    } catch { }
  };

  const openFilteredVersionViewer = async (ps: ParameterSetting, vInfo: VersionInfo) => {
    setLoadingVersionIds(prev => new Set(prev).add(ps.id));
    try {
      const versionRes = await fetch(
        `${API_BASE}/api/parameter-settings/${ps.id}/versions/${vInfo.version}`,
        { method: "GET", headers: getHeaders() }
      );
      if (versionRes.ok) {
        await versionRes.json();
        setIsViewerOpen(true);
        setIsPreviewMode(false); setPreviewData(null); setCurrentFilterType(null);
        setHasTransformations(false); setSortColumn(null); setSortOrder("asc");
        setIsEditPanelOpen(false); setSelectedTransformation(null);
        resetFilterForms();

        const init: SelectedDataset = {
          param_id:      ps.id,
          name:          vInfo.version_name,
          description:   `Filtered version of "${ps.name}" — v${vInfo.version}`,
          type:          "csv",
          rows:          vInfo.row_count_filtered ?? 0,
          columns:       0,
          fullData:      [],
          columnHeaders: [],
        };
        setSelectedDataset(init);

        const dataRes = await fetch(`${API_BASE}/api/parameter-settings/${ps.id}/view-data/`, { method: "GET", headers: getHeaders() });
        if (dataRes.ok) {
          const json          = await dataRes.json();
          const fullData      = json.data || json.preview || [];
          const columnHeaders = json.columns || [];
          const rows          = json.rows || fullData.length;
          setSelectedDataset({ ...init, fullData, columnHeaders, rows, columns: columnHeaders.length });
          showToast("success", `Loaded filtered version: ${rows.toLocaleString()} rows`);
        } else {
          showToast("warning", "Could not load filtered data — showing version metadata only");
        }
      } else {
        await openViewer(ps);
      }
    } catch {
      showToast("error", "Network error loading filtered version");
      setIsViewerOpen(false);
    } finally {
      setLoadingVersionIds(prev => { const s = new Set(prev); s.delete(ps.id); return s; });
    }
  };

  useEffect(() => {
    if (boardId && props.dataSources && props.dataSources.length > 0) fetchParameterSettings();
  }, [boardId, props.dataSources]);

  // ─────────── TOGGLE FILTER ───────────
  const handleToggleFilter = async (ps: ParameterSetting, e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingIds(prev => new Set(prev).add(ps.id));
    const newValue = !ps.is_filter_enabled;
    try {
      const res = await fetch(`${API_BASE}/api/parameter-settings/${ps.id}/toggle`, {
        method: "PUT", headers: getHeaders(true),
        body: JSON.stringify({ is_filter_enabled: newValue })
      });
      if (res.ok) {
        setParameterSettings(prev => prev.map(p => p.id === ps.id ? { ...p, is_filter_enabled: newValue } : p));
        showToast("success", `Filter ${newValue ? "enabled" : "disabled"} for "${ps.name}"`);
        props.onFilterToggle?.();
      } else { showToast("error", `Toggle failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error toggling filter"); }
    finally { setTogglingIds(prev => { const s = new Set(prev); s.delete(ps.id); return s; }); }
  };

  // ─────────── CARD INFO: quick load & open ───────────
  const handleCardInfoClick = async (ps: ParameterSetting, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingCardIds(prev => new Set(prev).add(ps.id));
    try {
      showToast("info", `Loading "${ps.name}"...`);
      const loadRes = await fetch(`${API_BASE}/api/parameter-settings/${ps.id}/load-source`, { method: "POST", headers: getHeaders(true) });
      if (!loadRes.ok && loadRes.status !== 400 && loadRes.status !== 409) {
        showToast("error", `Load failed: ${await loadRes.text()}`); return;
      }
      await openViewer(ps);
      // ── NEW: Mark this param as loaded ──
      setLoadedParamIds(prev => new Set(prev).add(ps.id));
    } catch { showToast("error", "Network error loading parameter setting"); }
    finally { setLoadingCardIds(prev => { const s = new Set(prev); s.delete(ps.id); return s; }); }
  };

  // ─────────── FILTER LIST ───────────
  const [listFilterName,   setListFilterName]   = useState("");
  const [listFilterSource, setListFilterSource] = useState<number | "">("");

  const filteredSettings = useMemo(() => parameterSettings.filter(p => {
    const nameMatch = !listFilterName || p.name.toLowerCase().includes(listFilterName.toLowerCase());
    const srcMatch  = !listFilterSource || p.data_source_id === Number(listFilterSource);
    return nameMatch && srcMatch;
  }), [parameterSettings, listFilterName, listFilterSource]);

  // ─────────── CREATE MODAL ───────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm]           = useState({ name: "", description: "", data_source_id: "" });
  const [isCreating, setIsCreating]           = useState(false);
  const [internalDataSources, setInternalDataSources] = useState<ExternalDataSource[]>([]);
  const [loadingDS, setLoadingDS]             = useState(false);

  const dataSources: ExternalDataSource[] = (props.dataSources && props.dataSources.length > 0) ? props.dataSources : internalDataSources;

  const fetchDataSources = async () => {
    if (props.dataSources && props.dataSources.length > 0) return;
    if (!boardId) return;
    setLoadingDS(true);
    try {
      const res = await fetch(`${API_BASE}/main-boards/boards/data-sources/board/${boardId}?user_id=${userId}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInternalDataSources(Array.isArray(data) ? data : data.data_sources || data.sources || []);
      } else { showToast("error", "Failed to load data sources"); }
    } catch { showToast("error", "Network error loading data sources"); }
    finally { setLoadingDS(false); }
  };

  const openCreateModal = () => {
    setCreateForm({ name: "", description: "", data_source_id: "" });
    setShowCreateModal(true);
    if (!props.dataSources || props.dataSources.length === 0) fetchDataSources();
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.data_source_id) { showToast("warning", "Please fill in all required fields"); return; }
    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/parameter-settings/`, {
        method: "POST", headers: getHeaders(true),
        body: JSON.stringify({ board_id: boardId, data_source_id: Number(createForm.data_source_id), description: createForm.description, name: createForm.name.trim() })
      });
      if (res.ok) {
        const created = await res.json();
        const createdObj = created.parameter_setting || created;
        const newId = createdObj.id || createdObj.param_id;
        showToast("success", `Parameter setting "${createForm.name}" created!`);
        setShowCreateModal(false);
        if (newId) {
          await fetch(`${API_BASE}/api/parameter-settings/${newId}/load-source`, { method: "POST", headers: getHeaders(true) });
          const pseudo: ParameterSetting = { id: newId, name: createForm.name, description: createForm.description, board_id: boardId, data_source_id: Number(createForm.data_source_id) };
          await openViewer(pseudo);
        }
        await fetchParameterSettings();
      } else { showToast("error", `Create failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error creating parameter setting"); }
    finally { setIsCreating(false); }
  };

  // ─────────── DELETE ───────────
  const [deleteTarget, setDeleteTarget] = useState<ParameterSetting | null>(null);
  const [isDeleting, setIsDeleting]     = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/parameter-settings/${deleteTarget.id}`, { method: "DELETE", headers: getHeaders() });
      if (res.ok) {
        showToast("success", `"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
        fetchParameterSettings();
      } else { showToast("error", `Delete failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error deleting"); }
    finally { setIsDeleting(false); }
  };

  // ─────────── VIEWER ───────────
  const [isViewerOpen, setIsViewerOpen]       = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<SelectedDataset | null>(null);

  const openViewer = async (ps: ParameterSetting) => {
    setIsViewerOpen(true);
    setIsPreviewMode(false); setPreviewData(null); setCurrentFilterType(null);
    setHasTransformations(false); setSortColumn(null); setSortOrder("asc");
    setIsEditPanelOpen(false); setSelectedTransformation(null);
    resetFilterForms();
    const init: SelectedDataset = { param_id: ps.id, name: ps.name, description: ps.description, type: "csv", rows: 0, columns: 0, fullData: [], columnHeaders: [] };
    setSelectedDataset(init);
    try {
      const res = await fetch(`${API_BASE}/api/parameter-settings/${ps.id}/view-data/`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const fullData      = json.data || json.preview || [];
        const columnHeaders = json.columns || [];
        const rows          = json.rows || fullData.length;
        setSelectedDataset({ ...init, fullData, columnHeaders, rows, columns: columnHeaders.length });
        showToast("success", `Loaded: ${rows.toLocaleString()} rows × ${columnHeaders.length} columns`);
        await checkHistory(ps.id);
      } else {
        showToast("error", `Failed to load data: ${await res.text()}`);
        setIsViewerOpen(false);
      }
    } catch {
      showToast("error", "Network error loading dataset");
      setIsViewerOpen(false);
    }
  };

  const closeViewer = () => {
    setIsViewerOpen(false); setSelectedDataset(null);
    setIsEditPanelOpen(false); setSelectedTransformation(null);
    setIsPreviewMode(false); setPreviewData(null); setCurrentFilterType(null);
    setHasTransformations(false); setSortColumn(null); setSortOrder("asc");
    resetFilterForms();
  };

  const pid  = selectedDataset?.param_id;
  const purl = (path: string) => `${API_BASE}/api/parameter-settings/${pid}${path}`;

  // ─────────── EDIT PANEL ───────────
  const [isEditPanelOpen, setIsEditPanelOpen]               = useState(false);
  const [selectedTransformation, setSelectedTransformation] = useState<string | null>(null);

  const toggleEditPanel = () => { setIsEditPanelOpen(p => !p); setSelectedTransformation(null); };

  const handleTransformationSelect = (t: string) => {
    setSelectedTransformation(t);
    setRenameOldColumn(""); setRenameNewColumn("");
    setTypeCastColumn(""); setTypeCastNewType("");
    setGroupByColumns([]); setAggregateColumn(""); setAggregateFunction("");
    setDateColumn(""); setDateSummaryLoaded(false); setSelectedYears([]); setSelectedMonths([]); setSelectedDays([]);
    setFilterColumn(""); setUniqueValuesData(null); setSelectedFilterValues(new Set()); setUniqueValuesLoaded(false); setUniqueValuesSearch(""); setQuickSelectInput("");
    setTextFilterColumn(""); setTextFilterType("equals"); setTextFilterValue(""); setTextFilterValue2(""); setTextFilterValues([]);
    setNumberFilterColumn(""); setNumberFilterType("equals"); setNumberFilterValue(""); setNumberFilterValue2(""); setNumberFilterValues([]);
    setHistoryData([]);
    if (t === "get_history") fetchHistory();
  };
const [quickSelectInput, setQuickSelectInput] = useState("");
  const transformationOptions = useMemo(() => [
    { id: "rename_column",       label: "Rename Column",     icon: <Type className="h-4 w-4" />,     color: "green"  },
    { id: "type_cast",           label: "Type Cast",         icon: <FileText className="h-4 w-4" />, color: "purple" },
    { id: "group_and_aggregate", label: "Group & Aggregate", icon: <Database className="h-4 w-4" />, color: "orange" },
    { id: "filter_by_date",      label: "Filter by Date",    icon: <Calendar className="h-4 w-4" />, color: "pink"   },
    { id: "get_history",         label: "Get History",       icon: <History className="h-4 w-4" />,  color: "gray"   },
    { id: "filter_by_values",    label: "Filter by Values",  icon: <Filter className="h-4 w-4" />,   color: "indigo" },
    { id: "text_filter",         label: "Text Filter",       icon: <Type className="h-4 w-4" />,     color: "blue"   },
    { id: "number_filter",       label: "Number Filter",     icon: <Hash className="h-4 w-4" />,     color: "teal"   },
  ], []);

  // ─────────── PREVIEW / FILTER STATE ───────────
  const [isPreviewMode,      setIsPreviewMode]      = useState(false);
  const [previewData,        setPreviewData]        = useState<any>(null);
  const [currentFilterType,  setCurrentFilterType]  = useState<string | null>(null);
  const [isSavingFilter,     setIsSavingFilter]     = useState(false);
  const [hasTransformations, setHasTransformations] = useState(false);

  const checkHistory = async (paramId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/parameter-settings/${paramId}/history/`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const result = await res.json();
        setHasTransformations((result.history || []).length > 0);
      }
    } catch { }
  };

  const refreshCurrentDataset = async () => {
    if (!selectedDataset) return;
    try {
      const url = isPreviewMode ? purl("/get-current-filtered/") : purl("/view-data/");
      const res = await fetch(url, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const fullData      = json.data || json.preview || [];
        const columnHeaders = json.columns || [];
        setSelectedDataset({ ...selectedDataset, fullData, columnHeaders, rows: json.rows || fullData.length, columns: columnHeaders.length });
      }
    } catch { }
  };

  const refreshSavedDataset = async () => {
    if (!selectedDataset) return;
    try {
      const res = await fetch(purl("/view-data/"), { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const json = await res.json();
        const fullData      = json.data || json.preview || [];
        const columnHeaders = json.columns || [];
        setSelectedDataset({ ...selectedDataset, fullData, columnHeaders, rows: json.rows || fullData.length, columns: columnHeaders.length });
      }
    } catch { }
  };

  const fetchFilterPreview = async () => {
    if (!selectedDataset) return;
    try {
      const res = await fetch(purl("/get-current-filtered/"), { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const result        = await res.json();
        const filteredData  = result.preview || result.data || [];
        const columnHeaders = result.columns || selectedDataset.columnHeaders || [];
        const rows          = result.rows || filteredData.length;
        setPreviewData(result);
        setIsPreviewMode(true);
        setSelectedDataset({ ...selectedDataset, fullData: filteredData, rows, columns: columnHeaders.length, columnHeaders });
        showToast("success", `Preview: ${rows} rows (${result.dropped_rows || 0} filtered out)`);
      } else { showToast("error", `Preview failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error loading preview"); }
  };

  const saveCurrentFilter = async () => {
    if (!selectedDataset) return;
    setIsSavingFilter(true);
    try {
      const res = await fetch(purl("/save-filter/"), { method: "POST", headers: getHeaders(true) });
      if (res.ok) {
        showToast("success", "Changes saved successfully! ✅");
        setHasTransformations(true);
        setIsPreviewMode(false); setPreviewData(null); setCurrentFilterType(null);
        setSelectedTransformation(null);
        resetFilterForms();
        await refreshSavedDataset();
        // ── NEW: Refresh filter summary after saving ──
        if (pid) await fetchFilterSummary(pid);
      } else { showToast("error", `Save failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error saving"); }
    finally { setIsSavingFilter(false); }
  };

  const cancelFilterPreview = async () => {
    if (!selectedDataset) return;
    if (currentFilterType === "rename_column" || currentFilterType === "type_cast") {
      try {
        const res = await fetch(purl("/undo-latest/"), { method: "PUT", headers: getHeaders() });
        if (res.ok) showToast("info", "Change cancelled and reverted");
        else showToast("warning", "Could not auto-undo — use Undo button to revert");
      } catch { showToast("warning", "Could not auto-undo — use Undo button"); }
    }
    try {
      const res = await fetch(purl("/view-data/"), { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const json          = await res.json();
        const fullData      = json.data || json.preview || [];
        const columnHeaders = json.columns || [];
        setSelectedDataset({ ...selectedDataset, fullData, columnHeaders, rows: json.rows || fullData.length, columns: columnHeaders.length });
      }
    } catch { }
    setIsPreviewMode(false); setPreviewData(null); setCurrentFilterType(null);
    setSortColumn(null); setSortOrder("asc"); setHasTransformations(false);
    resetFilterForms();
    if (currentFilterType !== "rename_column" && currentFilterType !== "type_cast") {
      showToast("info", "Preview cancelled — showing last saved state");
    }
  };

  // ─────────── SORT ───────────
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder,  setSortOrder]  = useState<"asc" | "desc">("asc");
  const [isSorting,  setIsSorting]  = useState(false);

  const handleColumnSort = async (columnName: string) => {
    if (!selectedDataset) return;
    const newOrder: "asc" | "desc" = sortColumn === columnName ? (sortOrder === "asc" ? "desc" : "asc") : "asc";
    setIsSorting(true); setSortColumn(columnName); setSortOrder(newOrder);
    try {
      let isNumeric = false;
      if (selectedDataset.fullData?.length) {
        for (const row of selectedDataset.fullData) {
          const v = row[columnName];
          if (v !== null && v !== undefined && v !== "") { isNumeric = !isNaN(Number(v)); break; }
        }
      }
      const params = new URLSearchParams({ sort_column: columnName, order: newOrder, numeric: String(isNumeric) });
      const res = await fetch(`${purl("/sort-rows/")}?${params}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const result        = await res.json();
        const sortedData    = result.preview || result.data || [];
        const columnHeaders = result.columns || selectedDataset.columnHeaders || [];
        setSelectedDataset({ ...selectedDataset, fullData: sortedData, rows: result.rows || sortedData.length, columns: columnHeaders.length, columnHeaders });
        showToast("success", `Sorted by "${columnName}" ${newOrder === "asc" ? "↑" : "↓"}`);
        setIsPreviewMode(true); setCurrentFilterType("sort");
        setPreviewData({ rows: result.rows, dropped_rows: 0, columns: columnHeaders, preview: sortedData, filter_type: "SORT", sort_column: columnName, sort_order: newOrder });
      } else { showToast("error", `Sort failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error sorting"); }
    finally { setIsSorting(false); }
  };

  const SortIndicator = memo(({ col }: { col: string }) => {
    if (sortColumn !== col) return <div className="flex flex-col opacity-30"><svg className="w-3 h-3 -mb-1" fill="currentColor" viewBox="0 0 12 12"><path d="M6 3l4 4H2z" /></svg><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12"><path d="M6 9l4-4H2z" /></svg></div>;
    return <div>{sortOrder === "asc" ? <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 12 12"><path d="M6 3l4 4H2z" /></svg> : <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 12 12"><path d="M6 9l4-4H2z" /></svg>}</div>;
  });

  // ─────────── COLUMN FILTER DROPDOWN ───────────
  const [filterDropdownOpen,         setFilterDropdownOpen]         = useState<string | null>(null);
  const [filterDropdownPosition,     setFilterDropdownPosition]     = useState({ top: 0, left: 0 });
  const [columnFilterValues,         setColumnFilterValues]         = useState<any>(null);
  const [isLoadingColumnFilter,      setIsLoadingColumnFilter]      = useState(false);
  const [selectedColumnFilterValues, setSelectedColumnFilterValues] = useState<Set<any>>(new Set());
  const [columnFilterSearchTerm,     setColumnFilterSearchTerm]     = useState("");
  const [isApplyingFilter,           setIsApplyingFilter]           = useState(false);

  useEffect(() => {
    if (!filterDropdownOpen) return;
    const handler = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".fixed")) setFilterDropdownOpen(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterDropdownOpen]);

  const fetchColumnFilterValues = async (col: string, event: React.MouseEvent) => {
    if (!selectedDataset) return;
    const r  = (event.currentTarget as HTMLElement).getBoundingClientRect();
    let top  = r.bottom + 8, left = r.left;
    if (top + 500  > window.innerHeight) top  = Math.max(20, r.top - 500 - 8);
    if (left + 384 > window.innerWidth)  left = window.innerWidth - 384 - 20;
    setFilterDropdownPosition({ top, left });
    setIsLoadingColumnFilter(true); setFilterDropdownOpen(col); setColumnFilterSearchTerm("");
    try {
      const res = await fetch(`${purl("/unique-values/")}?column_name=${encodeURIComponent(col)}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const raw = await res.json();
        const normalized = normalizeUniqueValues(raw);
        setColumnFilterValues(normalized);
        setSelectedColumnFilterValues(new Set(normalized.unique_values));
      } else {
        showToast("error", "Failed to load filter values");
        setFilterDropdownOpen(null);
      }
    } catch { showToast("error", "Network error"); setFilterDropdownOpen(null); }
    finally { setIsLoadingColumnFilter(false); }
  };

  const applyColumnFilter = async () => {
    if (!selectedDataset || !filterDropdownOpen || selectedColumnFilterValues.size === 0) { showToast("warning", "Select at least one value"); return; }
    setIsApplyingFilter(true);
    const vals = Array.from(selectedColumnFilterValues);
    try {
      const params = new URLSearchParams();
      params.append("column_name", filterDropdownOpen);
      vals.forEach(v => params.append("value", String(v)));
      const res = await fetch(`${purl("/select-rows/")}?${params}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        showToast("success", `Filtered "${filterDropdownOpen}" by ${vals.length} value(s)`);
        setCurrentFilterType("filter_by_values");
        setFilterDropdownOpen(null); setColumnFilterValues(null);
        await fetchFilterPreview();
      } else { showToast("error", `Filter failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error filtering"); }
    finally { setIsApplyingFilter(false); }
  };

  const getFilteredColVals = () => {
    if (!columnFilterValues) return [];
    if (!columnFilterSearchTerm) return columnFilterValues.unique_values;
    return columnFilterValues.unique_values.filter((v: any) => String(v).toLowerCase().includes(columnFilterSearchTerm.toLowerCase()));
  };

  const normalizeUniqueValues = (raw: any) => ({
    unique_values:       raw.unique_values ?? raw.values ?? raw.data ?? (Array.isArray(raw) ? raw : []),
    unique_values_count: raw.unique_values_count ?? raw.count ?? 0,
    total_rows:          raw.total_rows  ?? raw.total ?? 0,
    null_rows:           raw.null_rows   ?? raw.null_count ?? 0,
    value_counts:        raw.value_counts ?? raw.counts ?? {},
  });

  // ─────────── RENAME COLUMN ───────────
  const [renameOldColumn,  setRenameOldColumn]  = useState("");
  const [renameNewColumn,  setRenameNewColumn]  = useState("");
  const [isRenamingColumn, setIsRenamingColumn] = useState(false);

  const handleRenameColumn = async () => {
    if (!selectedDataset || !renameOldColumn || !renameNewColumn) { showToast("warning", "Select column and enter new name"); return; }
    if (renameOldColumn === renameNewColumn) { showToast("warning", "New name must differ"); return; }
    setIsRenamingColumn(true);
    try {
      const params = new URLSearchParams({ old_column: renameOldColumn, new_column: renameNewColumn });
      const res = await fetch(`${purl("/rename-column/")}?${params}`, { method: "PUT", headers: getHeaders() });
      if (res.ok) {
        const viewRes = await fetch(purl("/view-data/"), { method: "GET", headers: getHeaders() });
        if (viewRes.ok) {
          const json = await viewRes.json();
          const fullData = json.data || json.preview || [];
          const columnHeaders = json.columns || [];
          setSelectedDataset({ ...selectedDataset, fullData, rows: json.rows || fullData.length, columns: columnHeaders.length, columnHeaders });
          // ── Store old/new for table highlight ──
          setPreviewData({
            rows: json.rows,
            dropped_rows: 0,
            columns: columnHeaders,
            preview: fullData,
            filter_type: "RENAME_COLUMN",
            old_column: renameOldColumn,
            new_column: renameNewColumn
          });
          setIsPreviewMode(true); setCurrentFilterType("rename_column"); setHasTransformations(true);
          setSelectedTransformation(null); setRenameOldColumn(""); setRenameNewColumn("");
          showToast("success", `Preview: '${renameOldColumn}' → '${renameNewColumn}'. Click Save to confirm.`);
        }
      } else { showToast("error", `Rename failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error renaming"); }
    finally { setIsRenamingColumn(false); }
  };

  // ─────────── TYPE CAST ───────────
  const [typeCastColumn,  setTypeCastColumn]  = useState("");
  const [typeCastNewType, setTypeCastNewType] = useState("");
  const [isTypeCasting,   setIsTypeCasting]   = useState(false);

  const handleTypeCast = async () => {
    if (!selectedDataset || !typeCastColumn || !typeCastNewType) { showToast("warning", "Select column and type"); return; }
    setIsTypeCasting(true);
    try {
      const params = new URLSearchParams({ column_name: typeCastColumn, new_type: typeCastNewType });
      const res = await fetch(`${purl("/type-cast/")}?${params}`, { method: "PUT", headers: getHeaders() });
      if (res.ok) {
        const viewRes = await fetch(purl("/view-data/"), { method: "GET", headers: getHeaders() });
        if (viewRes.ok) {
          const json = await viewRes.json();
          const fullData = json.data || json.preview || [];
          const cols     = json.columns || [];
          setSelectedDataset({ ...selectedDataset, fullData, rows: json.rows || fullData.length, columns: cols.length, columnHeaders: cols });
          setPreviewData({ rows: json.rows, dropped_rows: 0, columns: cols, preview: fullData, filter_type: "TYPE_CAST", cast_column: typeCastColumn, cast_type: typeCastNewType });
          setIsPreviewMode(true); setCurrentFilterType("type_cast"); setHasTransformations(true);
        }
        setSelectedTransformation(null); setTypeCastColumn(""); setTypeCastNewType("");
        showToast("success", `Preview: '${typeCastColumn}' → ${typeCastNewType}. Click Save to confirm.`);
      } else { showToast("error", `Type cast failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error type casting"); }
    finally { setIsTypeCasting(false); }
  };

  // ─────────── GROUP & AGGREGATE ───────────
  const [groupByColumns,        setGroupByColumns]        = useState<string[]>([]);
  const [aggregateColumn,       setAggregateColumn]       = useState("");
  const [aggregateFunction,     setAggregateFunction]     = useState("");
  const [isGroupingAggregating, setIsGroupingAggregating] = useState(false);

  const handleGroupAndAggregate = async () => {
    if (!selectedDataset || !groupByColumns.length || !aggregateColumn || !aggregateFunction) { showToast("warning", "Fill all group & aggregate fields"); return; }
    setIsGroupingAggregating(true);
    try {
      const params = new URLSearchParams({ aggregate_column: aggregateColumn, agg_func: aggregateFunction });
      groupByColumns.forEach(c => params.append("group_by", c));
      const res = await fetch(`${purl("/group-and-aggregate/")}?${params}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const data          = await res.json();
        const filteredData  = data.preview || data.data || [];
        const columnHeaders = data.columns || selectedDataset.columnHeaders || [];
        setPreviewData(data); setIsPreviewMode(true);
        setSelectedDataset({ ...selectedDataset, fullData: filteredData, rows: data.rows || filteredData.length, columns: columnHeaders.length, columnHeaders });
        setCurrentFilterType("group_and_aggregate"); setSelectedTransformation(null);
        showToast("success", `Grouped by ${groupByColumns.join(", ")} — ${data.rows || filteredData.length} rows`);
      } else { showToast("error", `Group failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error grouping"); }
    finally { setIsGroupingAggregating(false); }
  };

  // ─────────── FILTER BY DATE ───────────
  const [dateColumn,           setDateColumn]           = useState("");
  const [availableYears,       setAvailableYears]       = useState<number[]>([]);
  const [availableMonths,      setAvailableMonths]      = useState<Record<string, Record<string, number[]>>>({});
  const [availableDays,        setAvailableDays]        = useState<number[]>([]);
  const [selectedYears,        setSelectedYears]        = useState<number[]>([]);
  const [selectedMonths,       setSelectedMonths]       = useState<number[]>([]);
  const [selectedDays,         setSelectedDays]         = useState<number[]>([]);
  const [isLoadingDateSummary, setIsLoadingDateSummary] = useState(false);
  const [isFilteringByDate,    setIsFilteringByDate]    = useState(false);
  const [dateSummaryLoaded,    setDateSummaryLoaded]    = useState(false);

  const fetchDateSummary = async () => {
    if (!selectedDataset || !dateColumn) { showToast("warning", "Select a date column"); return; }
    setIsLoadingDateSummary(true);
    try {
      const res = await fetch(`${purl("/filter-by-date/")}?date_column=${encodeURIComponent(dateColumn)}&flat_list=false`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const result  = await res.json();
        const summary = result.unique_dates_summary || {};
        const years   = Object.keys(summary).map(Number).sort((a, b) => b - a);
        setAvailableYears(years);
        setAvailableMonths(summary);
        // ── Extract all unique days from the summary ──
        const daySet = new Set<number>();
        Object.values(summary).forEach((monthMap: any) => {
          Object.values(monthMap).forEach((days: any) => {
            if (Array.isArray(days)) days.forEach((d: number) => daySet.add(d));
          });
        });
        const sortedDays = daySet.size > 0
          ? Array.from(daySet).sort((a, b) => a - b)
          : Array.from({ length: 31 }, (_, i) => i + 1);
        setAvailableDays(sortedDays);
        setDateSummaryLoaded(true);
        showToast("success", `Found data from ${years.length} year(s)`);
      } else { showToast("error", `Date summary failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error loading dates"); }
    finally { setIsLoadingDateSummary(false); }
  };

  const handleFilterByDate = async () => {
    if (!selectedDataset || !dateColumn) { showToast("warning", "Select a date column"); return; }
    if (!selectedYears.length && !selectedMonths.length && !selectedDays.length) { showToast("warning", "Select at least one filter"); return; }
    setIsFilteringByDate(true);
    try {
      const params = new URLSearchParams({ date_column: dateColumn, flat_list: "false" });
      selectedYears.forEach(y => params.append("years", y.toString()));
      selectedMonths.forEach(m => params.append("months", m.toString()));
      selectedDays.forEach(d => params.append("days", d.toString()));
      const res = await fetch(`${purl("/filter-by-date/")}?${params}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const data          = await res.json();
        const filteredData  = data.preview || data.data || [];
        const columnHeaders = data.columns || selectedDataset.columnHeaders || [];
        setPreviewData(data); setIsPreviewMode(true);
        setSelectedDataset({ ...selectedDataset, fullData: filteredData, rows: data.rows || filteredData.length, columns: columnHeaders.length, columnHeaders });
        setCurrentFilterType("filter_by_date"); setSelectedTransformation(null);
        showToast("success", `Date filter applied — ${data.rows || filteredData.length} rows`);
      } else { showToast("error", `Date filter failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error filtering by date"); }
    finally { setIsFilteringByDate(false); }
  };

  // ─────────── FILTER BY VALUES ───────────
  const [filterColumn,          setFilterColumn]          = useState("");
  const [uniqueValuesData,      setUniqueValuesData]      = useState<any>(null);
  const [selectedFilterValues,  setSelectedFilterValues]  = useState<Set<any>>(new Set());
  const [isLoadingUniqueValues, setIsLoadingUniqueValues] = useState(false);
  const [uniqueValuesLoaded,    setUniqueValuesLoaded]    = useState(false);
  const [uniqueValuesSearch,    setUniqueValuesSearch]    = useState("");

  useEffect(() => {
    if (filterColumn && selectedTransformation === "filter_by_values") {
      setUniqueValuesLoaded(false); setUniqueValuesData(null);
      setSelectedFilterValues(new Set()); setUniqueValuesSearch("");
    }
  }, [filterColumn]);

  const fetchUniqueValues = async () => {
    if (!selectedDataset || !filterColumn) { showToast("warning", "Select a column first"); return; }
    setIsLoadingUniqueValues(true);
    try {
      const res = await fetch(`${purl("/unique-values/")}?column_name=${encodeURIComponent(filterColumn)}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const raw        = await res.json();
        const normalized = normalizeUniqueValues(raw);
        if (normalized.unique_values.length === 0 && Array.isArray(raw)) {
          normalized.unique_values = raw; normalized.unique_values_count = raw.length;
        }
        setUniqueValuesData(normalized);
        setUniqueValuesLoaded(true);
        setSelectedFilterValues(new Set(normalized.unique_values));
        showToast("success", `Found ${normalized.unique_values_count || normalized.unique_values.length} unique values in '${filterColumn}'`);
      } else { showToast("error", `Failed to load unique values: ${await res.text()}`); }
    } catch { showToast("error", "Network error loading unique values"); }
    finally { setIsLoadingUniqueValues(false); }
  };

  const handleFilterByUniqueValues = async () => {
    if (!selectedDataset || !filterColumn || !selectedFilterValues.size) { showToast("warning", "Select values to filter by"); return; }
    setIsApplyingFilter(true);
    const vals = Array.from(selectedFilterValues);
    try {
      const params = new URLSearchParams({ column_name: filterColumn });
    params.append("value", vals.join(","));
      const res = await fetch(`${purl("/select-rows/")}?${params}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const data          = await res.json();
        const filteredData  = data.preview ?? data.data ?? data.rows_data ?? [];
        const columnHeaders = data.columns ?? selectedDataset.columnHeaders ?? [];
        const rowCount      = data.rows ?? data.row_count ?? filteredData.length;
        const droppedRows   = data.dropped_rows ?? data.filtered_count ?? 0;
        setSelectedDataset({ ...selectedDataset, fullData: filteredData, rows: rowCount, columns: columnHeaders.length, columnHeaders });
        setPreviewData({ ...data, rows: rowCount, dropped_rows: droppedRows, columns: columnHeaders, preview: filteredData });
        setIsPreviewMode(true); setCurrentFilterType("filter_by_values"); setSelectedTransformation(null);
        showToast("success", `Filtered "${filterColumn}" by ${vals.length} value(s) — ${rowCount} rows remaining`);
      } else { showToast("error", `Filter failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error applying filter"); }
    finally { setIsApplyingFilter(false); }
  };

  // ─────────── TEXT FILTER ───────────
  const [textFilterColumn,     setTextFilterColumn]     = useState("");
  const [textFilterType,       setTextFilterType]       = useState("equals");
  const [textFilterValue,      setTextFilterValue]      = useState("");
  const [textFilterValue2,     setTextFilterValue2]     = useState("");
  const [textFilterValues,     setTextFilterValues]     = useState<string[]>([]);
  const [isApplyingTextFilter, setIsApplyingTextFilter] = useState(false);

  const handleTextFilter = async () => {
    if (!selectedDataset || !textFilterColumn) { showToast("warning", "Select a column"); return; }
    setIsApplyingTextFilter(true);
    try {
      const params = new URLSearchParams({ column: textFilterColumn, filter_type: textFilterType });
      if (["equals","contains","starts_with","ends_with","not_equals"].includes(textFilterType)) params.append("value", textFilterValue);
      else if (textFilterType === "between") { params.append("value", textFilterValue); params.append("value2", textFilterValue2); }
      else if (textFilterType === "in") textFilterValues.forEach(v => params.append("values", v));
      const res = await fetch(`${purl("/text-filter/")}?${params}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const data          = await res.json();
        const filteredData  = data.preview || data.data || [];
        const columnHeaders = data.columns || selectedDataset.columnHeaders || [];
        setPreviewData(data); setIsPreviewMode(true);
        setSelectedDataset({ ...selectedDataset, fullData: filteredData, rows: data.rows || filteredData.length, columns: columnHeaders.length, columnHeaders });
        setCurrentFilterType("text_filter"); setSelectedTransformation(null);
        showToast("success", `Text filter applied — ${data.rows || filteredData.length} rows`);
      } else { showToast("error", `Text filter failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error"); }
    finally { setIsApplyingTextFilter(false); }
  };

  // ─────────── NUMBER FILTER ───────────
  const [numberFilterColumn,     setNumberFilterColumn]     = useState("");
  const [numberFilterType,       setNumberFilterType]       = useState("equals");
  const [numberFilterValue,      setNumberFilterValue]      = useState("");
  const [numberFilterValue2,     setNumberFilterValue2]     = useState("");
  const [numberFilterValues,     setNumberFilterValues]     = useState<string[]>([]);
  const [isApplyingNumberFilter, setIsApplyingNumberFilter] = useState(false);

  const handleNumberFilter = async () => {
    if (!selectedDataset || !numberFilterColumn) { showToast("warning", "Select a column"); return; }
    setIsApplyingNumberFilter(true);
    try {
      const params = new URLSearchParams({ column: numberFilterColumn, filter_type: numberFilterType });
      if (["equals","not_equals","greater_than","less_than","greater_than_or_equal","less_than_or_equal"].includes(numberFilterType)) params.append("value", numberFilterValue);
      else if (numberFilterType === "between") { params.append("value", numberFilterValue); params.append("value2", numberFilterValue2); }
      else if (numberFilterType === "in") numberFilterValues.forEach(v => params.append("values", v));
      const res = await fetch(`${purl("/number-filter/")}?${params}`, { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const data          = await res.json();
        const filteredData  = data.preview || data.data || [];
        const columnHeaders = data.columns || selectedDataset.columnHeaders || [];
        setPreviewData(data); setIsPreviewMode(true);
        setSelectedDataset({ ...selectedDataset, fullData: filteredData, rows: data.rows || filteredData.length, columns: columnHeaders.length, columnHeaders });
        setCurrentFilterType("number_filter"); setSelectedTransformation(null);
        showToast("success", `Number filter applied — ${data.rows || filteredData.length} rows`);
      } else { showToast("error", `Number filter failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error"); }
    finally { setIsApplyingNumberFilter(false); }
  };

  // ─────────── UNDO / RESET / HISTORY ───────────
  const [isUndoing,        setIsUndoing]        = useState(false);
  const [isResetting,      setIsResetting]      = useState(false);
  const [showResetModal,   setShowResetModal]   = useState(false);
  const [historyData,      setHistoryData]      = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    if (!selectedDataset) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(purl("/history/"), { method: "GET", headers: getHeaders() });
      if (res.ok) {
        const result  = await res.json();
        const history = result.history || [];
        setHistoryData(history); setHasTransformations(history.length > 0);
        history.length === 0 ? showToast("info", "No history found") : showToast("success", `${history.length} transformation(s) found`);
      } else { showToast("error", `History failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error loading history"); }
    finally { setIsLoadingHistory(false); }
  };

  const handleUndo = async () => {
    if (!selectedDataset) return;
    setIsUndoing(true);
    try {
      const res = await fetch(purl("/undo-latest/"), { method: "PUT", headers: getHeaders() });
      if (res.ok) {
        const result = await res.json();
        showToast("success", result.message || "Undone successfully");
        await refreshCurrentDataset();
        if (selectedTransformation === "get_history") await fetchHistory();
        // ── NEW: Refresh filter summary after undo ──
        if (pid) await fetchFilterSummary(pid);
      } else if (res.status === 404) { showToast("info", "Nothing to undo"); }
      else { showToast("error", `Undo failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error undoing"); }
    finally { setIsUndoing(false); }
  };

  const handleReset = async () => {
    if (!selectedDataset) return;
    setIsResetting(true);
    try {
      const res = await fetch(purl("/reset-to-original/"), { method: "PUT", headers: getHeaders() });
      if (res.ok) {
        showToast("success", "Reset to original successfully");
        setHasTransformations(false);
        await refreshCurrentDataset();
        setShowResetModal(false);
        if (selectedTransformation === "get_history") await fetchHistory();
        // ── NEW: Refresh filter summary after reset ──
        if (pid) await fetchFilterSummary(pid);
      } else { showToast("error", `Reset failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error resetting"); }
    finally { setIsResetting(false); }
  };

  // ─────────── FINALIZE ───────────
  const [showSaveAsModal,   setShowSaveAsModal]   = useState(false);
  const [saveAsVersionNote, setSaveAsVersionNote] = useState("");
  const [isSavingAs,        setIsSavingAs]        = useState(false);

  const openSaveAsModal = () => {
    if (!selectedDataset) return;
    setSaveAsVersionNote(`${selectedDataset.name} filtered data`);
    setShowSaveAsModal(true);
  };

  const handleSaveAs = async () => {
    if (!selectedDataset || !saveAsVersionNote.trim()) { showToast("warning", "Enter a version note"); return; }
    setIsSavingAs(true);
    try {
      const res = await fetch(purl("/finalize"), {
        method: "POST", headers: getHeaders(true),
        body: JSON.stringify({ version_note: saveAsVersionNote.trim() })
      });
      if (res.ok) {
        const result      = await res.json();
        const versionName = result.version_name || saveAsVersionNote.trim();
        const versionNum  = result.version ?? 1;
        if (pid) {
          setParamVersions(prev => ({ ...prev, [pid]: { version: versionNum, version_name: versionName } }));
          // ── NEW: Refresh filter summary after finalize ──
          await fetchFilterSummary(pid);
        }
        showToast("success", `Finalized & saved as "${versionName}" ✅`);
        setShowSaveAsModal(false); setSaveAsVersionNote("");
        setIsPreviewMode(false); setPreviewData(null); setCurrentFilterType(null);
        setSelectedTransformation(null); resetFilterForms();
        await fetchParameterSettings();
      } else { showToast("error", `Finalize failed: ${await res.text()}`); }
    } catch { showToast("error", "Network error finalizing"); }
    finally { setIsSavingAs(false); }
  };

  // ─────────── RESET FORMS ───────────
  const resetFilterForms = () => {
    setGroupByColumns([]); setAggregateColumn(""); setAggregateFunction("");
    setDateColumn(""); setSelectedYears([]); setSelectedMonths([]); setSelectedDays([]);
    setDateSummaryLoaded(false); setFilterColumn(""); setSelectedFilterValues(new Set());
    setUniqueValuesLoaded(false); setUniqueValuesData(null); setUniqueValuesSearch("");
    setTextFilterColumn(""); setTextFilterType("equals"); setTextFilterValue(""); setTextFilterValue2(""); setTextFilterValues([]);
    setNumberFilterColumn(""); setNumberFilterType("equals"); setNumberFilterValue(""); setNumberFilterValue2(""); setNumberFilterValues([]);
  };

  // ─────────── COLUMN HEADERS MEMO ───────────
  const columnHeaders = useMemo(() => {
    if (!selectedDataset) return [];
    if (selectedDataset.columnHeaders?.length) return selectedDataset.columnHeaders;
    if (!selectedDataset.fullData?.length) return Array.from({ length: selectedDataset.columns }, (_, i) => `Column ${i + 1}`);
    if (Array.isArray(selectedDataset.fullData[0])) return selectedDataset.fullData[0].map((_: any, i: number) => `Column ${i + 1}`);
    return Object.keys(selectedDataset.fullData[0]);
  }, [selectedDataset]);

  // ─────────── VIRTUAL SCROLL ───────────
  const ROW_HEIGHT = 36, OVERSCAN = 8;
  const tableScrollRef  = useRef<HTMLDivElement>(null);
  const hScrollBarRef   = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [tableScrollTop,    setTableScrollTop]    = useState(0);
  const [tableClientHeight, setTableClientHeight] = useState(600);
  const [tableScrollWidth,  setTableScrollWidth]  = useState(0);

  useEffect(() => { if (tableScrollRef.current) setTableScrollWidth(tableScrollRef.current.scrollWidth); }, [selectedDataset?.fullData, columnHeaders]);

  const { virtualStart, virtualEnd, paddingTop, paddingBottom } = useMemo(() => {
    if (!selectedDataset?.fullData) return { virtualStart: 0, virtualEnd: 0, paddingTop: 0, paddingBottom: 0 };
    const total   = selectedDataset.fullData.length;
    const visible = Math.ceil(tableClientHeight / ROW_HEIGHT);
    const start   = Math.max(0, Math.floor(tableScrollTop / ROW_HEIGHT) - OVERSCAN);
    const end     = Math.min(total, start + visible + OVERSCAN * 2);
    return { virtualStart: start, virtualEnd: end, paddingTop: start * ROW_HEIGHT, paddingBottom: Math.max(0, (total - end) * ROW_HEIGHT) };
  }, [tableScrollTop, tableClientHeight, selectedDataset?.fullData?.length]);

  const handleTableScrollWithSync = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setTableScrollTop(e.currentTarget.scrollTop);
    setTableClientHeight(e.currentTarget.clientHeight);
    if (!isSyncingScroll.current && hScrollBarRef.current) {
      isSyncingScroll.current = true;
      hScrollBarRef.current.scrollLeft = e.currentTarget.scrollLeft;
      isSyncingScroll.current = false;
    }
  }, []);

  const handleHScrollBarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!isSyncingScroll.current && tableScrollRef.current) {
      isSyncingScroll.current = true;
      tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
      isSyncingScroll.current = false;
    }
  }, []);

  // ─────────── HELPERS ───────────
  const toastColor = (t: string) => ({ success: "bg-green-500", error: "bg-red-500", warning: "bg-yellow-500", info: "bg-blue-500" }[t] || "bg-gray-500");
  const toastIcon  = (t: string) => t === "success" ? <Check className="h-5 w-5" /> : t === "error" ? <X className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />;

  // ── Helper: get icon for filter type ──
  const getFilterIcon = (filterType: string) => {
    const icons: Record<string, string> = {
      rename_column: "✏️", type_cast: "🔄", group_and_aggregate: "📊",
      filter_by_date: "📅", select_rows: "🔍", filter_by_values: "🎯",
      text_filter: "🔤", number_filter: "#️⃣", sort: "↕️"
    };
    return icons[filterType] || "⚙️";
  };

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div>
      {/* TOASTS */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
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
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Manage Parameter Settings</h1>
              <p className="text-xs text-gray-500">Configure data source parameters and transformations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchParameterSettings} disabled={loadingSettings}
              className="px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg flex items-center gap-1.5 hover:border-violet-400 hover:bg-violet-50 transition-all disabled:opacity-50 text-sm font-medium">
              <RefreshCw className={`h-4 w-4 ${loadingSettings ? "animate-spin text-violet-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={openCreateModal}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg flex items-center gap-2 shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium text-sm">
              <Plus className="h-4 w-4" />
              <span>Create</span>
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingSettings ? (
            <div className="flex flex-col justify-center items-center h-48">
              <Loader2 className="h-10 w-10 animate-spin text-violet-600 mb-3" />
              <span className="text-gray-500 text-sm">Loading parameter settings...</span>
            </div>
          ) : filteredSettings.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-48">
              <Settings2 className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium text-sm">
                {parameterSettings.length === 0
                  ? (!props.dataSources || props.dataSources.length === 0) ? "No active data sources found." : 'Click "+ Create" to add a new parameter setting'
                  : "No results match your filter"}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSettings.map((ps, idx) => {
                  const isToggling     = togglingIds.has(ps.id);
                  const isLoadingCard  = loadingCardIds.has(ps.id);
                  const isLoadingVer   = loadingVersionIds.has(ps.id);
                  const filterEnabled  = ps.is_filter_enabled ?? false;
                  const versionInfo    = paramVersions[ps.id];
                  const isDropdownOpen = openVersionDropdowns.has(ps.id);
                  // ── NEW: Check if this param's data has been loaded ──
                  const isLoaded       = loadedParamIds.has(ps.id);

                  return (
                    <React.Fragment key={ps.id}>
                      {/* MAIN ROW */}
                      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-medium text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-800">{ps.name}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                          {ps.description || <span className="italic text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                            <Database className="h-3 w-3" />
                            {ps.data_source?.source_name || `ID: ${ps.data_source_id}`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {ps.is_active !== undefined ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ps.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${ps.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                              {ps.is_active ? "Active" : "Inactive"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={e => handleToggleFilter(ps, e)}
                            disabled={isToggling}
                            title={filterEnabled ? "Data Filter Enabled — click to disable" : "Data Filter Disabled — click to enable"}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${
                              filterEnabled
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}>
                            {isToggling
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : filterEnabled
                                ? <ToggleRight className="h-3.5 w-3.5" />
                                : <ToggleLeft className="h-3.5 w-3.5" />
                            }
                            {filterEnabled ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* ── MODIFIED: Load Data button — disabled after loaded ── */}
                            <button
                              onClick={e => handleCardInfoClick(ps, e)}
                              disabled={isLoadingCard || isLoaded}
                              title={isLoaded ? "Data already loaded" : "Load & Apply Filter"}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                isLoaded
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-300"
                                  : "text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 border-gray-200 hover:border-emerald-300"
                              }`}>
                              {isLoadingCard
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                                : isLoaded
                                  ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  : <Filter className="h-3.5 w-3.5" />
                              }
                              <span>{isLoadingCard ? "Loading..." : isLoaded ? "Loaded" : "Load Data"}</span>
                            </button>
                            {/* View Dataset */}
                            <button
                              onClick={() => openViewer(ps)}
                              title="View Dataset"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-all">
                              <Eye className="h-4 w-4" />
                            </button>
                            {/* Filtered version dropdown trigger */}
                            {versionInfo && (
                              <button
                                onClick={() => toggleVersionDropdown(ps.id)}
                                title="View Filtered Version"
                                className={`p-1.5 rounded-lg transition-all flex items-center gap-0.5 ${
                                  isDropdownOpen
                                    ? "text-emerald-600 bg-emerald-50"
                                    : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                                }`}>
                                {isDropdownOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            )}
                            {/* Delete */}
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteTarget(ps); }}
                              title="Delete"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ────── FILTERED VERSION DROPDOWN ROW ────── */}
                      {versionInfo && isDropdownOpen && (
                        <tr className="border-b border-emerald-100 bg-emerald-50/60">
                          <td colSpan={7} className="px-6 py-0">
                            <div className="py-3">
                              <div className="flex items-stretch gap-4">
                                {/* Left accent bar */}
                                <div className="w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500 flex-shrink-0" />

                                {/* Content */}
                                <div className="flex-1">
                                  {/* Top row: version stats */}
                                  <div className="flex flex-wrap items-center gap-4 mb-3">
                                    {/* Label */}
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <SaveAll className="h-3.5 w-3.5 text-white" />
                                      </div>
                                      <div>
                                        <p className="text-xs text-emerald-600 font-semibold">Filtered Version</p>
                                        <p className="text-sm font-bold text-emerald-800 leading-tight">{versionInfo.version_name}</p>
                                      </div>
                                    </div>

                                    {/* Version badge */}
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded-full text-xs font-bold">
                                      <Check className="h-3 w-3" /> v{versionInfo.version}
                                    </span>

                                    <div className="w-px h-8 bg-emerald-200 hidden sm:block" />

                                    {/* Row counts */}
                                    <div className="text-center">
                                      <p className="text-xs text-emerald-500 font-medium">Original Rows</p>
                                      <p className="text-sm font-bold text-emerald-900">
                                        {versionInfo.row_count_original != null ? versionInfo.row_count_original.toLocaleString() : "—"}
                                      </p>
                                    </div>
                                    <svg className="h-4 w-4 text-emerald-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                    <div className="text-center">
                                      <p className="text-xs text-emerald-500 font-medium">Filtered Rows</p>
                                      <p className="text-sm font-bold text-emerald-900">
                                        {versionInfo.row_count_filtered != null ? versionInfo.row_count_filtered.toLocaleString() : "—"}
                                      </p>
                                    </div>

                                    {/* Progress bar */}
                                    {versionInfo.row_count_original != null && versionInfo.row_count_filtered != null && versionInfo.row_count_original > 0 && (
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <div className="flex-1 bg-emerald-200 rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                            style={{ width: `${Math.min(100, (versionInfo.row_count_filtered! / versionInfo.row_count_original!) * 100).toFixed(1)}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">
                                          {((versionInfo.row_count_filtered! / versionInfo.row_count_original!) * 100).toFixed(1)}% kept
                                        </span>
                                      </div>
                                    )}

                                    <div className="flex-1" />

                                    {/* View button */}
                                    <button
                                      onClick={() => openFilteredVersionViewer(ps, versionInfo)}
                                      disabled={isLoadingVer}
                                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm disabled:opacity-60 whitespace-nowrap">
                                      {isLoadingVer
                                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Loading...</span></>
                                        : <><Eye className="h-3.5 w-3.5" /><span>View Filtered Dataset</span></>
                                      }
                                    </button>
                                  </div>

                                  {/* ── NEW: Filter Summary Section ── */}
                                  
{(() => {
  const steps = filterSummaries[Number(ps.id)] || [];
  return (
    <div className="pt-3 border-t border-emerald-200">
      <div className="flex items-center gap-2 mb-2">
        <Filter className="h-3.5 w-3.5 text-emerald-600" />
        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
          {steps.length > 0
            ? `Applied Filters — ${steps.length} step${steps.length > 1 ? "s" : ""}`
            : "Filter Steps"}
            
        </p>
   {(() => {
  const summaries =
    filterSummaries?.[selectedDataset?.param_id || 0] || [];

  return summaries.length > 0 ? (
    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      
      <div className="flex items-center gap-2 mb-2">
        <Filter className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">
          Filter Summary
        </h3>
      </div>

      <div className="space-y-2">
        {summaries.map((item: any, idx: number) => (
          <div
            key={idx}
            className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800"
          >
            {item.note}
          </div>
        ))}
      </div>

    </div>
  ) : (
    <p className="text-sm text-gray-500 mt-2">
      No filter steps recorded yet
    </p>
  );
})()}
      </div>

      {steps.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {steps.map((f, i) => (
            <div key={i}
              className="bg-white rounded-xl border border-emerald-200 p-3 shadow-sm hover:shadow-md transition-shadow flex items-start gap-2.5">
              {/* Step number circle */}
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                {/* Filter type badge */}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-semibold uppercase tracking-wide mb-1">
                  {getFilterIcon(f.filter_type)} {f.filter_type.replace(/_/g, " ")}
                </span>
                {/* Note */}
                <p className="text-xs text-gray-700 font-medium leading-snug truncate" title={f.note}>
                  {f.note || "—"}
                </p>
                {/* Params preview */}
                {f.params && Object.keys(f.params).length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {Object.entries(f.params)
                      .filter(([, v]) => v !== null && v !== undefined)
                      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.slice(0, 3).join(", ") + (v.length > 3 ? "…" : "") : String(v)}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-emerald-400 italic">No filter steps recorded yet</p>
      )}
    </div>
  );
})()}
                                  {/* {filterSummaries[ps.id] && filterSummaries[ps.id].length > 0 && (
                                    <div className="pt-3 border-t border-emerald-200">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Filter className="h-3.5 w-3.5 text-emerald-600" />
                                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                                          Applied Filters ({filterSummaries[ps.id].length} step{filterSummaries[ps.id].length > 1 ? "s" : ""})
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {filterSummaries[ps.id].map((f, i) => (
                                          <div
                                            key={i}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs shadow-sm hover:shadow-md transition-shadow"
                                            title={f.note}
                                          >
                                           
                                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                              {i + 1}
                                            </span>
                                          
                                            <span className="text-sm leading-none">{getFilterIcon(f.filter_type)}</span>
                                          
                                            <span className="text-gray-700 font-medium max-w-[200px] truncate">
                                              {f.note || f.filter_type.replace(/_/g, " ")}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                 
                                  {(!filterSummaries[ps.id] || filterSummaries[ps.id].length === 0) && (
                                    <div className="pt-3 border-t border-emerald-200">
                                      <p className="text-xs text-emerald-500 italic">No filter steps recorded yet</p>
                                    </div>
                                  )} */}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg"><Settings2 className="h-6 w-6 text-white" /></div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create Parameter Setting</h3>
                  <p className="text-blue-200 text-sm">Configure a new data source parameter</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-white/70 hover:text-white p-1"><X className="h-6 w-6" /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data Source <span className="text-red-500">*</span></label>
                {(loadingDS && (!props.dataSources || props.dataSources.length === 0)) ? (
                  <div className="flex items-center gap-2 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading...</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={createForm.data_source_id}
                      onChange={e => {
                        const selectedId = e.target.value;
                        const selectedDS = dataSources.find(ds => String(ds.id) === selectedId);
                        setCreateForm(prev => ({ ...prev, data_source_id: selectedId, name: selectedDS?.source_name || (selectedDS as any)?.name || "" }));
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 appearance-none pr-10">
                      <option value="">-- Select a data source --</option>
                      {dataSources.map(ds => (
                        <option key={ds.id} value={ds.id}>
                      {ds.source_name || (ds as any).name} 
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name <span className="text-red-500">*</span></label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Sales Data Filters"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional..." rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} disabled={isCreating}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50">Cancel</button>
              <button onClick={handleCreate} disabled={isCreating || !createForm.name.trim() || !createForm.data_source_id}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium flex items-center gap-2 disabled:opacity-50 shadow-sm">
                {isCreating ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Creating...</span></> : <><Plus className="h-4 w-4" /><span>Create</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-gray-700">Delete <strong className="text-red-800">"{deleteTarget.name}"</strong>?</p>
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

      {/* RESET MODAL */}
      {showResetModal && selectedDataset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Reset</h3>
              <button onClick={() => setShowResetModal(false)} disabled={isResetting} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 flex items-start gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-gray-700">Reset <strong className="text-orange-800">{selectedDataset.name}</strong> to original state?</p>
                <p className="text-sm text-gray-500 mt-1">All transformations will be removed. This cannot be undone.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowResetModal(false)} disabled={isResetting} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button onClick={handleReset} disabled={isResetting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50">
                {isResetting ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Resetting...</span></> : <><RefreshCw className="h-4 w-4" /><span>Reset</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINALIZE MODAL */}
      {showSaveAsModal && selectedDataset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg"><SaveAll className="h-5 w-5 text-white" /></div>
                <div><h3 className="text-lg font-bold text-white">Finalize Dataset</h3><p className="text-emerald-100 text-sm">Save filtered data to permanent storage</p></div>
              </div>
              <button onClick={() => setShowSaveAsModal(false)} disabled={isSavingAs} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {previewData && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center gap-3 text-xs text-gray-600">
                  <span>✅ <strong>{previewData.rows?.toLocaleString()}</strong> rows will be saved</span>
                  <span>🗑 <strong>{previewData.dropped_rows?.toLocaleString()}</strong> filtered out</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Version Note <span className="text-red-500">*</span></label>
                <input type="text" value={saveAsVersionNote} onChange={e => setSaveAsVersionNote(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && saveAsVersionNote.trim()) handleSaveAs(); }}
                  placeholder="e.g. Q1 2024 filtered data" autoFocus disabled={isSavingAs}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                <BookMarked className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800">Finalized data is saved as a versioned snapshot. The original parameter setting remains unchanged.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowSaveAsModal(false)} disabled={isSavingAs} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50">Cancel</button>
              <button onClick={handleSaveAs} disabled={isSavingAs || !saveAsVersionNote.trim()} className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 font-medium">
                {isSavingAs ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Finalizing...</span></> : <><SaveAll className="h-4 w-4" /><span>Finalize &amp; Save</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN DATASET VIEWER */}
      {isViewerOpen && selectedDataset && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b-2 border-gray-200 bg-gradient-to-r from-violet-50 to-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <Settings2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{selectedDataset.name}</h3>
                {selectedDataset.description && <p className="text-xs text-gray-500">{selectedDataset.description}</p>}
              </div>
              <button onClick={toggleEditPanel}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all duration-200 ${isEditPanelOpen ? "bg-violet-600 text-white shadow-md" : "bg-white text-violet-600 border-2 border-violet-600 hover:bg-violet-50"}`}>
                <Edit3 className="h-4 w-4" />
                <span>{isEditPanelOpen ? "Close Edit" : "Edit Dataset"}</span>
              </button>
            </div>
            <button onClick={closeViewer} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all group">
              <X className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Left edit panel */}
            <div className={`bg-gray-50 border-r-2 border-gray-200 transition-all duration-300 flex-shrink-0 ${isEditPanelOpen ? "w-52" : "w-0"} overflow-hidden`}>
              {isEditPanelOpen && (
                <div className="h-full flex flex-col w-52">
                  <div className="flex items-center justify-between px-3 py-2 bg-white border-b-2 border-gray-200">
                    <div className="flex items-center gap-1.5"><Edit3 className="h-3.5 w-3.5 text-violet-600" /><span className="text-xs font-bold text-gray-800">Edit Dataset</span></div>
                    <button onClick={toggleEditPanel} className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-all"><X className="h-3 w-3" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {transformationOptions.map(opt => (
                      <button key={opt.id} onClick={() => handleTransformationSelect(opt.id)}
                        className={`w-full p-2 rounded-md flex items-center gap-2 transition-all duration-200 text-left border-2 ${selectedTransformation === opt.id ? `bg-${opt.color}-100 border-${opt.color}-500 shadow-sm` : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm hover:bg-gray-50"}`}>
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${selectedTransformation === opt.id ? `bg-${opt.color}-200 text-${opt.color}-700` : `bg-${opt.color}-50 text-${opt.color}-500`}`}>{opt.icon}</div>
                        <span className={`text-xs font-medium ${selectedTransformation === opt.id ? "text-gray-900" : "text-gray-700"}`}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Slim toggle */}
            {!isEditPanelOpen && (
              <button onClick={toggleEditPanel} className="flex-shrink-0 w-9 bg-white border-r-2 border-gray-200 flex flex-col items-center justify-start pt-4 hover:bg-violet-50 transition-colors group">
                <div className="w-6 h-6 rounded-md bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>
            )}

            {/* Middle table area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Stats bar */}
              {selectedDataset.rows > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 rounded-md">
                    <span className="text-xs font-medium text-blue-700">Rows:</span>
                    <span className="text-sm font-bold text-blue-600">{selectedDataset.rows.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 rounded-md">
                    <span className="text-xs font-medium text-green-700">Columns:</span>
                    <span className="text-sm font-bold text-green-600">{selectedDataset.columns}</span>
                  </div>
                  {!isPreviewMode && (
                    <button onClick={fetchFilterPreview} disabled={!hasTransformations} className="flex items-center gap-1 px-3 py-1 bg-yellow-100 rounded-md hover:bg-yellow-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Eye className="h-3 w-3 text-yellow-700" /><span className="text-xs font-medium text-yellow-700">Preview Changes</span>
                    </button>
                  )}
                  <button onClick={handleUndo} disabled={isUndoing || !hasTransformations} className="flex items-center gap-1 px-3 py-1 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isUndoing ? <Loader2 className="h-3 w-3 animate-spin text-purple-700" /> : <RotateCcw className="h-3 w-3 text-purple-700" />}
                    <span className="text-xs font-medium text-purple-700">Undo</span>
                  </button>
                  <button onClick={() => setShowResetModal(true)} disabled={!hasTransformations} className="flex items-center gap-1 px-3 py-1 bg-red-100 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <RefreshCw className="h-3 w-3 text-red-700" /><span className="text-xs font-medium text-red-700">Reset</span>
                  </button>
                  <button onClick={openSaveAsModal} disabled={isSavingAs || !hasTransformations || currentFilterType === "rename_column" || currentFilterType === "type_cast"} className="flex items-center gap-1 px-3 py-1 bg-emerald-100 rounded-md hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSavingAs ? <Loader2 className="h-3 w-3 animate-spin text-emerald-700" /> : <SaveAll className="h-3 w-3 text-emerald-700" />}
                    <span className="text-xs font-medium text-emerald-700">Finalize</span>
                  </button>
                </div>
              )}

              {/* Preview Banner */}
              {isPreviewMode && previewData && (
                <div className="px-4 py-2 bg-yellow-50 border-b-2 border-yellow-300">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-yellow-200 rounded-full"><AlertTriangle className="h-4 w-4 text-yellow-700" /></div>
                        <div>
                          <p className="text-sm font-bold text-yellow-900">🔍 Preview Mode — Changes Not Saved</p>
                          <p className="text-xs text-yellow-700">
                            {currentFilterType === "rename_column"
                              ? `Column renamed: "${previewData.old_column}" → "${previewData.new_column}". Highlighted in table. Click "Save" to confirm or "Cancel" to undo.`
                              : currentFilterType === "type_cast"
                                ? 'Type cast applied. Click "Save" to confirm or "Cancel" to undo.'
                                : 'Use "Save" to overwrite the current state, or "Finalize" to create a permanent version.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={cancelFilterPreview} disabled={isSavingFilter} className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1 text-xs font-medium disabled:opacity-50">
                          <X className="h-3 w-3" /><span>Cancel</span>
                        </button>
                        <button onClick={saveCurrentFilter} disabled={isSavingFilter} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1 text-xs font-medium disabled:opacity-50">
                          {isSavingFilter ? <><Loader2 className="h-3 w-3 animate-spin" /><span>Saving...</span></> : <><Save className="h-3 w-3" /><span>Save</span></>}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { label: "Rows",     val: previewData.rows?.toLocaleString() || 0,         cls: "text-blue-600"  },
                        { label: "Filtered", val: previewData.dropped_rows?.toLocaleString() || 0, cls: "text-red-600"   },
                        { label: "Total",    val: ((previewData.rows||0)+(previewData.dropped_rows||0)).toLocaleString(), cls: "text-gray-600" },
                        { label: "Kept",     val: previewData.rows && (previewData.rows+(previewData.dropped_rows||0))>0 ? `${((previewData.rows/(previewData.rows+(previewData.dropped_rows||0)))*100).toFixed(1)}%` : "0%", cls: "text-green-600" },
                      ].map(s => (
                        <div key={s.label} className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-yellow-300 text-xs">
                          <span className="text-gray-500">{s.label}:</span><span className={`font-bold ${s.cls}`}>{s.val}</span>
                        </div>
                      ))}
                      {currentFilterType && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-yellow-300 text-xs flex-1 min-w-0">
                          <span className="text-gray-500 flex-shrink-0">Transform:</span>
                          <span className="font-bold text-gray-900 truncate">
                            {currentFilterType === "sort"          ? `SORT: ${previewData?.sort_column} (${previewData?.sort_order === "asc" ? "↑" : "↓"})` :
                             currentFilterType === "rename_column" ? `RENAME: '${previewData?.old_column}' → '${previewData?.new_column}'` :
                             currentFilterType === "type_cast"     ? `CAST: '${previewData?.cast_column}' → ${previewData?.cast_type}` :
                             currentFilterType.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="flex-1 overflow-hidden bg-gray-100">
                {selectedDataset.fullData && selectedDataset.fullData.length > 0 ? (
                  <div ref={tableScrollRef} className="h-full overflow-auto" style={{ overflowX: "hidden" }} onScroll={handleTableScrollWithSync}>
                    <table className="min-w-full bg-white border-collapse">
                      <thead className="sticky top-0 z-10 shadow-md">
                        <tr className="bg-gradient-to-r from-gray-800 to-gray-700">
                          <th className="px-3 py-2 text-left text-xs font-bold text-white border-r border-gray-600 bg-gray-900 sticky left-0 z-20 min-w-[50px]">#</th>
                          {columnHeaders.map((header, idx) => {
                            // ── NEW: Highlight renamed column ──
                          // REPLACE WITH:
const isRenamedCol = currentFilterType === "rename_column" &&
  (previewData?.old_column === header || previewData?.new_column === header);
const displayHeader = (currentFilterType === "rename_column" && previewData?.old_column === header)
  ? previewData.new_column   // ← show "Amount" instead of "Revenue"
  : header;
                            return (
                              <th key={idx}
                                className={`px-4 py-2 text-left text-xs font-semibold border-r border-gray-600 whitespace-nowrap min-w-[130px] group relative transition-colors ${
                                  isRenamedCol
                                    ? "bg-yellow-400 text-gray-900"
                                    : "text-white"
                                }`}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-col">
                                  {/* // REPLACE WITH: */}
<span className={`flex-1 cursor-pointer ${sortColumn === header ? "text-blue-300 font-bold" : ""} ${isRenamedCol ? "text-gray-900 font-bold" : ""}`}
  onClick={() => handleColumnSort(displayHeader)}>
  {displayHeader}
</span>
{isRenamedCol && previewData?.old_column === header && (
  <span className="text-[9px] text-yellow-800 font-normal leading-tight">
    ← was: {header}
  </span>
)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => handleColumnSort(header)}><SortIndicator col={header} /></div>
                                    <button onClick={e => { e.stopPropagation(); fetchColumnFilterValues(header, e); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-600 rounded">
                                      <Filter className="h-4 w-4 text-gray-300 hover:text-white" />
                                    </button>
                                  </div>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={columnHeaders.length + 1} /></tr>}
                        {selectedDataset.fullData.slice(virtualStart, virtualEnd).map((row, i) => {
                          const rowIndex = virtualStart + i;
                          return (
                            <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-violet-50 transition-colors border-b border-gray-200`} style={{ height: ROW_HEIGHT }}>
                              <td className="px-3 py-1 text-xs text-gray-600 font-semibold border-r border-gray-200 bg-gray-100 sticky left-0 z-10 text-center">{rowIndex + 1}</td>
                              {columnHeaders.map((h, ci) => {
                                const isRenamedCol = currentFilterType === "rename_column" && previewData?.new_column === h;
                                return (
                                  <td key={ci} className={`px-4 py-1 text-xs border-r border-gray-200 whitespace-nowrap ${isRenamedCol ? "bg-yellow-50 text-gray-800 font-medium" : "text-gray-800"}`}>
                                    {String(row[h] !== undefined && row[h] !== null ? row[h] : "")}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={columnHeaders.length + 1} /></tr>}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col justify-center items-center h-full">
                    <Loader2 className="h-16 w-16 animate-spin text-violet-600 mb-4" />
                    <span className="text-xl text-gray-700 font-semibold">Loading dataset...</span>
                  </div>
                )}
              </div>

              {/* Pinned H-Scroll */}
              {selectedDataset.fullData && selectedDataset.fullData.length > 0 && (
                <div ref={hScrollBarRef} className="flex-shrink-0 overflow-x-auto overflow-y-hidden pinned-hscroll" style={{ height: 20 }} onScroll={handleHScrollBarScroll}>
                  <div style={{ width: tableScrollWidth, height: 1 }} />
                </div>
              )}

              {/* Footer */}
              {selectedDataset.fullData && selectedDataset.fullData.length > 0 && (
                <div className="px-4 py-2 bg-gray-800 text-white border-t border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><Settings2 className="h-3 w-3" /><strong>Setting:</strong> {selectedDataset.name}</span>
                    <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /><strong>Records:</strong> {selectedDataset.rows.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT FORM PANEL */}
            <div className={`bg-white border-l-2 border-gray-200 transition-all duration-300 ease-in-out ${selectedTransformation ? "w-80" : "w-0"} overflow-hidden`}>

              {/* RENAME COLUMN */}
              {selectedTransformation === "rename_column" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
                    <div className="flex items-center gap-2"><Type className="h-6 w-6 text-green-600" /><h3 className="text-lg font-bold text-gray-900">Rename Column</h3></div>
                    <p className="text-sm text-gray-600 mt-1">Change a column's display name</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Column <span className="text-red-500">*</span></label>
                      <select value={renameOldColumn} onChange={e => setRenameOldColumn(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-900">
                        <option value="">-- Select a column --</option>
                        {columnHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Name <span className="text-red-500">*</span></label>
                      <input type="text" value={renameNewColumn} onChange={e => setRenameNewColumn(e.target.value)} placeholder="Enter new column name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                      <strong>💡 Preview:</strong> After clicking "Preview Rename", the renamed column will be highlighted in <span className="text-yellow-700 font-semibold">yellow</span> in the table. Click <strong>Save</strong> in the banner to confirm.
                    </div>
                  </div>
                  <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                    <button onClick={handleRenameColumn} disabled={!renameOldColumn || !renameNewColumn || isRenamingColumn} className="w-full px-6 py-3 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 font-medium disabled:opacity-50">
                      {isRenamingColumn ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Renaming...</span></> : <><Eye className="h-5 w-5" /><span>Preview Rename</span></>}
                    </button>
                    <button onClick={() => { setSelectedTransformation(null); setRenameOldColumn(""); setRenameNewColumn(""); }} disabled={isRenamingColumn} className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* TYPE CAST */}
              {selectedTransformation === "type_cast" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
                    <div className="flex items-center gap-2"><FileText className="h-6 w-6 text-purple-600" /><h3 className="text-lg font-bold text-gray-900">Type Cast</h3></div>
                    <p className="text-sm text-gray-600 mt-1">Convert column data type</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Column <span className="text-red-500">*</span></label>
                      <select value={typeCastColumn} onChange={e => setTypeCastColumn(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-900">
                        <option value="">-- Select a column --</option>
                        {columnHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Convert To <span className="text-red-500">*</span></label>
                      <select value={typeCastNewType} onChange={e => setTypeCastNewType(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-900">
                        <option value="">-- Select type --</option>
                        <option value="int">Integer (int)</option>
                        <option value="float">Float (float)</option>
                        <option value="str">String (str)</option>
                        <option value="date">Date (date)</option>
                        <option value="datetime">DateTime (datetime)</option>
                      </select>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800"><strong>Warning:</strong> Invalid conversions will be set to null/NaN.</div>
                  </div>
                  <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                    <button onClick={handleTypeCast} disabled={!typeCastColumn || !typeCastNewType || isTypeCasting} className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700 font-medium disabled:opacity-50">
                      {isTypeCasting ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Casting...</span></> : <><Eye className="h-5 w-5" /><span>Preview Cast</span></>}
                    </button>
                    <button onClick={() => { setSelectedTransformation(null); setTypeCastColumn(""); setTypeCastNewType(""); }} disabled={isTypeCasting} className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* GROUP & AGGREGATE */}
              {selectedTransformation === "group_and_aggregate" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
                    <div className="flex items-center gap-2"><Database className="h-6 w-6 text-orange-600" /><h3 className="text-lg font-bold text-gray-900">Group & Aggregate</h3></div>
                    <p className="text-sm text-gray-600 mt-1">Group data and perform aggregations</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Group By Columns <span className="text-red-500">*</span></label>
                      <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                        {columnHeaders.map((h, i) => (
                          <label key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer rounded">
                            <input type="checkbox" checked={groupByColumns.includes(h)} onChange={e => { if (e.target.checked) setGroupByColumns(p => [...p, h]); else setGroupByColumns(p => p.filter(c => c !== h)); }} className="h-4 w-4 text-orange-600 rounded" />
                            <span className="text-sm text-gray-900">{h}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Aggregate Column <span className="text-red-500">*</span></label>
                      <select value={aggregateColumn} onChange={e => setAggregateColumn(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900">
                        <option value="">-- Select column --</option>
                        {columnHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Function <span className="text-red-500">*</span></label>
                      <select value={aggregateFunction} onChange={e => setAggregateFunction(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900">
                        <option value="">-- Select function --</option>
                        <option value="sum">Sum</option><option value="count">Count</option>
                        <option value="min">Min</option><option value="max">Max</option><option value="avg">Average</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                    <button onClick={handleGroupAndAggregate} disabled={!groupByColumns.length || !aggregateColumn || !aggregateFunction || isGroupingAggregating} className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-orange-700 font-medium disabled:opacity-50">
                      {isGroupingAggregating ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Loading...</span></> : <><Eye className="h-5 w-5" /><span>Preview Grouping</span></>}
                    </button>
                    <button onClick={() => { setSelectedTransformation(null); setGroupByColumns([]); setAggregateColumn(""); setAggregateFunction(""); }} disabled={isGroupingAggregating} className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* ── FILTER BY DATE (UPDATED with Day checkboxes) ── */}
              {selectedTransformation === "filter_by_date" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-white">
                    <div className="flex items-center gap-2"><Calendar className="h-6 w-6 text-pink-600" /><h3 className="text-lg font-bold text-gray-900">Filter by Date</h3></div>
                    <p className="text-sm text-gray-600 mt-1">Filter records by Year, Month &amp; Day</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Date Column Select */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Date Column <span className="text-red-500">*</span></label>
                      <select value={dateColumn} onChange={e => { setDateColumn(e.target.value); setDateSummaryLoaded(false); setSelectedYears([]); setSelectedMonths([]); setSelectedDays([]); }} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white text-gray-900">
                        <option value="">-- Select date column --</option>
                        {columnHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                      </select>
                      {dateColumn && !dateSummaryLoaded && (
                        <button onClick={fetchDateSummary} disabled={isLoadingDateSummary} className="mt-3 w-full px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center justify-center gap-2 disabled:opacity-50">
                          {isLoadingDateSummary ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Loading dates...</span></> : <><Calendar className="h-4 w-4" /><span>Load Available Dates</span></>}
                        </button>
                      )}
                    </div>

                    {/* ── Year checkboxes ── */}
                    {dateSummaryLoaded && availableYears.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">Year(s)</label>
                          {selectedYears.length > 0 && (
                            <button onClick={() => setSelectedYears([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                          )}
                        </div>
                        <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                          {availableYears.map(y => (
                            <label key={y} className="flex items-center gap-3 p-2 hover:bg-pink-50 rounded cursor-pointer">
                              <input type="checkbox" checked={selectedYears.includes(y)}
                                onChange={e => { if (e.target.checked) setSelectedYears(p => [...p, y]); else setSelectedYears(p => p.filter(x => x !== y)); }}
                                className="h-4 w-4 text-pink-600 rounded" />
                              <span className="text-sm text-gray-900 font-medium">{y}</span>
                              <span className="text-xs text-gray-500 ml-auto">{Object.keys(availableMonths[y] || {}).length} months</span>
                            </label>
                          ))}
                        </div>
                        {selectedYears.length > 0 && (
                          <p className="text-xs text-pink-600 mt-1">{selectedYears.length} year(s) selected: {selectedYears.sort().join(", ")}</p>
                        )}
                      </div>
                    )}

                    {/* ── Month checkboxes ── */}
                    {dateSummaryLoaded && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">Month(s)</label>
                          {selectedMonths.length > 0 && (
                            <button onClick={() => setSelectedMonths([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[{n:1,l:"Jan"},{n:2,l:"Feb"},{n:3,l:"Mar"},{n:4,l:"Apr"},{n:5,l:"May"},{n:6,l:"Jun"},{n:7,l:"Jul"},{n:8,l:"Aug"},{n:9,l:"Sep"},{n:10,l:"Oct"},{n:11,l:"Nov"},{n:12,l:"Dec"}].map(m => {
                            const isSelected  = selectedMonths.includes(m.n);
                            const isAvailable = selectedYears.length === 0
                              ? Object.values(availableMonths).some(ym => ym.hasOwnProperty(m.n.toString()))
                              : selectedYears.some(y => availableMonths[y]?.hasOwnProperty(m.n.toString()));
                            return (
                              <button key={m.n}
                                onClick={() => isAvailable && (isSelected ? setSelectedMonths(p => p.filter(x => x !== m.n)) : setSelectedMonths(p => [...p, m.n]))}
                                disabled={!isAvailable}
                                className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${isSelected ? "bg-pink-600 text-white" : isAvailable ? "bg-white text-gray-700 border border-gray-300 hover:bg-pink-50" : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"}`}>
                                {m.l}
                              </button>
                            );
                          })}
                        </div>
                        {selectedMonths.length > 0 && (
                          <p className="text-xs text-pink-600 mt-1">{selectedMonths.length} month(s) selected</p>
                        )}
                      </div>
                    )}

                    {/* ── NEW: Day checkboxes ── */}
                    {dateSummaryLoaded && availableDays.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">Day(s)</label>
                          <div className="flex items-center gap-2">
                            {selectedDays.length > 0 && (
                              <button onClick={() => setSelectedDays([])} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
                            )}
                            <button
                              onClick={() => setSelectedDays(availableDays)}
                              className="text-xs text-pink-600 hover:text-pink-800 font-medium">
                              All
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {availableDays.map(d => {
                            const isSelected = selectedDays.includes(d);
                            return (
                              <button key={d}
                                onClick={() => isSelected
                                  ? setSelectedDays(p => p.filter(x => x !== d))
                                  : setSelectedDays(p => [...p, d])
                                }
                                className={`py-1.5 rounded text-xs font-semibold transition-all ${
                                  isSelected
                                    ? "bg-pink-600 text-white shadow-sm"
                                    : "bg-white text-gray-700 border border-gray-300 hover:bg-pink-50 hover:border-pink-300"
                                }`}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                        {selectedDays.length > 0 && (
                          <p className="text-xs text-pink-600 mt-1">
                            {selectedDays.length} day(s) selected: {selectedDays.sort((a,b) => a-b).join(", ")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Summary of selections */}
                    {dateSummaryLoaded && (selectedYears.length > 0 || selectedMonths.length > 0 || selectedDays.length > 0) && (
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-pink-700 mb-1">Filter Summary:</p>
                        <div className="space-y-1 text-xs text-pink-600">
                          {selectedYears.length > 0 && <p>📅 Years: {selectedYears.sort().join(", ")}</p>}
                          {selectedMonths.length > 0 && <p>📆 Months: {selectedMonths.sort((a,b) => a-b).map(m => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]).join(", ")}</p>}
                          {selectedDays.length > 0 && <p>🗓 Days: {selectedDays.sort((a,b) => a-b).join(", ")}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
                    <button
                      onClick={handleFilterByDate}
                      disabled={!dateColumn || !dateSummaryLoaded || isFilteringByDate || (!selectedYears.length && !selectedMonths.length && !selectedDays.length)}
                      className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-pink-700 font-medium disabled:opacity-50">
                      {isFilteringByDate ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Filtering...</span></> : <><Filter className="h-5 w-5" /><span>Apply Date Filter</span></>}
                    </button>
                    <button onClick={() => { setSelectedTransformation(null); setDateColumn(""); setSelectedYears([]); setSelectedMonths([]); setSelectedDays([]); setDateSummaryLoaded(false); }} disabled={isFilteringByDate} className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* GET HISTORY */}
              {selectedTransformation === "get_history" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><History className="h-6 w-6 text-gray-600" /><h3 className="text-lg font-bold text-gray-900">Transformation History</h3></div>
                      <button onClick={fetchHistory} disabled={isLoadingHistory} className="p-2 rounded-lg hover:bg-gray-200"><RefreshCw className={`h-5 w-5 text-gray-600 ${isLoadingHistory ? "animate-spin" : ""}`} /></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {isLoadingHistory ? (
                      <div className="flex flex-col items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-gray-600 mb-4" /><p className="text-sm text-gray-600">Loading...</p></div>
                    ) : historyData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full"><History className="h-16 w-16 text-gray-300 mb-4" /><p className="text-sm text-gray-600">No history</p></div>
                    ) : (
                      <div className="space-y-3">
                        {historyData.map((item, idx) => (
                          <div key={item.track_id} className="bg-white rounded-lg border-2 border-gray-200 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-sm font-bold text-blue-600">#{historyData.length - idx}</span></div>
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-2">{item.note}</p>
                            <div className="bg-gray-50 rounded p-2 border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Track ID</p>
                              <code className="text-xs font-mono text-gray-700 break-all">{item.track_id}</code>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
                    {historyData.length > 0 && (
                      <>
                        <button onClick={handleUndo} disabled={isUndoing} className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                          {isUndoing ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Undoing...</span></> : <><RotateCcw className="h-5 w-5" /><span>Undo Latest</span></>}
                        </button>
                        <button onClick={() => setShowResetModal(true)} className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2">
                          <RefreshCw className="h-5 w-5" /><span>Reset to Original</span>
                        </button>
                      </>
                    )}
                    <button onClick={() => { setSelectedTransformation(null); setHistoryData([]); }} className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Close</button>
                  </div>
                </div>
              )}

              {/* FILTER BY VALUES */}
              {selectedTransformation === "filter_by_values" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
                    <div className="flex items-center gap-2"><Filter className="h-6 w-6 text-indigo-600" /><h3 className="text-lg font-bold text-gray-900">Filter by Values</h3></div>
                    <p className="text-sm text-gray-600 mt-1">Filter by specific column values</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Column <span className="text-red-500">*</span></label>
                      <select value={filterColumn} onChange={e => setFilterColumn(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900">
                        <option value="">-- Select a column --</option>
                        {columnHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                      </select>
                      {filterColumn && !uniqueValuesLoaded && (
                        <button onClick={fetchUniqueValues} disabled={isLoadingUniqueValues} className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50">
                          {isLoadingUniqueValues ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Loading values...</span></> : <><Filter className="h-4 w-4" /><span>Load Unique Values</span></>}
                        </button>
                      )}
                    </div>
                    {uniqueValuesLoaded && uniqueValuesData && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {[{l:"Total",v:uniqueValuesData.total_rows,c:"blue"},{l:"Unique",v:uniqueValuesData.unique_values_count,c:"green"},{l:"Nulls",v:uniqueValuesData.null_rows,c:"purple"}].map(s => (
                            <div key={s.l} className={`bg-${s.c}-50 p-2 rounded-lg border border-${s.c}-200`}>
                              <p className={`text-xs text-${s.c}-600 font-medium`}>{s.l}</p>
                              <p className={`text-base font-bold text-${s.c}-900`}>{s.v}</p>
                            </div>
                          ))}
                        </div>
                    

                        <input type="text" value={uniqueValuesSearch} onChange={e => setUniqueValuesSearch(e.target.value)} placeholder="Search values..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                        <div className="flex gap-2">
                          <button onClick={() => { const all = new Set(selectedFilterValues); (uniqueValuesData.unique_values as any[]).filter(v => !uniqueValuesSearch || String(v).toLowerCase().includes(uniqueValuesSearch.toLowerCase())).forEach((v: any) => all.add(v)); setSelectedFilterValues(all); }} className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm font-medium">Select All</button>
                          <button onClick={() => setSelectedFilterValues(new Set())} className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">Clear</button>
                        </div>
                        
                        {selectedFilterValues.size > 0 && <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200"><p className="text-sm text-indigo-800">{selectedFilterValues.size > 0 && (() => {
  const totalSelectedRows = uniqueValuesData
    ? Array.from(selectedFilterValues).reduce(
        (sum, v) =>
          sum + (uniqueValuesData.value_counts?.[String(v)] || 0),
        0
      )
    : 0;

  return (
    <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
      <p className="text-sm text-indigo-800">
        <strong>{selectedFilterValues.size}</strong> value(s) selected •{" "}
        <strong>{totalSelectedRows}</strong> rows
      </p>
    </div>
  );
})()}</p></div>}
                        <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                          <div className="p-2 space-y-1">
                            {(uniqueValuesData.unique_values as any[]).filter(v => !uniqueValuesSearch || String(v).toLowerCase().includes(uniqueValuesSearch.toLowerCase())).map((v: any, i: number) => {
                              const isSelected = selectedFilterValues.has(v);
                              const count      = uniqueValuesData.value_counts?.[String(v)] || 0;
                              return (
                                <label key={i} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isSelected ? "bg-indigo-100 border-2 border-indigo-500" : "hover:bg-gray-50 border-2 border-transparent"}`}>
                                  <input type="checkbox" checked={isSelected} onChange={() => { const s = new Set(selectedFilterValues); isSelected ? s.delete(v) : s.add(v); setSelectedFilterValues(s); }} className="h-4 w-4 text-indigo-600 rounded" />
                                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{String(v)}</p><p className="text-xs text-gray-500">{count} rows</p></div>
                                  {isSelected && <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                    <button onClick={handleFilterByUniqueValues} disabled={!filterColumn || !uniqueValuesLoaded || selectedFilterValues.size === 0 || isApplyingFilter} className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 font-medium disabled:opacity-50">
                      {isApplyingFilter ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Applying...</span></> : <><Save className="h-5 w-5" /><span>Apply Filter ({selectedFilterValues.size} values)</span></>}
                    </button>
                    <button onClick={() => { setSelectedTransformation(null); setFilterColumn(""); setSelectedFilterValues(new Set()); setUniqueValuesLoaded(false); setUniqueValuesData(null); }} disabled={isApplyingFilter} className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* TEXT FILTER */}
              {selectedTransformation === "text_filter" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-center gap-2"><Type className="h-6 w-6 text-blue-600" /><h3 className="text-lg font-bold text-gray-900">Text Filter</h3></div>
                    <p className="text-sm text-gray-600 mt-1">Filter text data with advanced conditions</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Column <span className="text-red-500">*</span></label>
                      <select value={textFilterColumn} onChange={e => setTextFilterColumn(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900">
                        <option value="">-- Select a column --</option>
                        {columnHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filter Type <span className="text-red-500">*</span></label>
                      <select value={textFilterType} onChange={e => { setTextFilterType(e.target.value); setTextFilterValue(""); setTextFilterValue2(""); setTextFilterValues([]); }} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900">
                        <option value="equals">Equals</option><option value="contains">Contains</option>
                        <option value="starts_with">Starts With</option><option value="ends_with">Ends With</option>
                        <option value="not_equals">Not Equals</option><option value="between">Between</option>
                        <option value="in">In List</option><option value="empty">Is Empty</option><option value="not_empty">Is Not Empty</option>
                      </select>
                    </div>
                    {["equals","contains","starts_with","ends_with","not_equals"].includes(textFilterType) && (
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Value <span className="text-red-500">*</span></label><input type="text" value={textFilterValue} onChange={e => setTextFilterValue(e.target.value)} placeholder="Enter value" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    )}
                    {textFilterType === "between" && (
                      <div className="space-y-3">
                        <div><label className="block text-sm font-medium text-gray-700 mb-2">From</label><input type="text" value={textFilterValue} onChange={e => setTextFilterValue(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-2">To</label><input type="text" value={textFilterValue2} onChange={e => setTextFilterValue2(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                      </div>
                    )}
                    {textFilterType === "in" && (
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Values (one per line)</label><textarea value={textFilterValues.join("\n")} onChange={e => setTextFilterValues(e.target.value.split("\n").filter(v => v.trim()))} rows={5} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>
                    )}
                  </div>
                  <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                    <button onClick={handleTextFilter} disabled={!textFilterColumn || isApplyingTextFilter} className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 font-medium disabled:opacity-50">
                      {isApplyingTextFilter ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Applying...</span></> : <><Eye className="h-5 w-5" /><span>Preview Filter</span></>}
                    </button>
                    <button onClick={() => { setSelectedTransformation(null); setTextFilterColumn(""); setTextFilterType("equals"); setTextFilterValue(""); setTextFilterValue2(""); setTextFilterValues([]); }} disabled={isApplyingTextFilter} className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* NUMBER FILTER */}
              {selectedTransformation === "number_filter" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-white">
                    <div className="flex items-center gap-2"><Hash className="h-6 w-6 text-teal-600" /><h3 className="text-lg font-bold text-gray-900">Number Filter</h3></div>
                    <p className="text-sm text-gray-600 mt-1">Filter numeric data with conditions</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Numeric Column <span className="text-red-500">*</span></label>
                      <select value={numberFilterColumn} onChange={e => setNumberFilterColumn(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-900">
                        <option value="">-- Select a column --</option>
                        {columnHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filter Type <span className="text-red-500">*</span></label>
                      <select value={numberFilterType} onChange={e => { setNumberFilterType(e.target.value); setNumberFilterValue(""); setNumberFilterValue2(""); setNumberFilterValues([]); }} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-900">
                        <option value="equals">Equals (=)</option><option value="not_equals">Not Equals (≠)</option>
                        <option value="greater_than">Greater Than (&gt;)</option><option value="less_than">Less Than (&lt;)</option>
                        <option value="greater_than_or_equal">≥ Greater Than or Equal</option><option value="less_than_or_equal">≤ Less Than or Equal</option>
                        <option value="between">Between</option><option value="in">In List</option>
                        <option value="empty">Is Empty/Null</option><option value="not_empty">Is Not Empty</option>
                      </select>
                    </div>
                    {["equals","not_equals","greater_than","less_than","greater_than_or_equal","less_than_or_equal"].includes(numberFilterType) && (
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Value <span className="text-red-500">*</span></label><input type="number" step="any" value={numberFilterValue} onChange={e => setNumberFilterValue(e.target.value)} placeholder="Enter value" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
                    )}
                    {numberFilterType === "between" && (
                      <div className="space-y-3">
                        <div><label className="block text-sm font-medium text-gray-700 mb-2">Min</label><input type="number" step="any" value={numberFilterValue} onChange={e => setNumberFilterValue(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
                        <div><label className="block text-sm font-medium text-gray-700 mb-2">Max</label><input type="number" step="any" value={numberFilterValue2} onChange={e => setNumberFilterValue2(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
                      </div>
                    )}
                    {numberFilterType === "in" && (
                      <div><label className="block text-sm font-medium text-gray-700 mb-2">Values (one per line)</label><textarea value={numberFilterValues.join("\n")} onChange={e => setNumberFilterValues(e.target.value.split("\n").filter(v => v.trim() && !isNaN(Number(v.trim()))))} rows={5} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none font-mono" /></div>
                    )}
                  </div>
                  <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                    <button onClick={handleNumberFilter} disabled={!numberFilterColumn || isApplyingNumberFilter} className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-teal-700 font-medium disabled:opacity-50">
                      {isApplyingNumberFilter ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Applying...</span></> : <><Eye className="h-5 w-5" /><span>Preview Filter</span></>}
                    </button>
                    <button onClick={() => { setSelectedTransformation(null); setNumberFilterColumn(""); setNumberFilterType("equals"); setNumberFilterValue(""); setNumberFilterValue2(""); setNumberFilterValues([]); }} disabled={isApplyingNumberFilter} className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column filter floating dropdown */}
          {filterDropdownOpen && (
            <div className="fixed bg-white rounded-xl shadow-2xl border-2 border-gray-300 z-[60] w-96 overflow-hidden flex flex-col"
              style={{ top: filterDropdownPosition.top, left: filterDropdownPosition.left, maxHeight: `min(550px, ${typeof window !== "undefined" ? window.innerHeight - filterDropdownPosition.top - 20 : 500}px)` }}>
              <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-indigo-100 border-b border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-2"><Filter className="h-5 w-5 text-indigo-600" /><h3 className="text-sm font-bold text-gray-900">Filter: {filterDropdownOpen}</h3></div>
                <button onClick={() => { setFilterDropdownOpen(null); setColumnFilterValues(null); }} className="text-gray-500 hover:text-gray-700 p-1"><X className="h-4 w-4" /></button>
              </div>
              {isLoadingColumnFilter ? (
                <div className="flex flex-col items-center justify-center py-10"><Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" /><p className="text-sm text-gray-600">Loading...</p></div>
              ) : columnFilterValues ? (
                <>
                  <div className="p-3 bg-gray-50 border-b border-gray-200 grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center"><p className="text-gray-500">Total</p><p className="font-bold">{columnFilterValues.total_rows}</p></div>
                    <div className="text-center"><p className="text-gray-500">Unique</p><p className="font-bold text-indigo-600">{columnFilterValues.unique_values_count}</p></div>
                    <div className="text-center"><p className="text-gray-500">Nulls</p><p className="font-bold text-red-600">{columnFilterValues.null_rows}</p></div>
                  </div>
                  <div className="p-3 border-b border-gray-200">
                    <input type="text" value={columnFilterSearchTerm} onChange={e => setColumnFilterSearchTerm(e.target.value)} placeholder="Search values..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                    <button onClick={() => { const s = new Set(selectedColumnFilterValues); getFilteredColVals().forEach((v: any) => s.add(v)); setSelectedColumnFilterValues(s); }} className="flex-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 font-medium">Select All</button>
                    <button onClick={() => setSelectedColumnFilterValues(new Set())} className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">Clear</button>
                    <span className="text-xs text-gray-600">{selectedColumnFilterValues.size} selected</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {getFilteredColVals().map((v: any, i: number) => {
                        const count      = columnFilterValues.value_counts?.[String(v)] || 0;
                        const isSelected = selectedColumnFilterValues.has(v);
                        return (
                          <label key={i} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected ? "bg-indigo-50 border border-indigo-200" : "hover:bg-gray-50"}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => { const s = new Set(selectedColumnFilterValues); isSelected ? s.delete(v) : s.add(v); setSelectedColumnFilterValues(s); }} className="h-4 w-4 text-indigo-600 rounded" />
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{String(v)}</p><p className="text-xs text-gray-500">{count.toLocaleString()}</p></div>
                            {isSelected && <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
                    <button onClick={() => { setFilterDropdownOpen(null); setColumnFilterValues(null); }} className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Cancel</button>
                    <button onClick={applyColumnFilter} disabled={isApplyingFilter || selectedColumnFilterValues.size === 0} className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                      {isApplyingFilter ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Applying...</span></> : <><Check className="h-4 w-4" /><span>OK</span></>}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .pinned-hscroll::-webkit-scrollbar { height: 12px; }
        .pinned-hscroll::-webkit-scrollbar-track { background: #374151; }
        .pinned-hscroll::-webkit-scrollbar-thumb { background: #6b7280; border-radius: 6px; border: 2px solid #374151; }
        .pinned-hscroll::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        .pinned-hscroll { scrollbar-width: auto; scrollbar-color: #6b7280 #374151; background-color: #374151; }
      `}</style>
    </div>
  );
}