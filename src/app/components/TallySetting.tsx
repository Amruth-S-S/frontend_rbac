"use client";
import React from "react";
import { useState, useEffect } from 'react';
import { Upload, X, FileText, FileSpreadsheet, FileJson, Check, Eye, Database, Plus, Loader2, AlertTriangle, RefreshCw, Trash2, Edit3, Wand2, Type, Filter, Calendar, RotateCcw, History, ArrowLeft, Table, Save, ArrowUp, ArrowDown, Hash, BookMarked, SaveAll } from 'lucide-react';

type FileType = 'csv' | 'excel' | 'json';

interface UploadedDataset {
  id: string;
  name: string;
  type: FileType;
  uploadDate: Date;
  rows: number;
  columns: number;
  size: number;
  previewData?: any[];
  fullData?: any[];
  columnHeaders?: string[];
  file?: string;
}

interface PromptDataset {
  file_name: string;
  rows: number;
  columns: string[];
  column_count: number;
  created_from: string;
  has_dataframe: boolean;
  dtypes: Record<string, string>;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export default function TallySetting() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState<FileType | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDatasets, setUploadedDatasets] = useState<UploadedDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<UploadedDataset | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState<'uploaded' | 'saved'>('uploaded');

  // Prompt/Saved datasets state
  const [promptDatasets, setPromptDatasets] = useState<PromptDataset[]>([]);
  const [loadingPromptDatasets, setLoadingPromptDatasets] = useState(false);
  const [promptDatasetToDelete, setPromptDatasetToDelete] = useState<PromptDataset | null>(null);
  const [deletePromptModalOpen, setDeletePromptModalOpen] = useState(false);
  const [isDeletingPrompt, setIsDeletingPrompt] = useState(false);

  // Save As modal state
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsFileName, setSaveAsFileName] = useState('');
  const [isSavingAs, setIsSavingAs] = useState(false);

  // New states for dataset upload modal
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedUploadType, setSelectedUploadType] = useState<FileType | null>(null);

  // Toast notification state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [toastCounter, setToastCounter] = useState(0);

  const showToast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const id = toastCounter;
    setToastCounter(prev => prev + 1);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const getToastColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check className="h-5 w-5" />;
      case 'error': return <X className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'info': return <AlertTriangle className="h-5 w-5" />;
      default: return <Check className="h-5 w-5" />;
    }
  };

  // Edit panel state
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [selectedTransformation, setSelectedTransformation] = useState<string | null>(null);

  const handleTransformationSelect = (transformation: string) => {
    setSelectedTransformation(transformation);
    setRenameOldColumn('');
    setRenameNewColumn('');
    setTypeCastColumn('');
    setTypeCastNewType('');
    setHistoryData([]);
    if (transformation === 'get_history') fetchHistory();
  };

  const [renameOldColumn, setRenameOldColumn] = useState<string>('');
  const [renameNewColumn, setRenameNewColumn] = useState<string>('');
  const [isRenamingColumn, setIsRenamingColumn] = useState(false);

  const handleRenameColumn = async () => {
    if (!selectedDataset || !renameOldColumn || !renameNewColumn) {
      showToast('warning', 'Please select a column and enter a new name');
      return;
    }
    if (renameOldColumn === renameNewColumn) {
      showToast('warning', 'New column name must be different from the old one');
      return;
    }
    setIsRenamingColumn(true);
    try {
      const renameApiUrl = `http://127.0.0.1:8000/rename-column/?file_name=${encodeURIComponent(selectedDataset.name)}&old_column=${encodeURIComponent(renameOldColumn)}&new_column=${encodeURIComponent(renameNewColumn)}`;
      let response = await fetch(renameApiUrl, { method: 'PUT', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(renameApiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(renameApiUrl, { method: 'PATCH', headers: { "X-API-Key": EXCEL_API_KEY } });

      if (response.ok) {
        const saveApiUrl = `http://127.0.0.1:8000/save-filter/?file_name=${encodeURIComponent(selectedDataset.name)}`;
        const saveResponse = await fetch(saveApiUrl, { method: 'POST', headers: { "X-API-Key": EXCEL_API_KEY, "Content-Type": "application/json" } });
        if (saveResponse.ok) {
          showToast('success', `Column renamed: '${renameOldColumn}' → '${renameNewColumn}' and saved`);
          setHasTransformations(true);
          await refreshCurrentDataset();
          setRenameOldColumn('');
          setRenameNewColumn('');
          setSelectedTransformation(null);
        } else {
          const saveError = await saveResponse.text();
          showToast('error', `Column renamed but failed to save: ${saveError}`);
          await refreshCurrentDataset();
        }
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to rename column: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to rename column. Please check your connection.');
    } finally {
      setIsRenamingColumn(false);
    }
  };

  const [typeCastColumn, setTypeCastColumn] = useState<string>('');
  const [typeCastNewType, setTypeCastNewType] = useState<string>('');
  const [isTypeCasting, setIsTypeCasting] = useState(false);

  const handleTypeCast = async () => {
    if (!selectedDataset || !typeCastColumn || !typeCastNewType) {
      showToast('warning', 'Please select a column and data type');
      return;
    }
    setIsTypeCasting(true);
    try {
      const apiUrl = `http://127.0.0.1:8000/type-cast/?file_name=${encodeURIComponent(selectedDataset.name)}&column_name=${encodeURIComponent(typeCastColumn)}&new_type=${encodeURIComponent(typeCastNewType)}`;
      let response = await fetch(apiUrl, { method: 'PUT', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(apiUrl, { method: 'PATCH', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(apiUrl, { method: 'POST', headers: { "X-API-Key": EXCEL_API_KEY } });

      if (response.ok) {
        showToast('success', `Column '${typeCastColumn}' converted to ${typeCastNewType}`);
        setHasTransformations(true);
        await refreshCurrentDataset();
        setTypeCastColumn('');
        setTypeCastNewType('');
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to convert column: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to convert column. Please check your connection.');
    } finally {
      setIsTypeCasting(false);
    }
  };

  const [groupByColumns, setGroupByColumns] = useState<string[]>([]);
  const [aggregateColumn, setAggregateColumn] = useState<string>('');
  const [aggregateFunction, setAggregateFunction] = useState<string>('');
  const [isGroupingAggregating, setIsGroupingAggregating] = useState(false);

  const handleGroupAndAggregate = async () => {
    if (!selectedDataset || groupByColumns.length === 0 || !aggregateColumn || !aggregateFunction) {
      showToast('warning', 'Please select group by columns, aggregate column, and function');
      return;
    }
    setIsGroupingAggregating(true);
    try {
      const params = new URLSearchParams();
      params.append('file_name', selectedDataset.name);
      groupByColumns.forEach(col => params.append('group_by', col));
      params.append('aggregate_column', aggregateColumn);
      params.append('agg_func', aggregateFunction);
      const apiUrl = `http://127.0.0.1:8000/group-and-aggregate/?${params.toString()}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        showToast('success', `Preview ready: Grouped by ${groupByColumns.join(', ')}`);
        setCurrentFilterType('group_and_aggregate');
        await fetchFilterPreview();
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to group and aggregate: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to group and aggregate. Please check your connection.');
    } finally {
      setIsGroupingAggregating(false);
    }
  };

  const [dateColumn, setDateColumn] = useState<string>('');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<{ [key: string]: { [key: string]: number[] } }>({});
  const [availableDays, setAvailableDays] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isLoadingDateSummary, setIsLoadingDateSummary] = useState(false);
  const [isFilteringByDate, setIsFilteringByDate] = useState(false);
  const [dateSummaryLoaded, setDateSummaryLoaded] = useState(false);

  const handleFilterByDate = async () => {
    if (!selectedDataset || !dateColumn) { showToast('warning', 'Please select a date column'); return; }
    if (selectedYears.length === 0 && selectedMonths.length === 0 && selectedDays.length === 0) {
      showToast('warning', 'Please select at least one filter (year, month, or day)'); return;
    }
    setIsFilteringByDate(true);
    try {
      const params = new URLSearchParams();
      params.append('file_name', selectedDataset.name);
      params.append('date_column', dateColumn);
      params.append('flat_list', 'false');
      selectedYears.forEach(year => params.append('years', year.toString()));
      selectedMonths.forEach(month => params.append('months', month.toString()));
      selectedDays.forEach(day => params.append('days', day.toString()));
      const apiUrl = `http://127.0.0.1:8000/filter-by-date/?${params.toString()}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const filterSummary = [];
        if (selectedYears.length > 0) filterSummary.push(`Years: ${selectedYears.join(', ')}`);
        if (selectedMonths.length > 0) filterSummary.push(`Months: ${selectedMonths.join(', ')}`);
        if (selectedDays.length > 0) filterSummary.push(`Days: ${selectedDays.join(', ')}`);
        showToast('success', `Preview ready: ${filterSummary.join(' | ')}`);
        setCurrentFilterType('filter_by_date');
        await fetchFilterPreview();
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to filter by date: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to filter by date. Please check your connection.');
    } finally {
      setIsFilteringByDate(false);
    }
  };

  const [filterColumn, setFilterColumn] = useState<string>('');
  const [uniqueValuesData, setUniqueValuesData] = useState<any>(null);
  const [selectedFilterValues, setSelectedFilterValues] = useState<Set<any>>(new Set());
  const [isLoadingUniqueValues, setIsLoadingUniqueValues] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [uniqueValuesLoaded, setUniqueValuesLoaded] = useState(false);
  const [uniqueValuesSearchTerm, setUniqueValuesSearchTerm] = useState('');

  const fetchUniqueValues = async () => {
    if (!selectedDataset || !filterColumn) { showToast('warning', 'Please select a column to filter'); return; }
    setIsLoadingUniqueValues(true);
    try {
      const apiUrl = `http://127.0.0.1:8000/unique-values/?file_name=${encodeURIComponent(selectedDataset.name)}&column_name=${encodeURIComponent(filterColumn)}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const result = await response.json();
        setUniqueValuesData(result);
        setUniqueValuesLoaded(true);
        setSelectedFilterValues(new Set());
        showToast('success', `Found ${result.unique_values_count} unique value(s) in '${filterColumn}'`);
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to load unique values: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to load unique values. Please check your connection.');
    } finally {
      setIsLoadingUniqueValues(false);
    }
  };

  const handleFilterByUniqueValues = async () => {
    if (!selectedDataset || !filterColumn) { showToast('warning', 'Please select a column to filter'); return; }
    if (selectedFilterValues.size === 0) { showToast('warning', 'Please select at least one value to filter by'); return; }
    setIsApplyingFilter(true);
    const valuesArray = Array.from(selectedFilterValues);
    try {
      const params = new URLSearchParams();
      params.append('file_name', selectedDataset.name);
      params.append('column_name', filterColumn);
      valuesArray.forEach(value => params.append('value', String(value)));
      const apiUrl = `http://127.0.0.1:8000/select-column-value/?${params.toString()}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        showToast('success', `Filtered "${filterColumn}" by ${valuesArray.length} value(s)`);
        setCurrentFilterType('filter_by_values');
        await fetchFilterPreview();
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to apply filter: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to apply filters. Please check your connection.');
    } finally {
      setIsApplyingFilter(false);
    }
  };

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [currentFilterType, setCurrentFilterType] = useState<string | null>(null);
  const [isSavingFilter, setIsSavingFilter] = useState(false);

  const refreshCurrentDataset = async () => {
    if (!selectedDataset) return;
    try {
      const encodedFilename = encodeURIComponent(selectedDataset.name);
      let apiUrl = isPreviewMode
        ? `http://127.0.0.1:8000/get-current-filtered/?file_name=${encodedFilename}`
        : `http://127.0.0.1:8000/view-data/?file_name=${encodedFilename}`;
      let response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (!response.ok && isPreviewMode) {
        apiUrl = `http://127.0.0.1:8000/view-data/?file_name=${encodedFilename}`;
        response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      }
      if (response.ok) {
        const fullDataResponse = await response.json();
        const fullData = fullDataResponse.data || fullDataResponse.preview || [];
        const columnHeaders = fullDataResponse.columns || [];
        const rows = fullDataResponse.rows || fullData.length;
        setSelectedDataset({ ...selectedDataset, fullData, rows, columns: columnHeaders.length, columnHeaders });
      }
    } catch (error) {
      console.error('Error refreshing dataset:', error);
    }
  };

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isSorting, setIsSorting] = useState(false);

  const handleColumnSort = async (columnName: string) => {
    if (!selectedDataset) return;
    let newSortOrder: 'asc' | 'desc' = 'asc';
    if (sortColumn === columnName) newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setIsSorting(true);
    setSortColumn(columnName);
    setSortOrder(newSortOrder);
    try {
      let isNumeric = false;
      if (selectedDataset.fullData && selectedDataset.fullData.length > 0) {
        for (const row of selectedDataset.fullData) {
          const value = row[columnName];
          if (value !== null && value !== undefined && value !== '') {
            isNumeric = !isNaN(Number(value));
            break;
          }
        }
      }
      const params = new URLSearchParams();
      params.append('file_name', selectedDataset.name);
      params.append('sort_column', columnName);
      params.append('order', newSortOrder);
      params.append('numeric', String(isNumeric));
      const apiUrl = `http://127.0.0.1:8000/sort-by-asc-and-desc/?${params.toString()}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const result = await response.json();
        const sortedData = result.preview || result.data || [];
        const columnHeaders = result.columns || selectedDataset.columnHeaders || [];
        setSelectedDataset({ ...selectedDataset, fullData: sortedData, rows: result.rows || sortedData.length, columns: columnHeaders.length, columnHeaders });
        const direction = newSortOrder === 'asc' ? '↑ Ascending' : '↓ Descending';
        showToast('success', `Sorted by "${columnName}" ${direction}`);
        setIsPreviewMode(true);
        setCurrentFilterType('sort');
        setPreviewData({ rows: result.rows, dropped_rows: 0, columns: columnHeaders, preview: sortedData, filter_type: 'SORT', sort_column: columnName, sort_order: newSortOrder });
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to sort column: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to sort column. Please check your connection.');
    } finally {
      setIsSorting(false);
    }
  };

  const SortIndicator = ({ columnName }: { columnName: string }) => {
    if (sortColumn !== columnName) {
      return (
        <div className="flex flex-col opacity-30 hover:opacity-60 transition-opacity">
          <svg className="w-3 h-3 -mb-1" fill="currentColor" viewBox="0 0 12 12"><path d="M6 3l4 4H2z" /></svg>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12"><path d="M6 9l4-4H2z" /></svg>
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        {sortOrder === 'asc'
          ? <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 12 12"><path d="M6 3l4 4H2z" /></svg>
          : <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 12 12"><path d="M6 9l4-4H2z" /></svg>}
      </div>
    );
  };

  const [filterDropdownOpen, setFilterDropdownOpen] = useState<string | null>(null);
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({ top: 0, left: 0 });
  const [columnFilterValues, setColumnFilterValues] = useState<any>(null);
  const [isLoadingColumnFilter, setIsLoadingColumnFilter] = useState(false);
  const [selectedColumnFilterValues, setSelectedColumnFilterValues] = useState<Set<any>>(new Set());
  const [columnFilterSearchTerm, setColumnFilterSearchTerm] = useState('');

  const applyColumnFilter = async () => {
    if (!selectedDataset || !filterDropdownOpen) return;
    if (selectedColumnFilterValues.size === 0) { showToast('warning', 'Please select at least one value'); return; }
    setIsApplyingFilter(true);
    const valuesArray = Array.from(selectedColumnFilterValues);
    try {
      const params = new URLSearchParams();
      params.append('file_name', selectedDataset.name);
      params.append('column_name', filterDropdownOpen);
      valuesArray.forEach(value => params.append('value', String(value)));
      const apiUrl = `http://127.0.0.1:8000/select-column-value/?${params.toString()}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        showToast('success', `Filtered "${filterDropdownOpen}" by ${valuesArray.length} value(s)`);
        setCurrentFilterType('filter_by_values');
        setFilterDropdownOpen(null);
        setColumnFilterValues(null);
        await fetchFilterPreview();
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to apply filter: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to apply filter');
    } finally {
      setIsApplyingFilter(false);
    }
  };

  const toggleColumnFilterValue = (value: any) => {
    const newSet = new Set(selectedColumnFilterValues);
    if (newSet.has(value)) newSet.delete(value); else newSet.add(value);
    setSelectedColumnFilterValues(newSet);
  };

  const selectAllColumnFilterValues = () => {
    if (!columnFilterValues) return;
    const filteredValues = columnFilterValues.unique_values.filter((value: any) =>
      String(value).toLowerCase().includes(columnFilterSearchTerm.toLowerCase())
    );
    const newSet = new Set(selectedColumnFilterValues);
    filteredValues.forEach((value: any) => newSet.add(value));
    setSelectedColumnFilterValues(newSet);
  };

  const deselectAllColumnFilterValues = () => setSelectedColumnFilterValues(new Set());

  const getFilteredColumnValues = () => {
    if (!columnFilterValues) return [];
    if (!columnFilterSearchTerm) return columnFilterValues.unique_values;
    return columnFilterValues.unique_values.filter((value: any) =>
      String(value).toLowerCase().includes(columnFilterSearchTerm.toLowerCase())
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (filterDropdownOpen && !target.closest('.fixed')) {
        setFilterDropdownOpen(null);
        setColumnFilterValues(null);
      }
    };
    if (filterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [filterDropdownOpen]);

  const fetchColumnFilterValues = async (columnName: string, event: React.MouseEvent) => {
    if (!selectedDataset) return;
    const buttonRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const dropdownHeight = 600;
    const dropdownWidth = 384;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    let top = buttonRect.bottom + 8;
    let left = buttonRect.left;
    if (top + dropdownHeight > viewportHeight) top = Math.max(20, buttonRect.top - dropdownHeight - 8);
    if (left + dropdownWidth > viewportWidth) left = viewportWidth - dropdownWidth - 20;
    if (left < 20) left = 20;
    setFilterDropdownPosition({ top, left });
    setIsLoadingColumnFilter(true);
    setFilterDropdownOpen(columnName);
    setColumnFilterSearchTerm('');
    try {
      const apiUrl = `http://127.0.0.1:8000/unique-values/?file_name=${encodeURIComponent(selectedDataset.name)}&column_name=${encodeURIComponent(columnName)}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const result = await response.json();
        setColumnFilterValues(result);
        setSelectedColumnFilterValues(new Set(result.unique_values));
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to load filter values: ${errorText}`);
        setFilterDropdownOpen(null);
      }
    } catch (error) {
      showToast('error', 'Failed to load filter values');
      setFilterDropdownOpen(null);
    } finally {
      setIsLoadingColumnFilter(false);
    }
  };

  const [textFilterColumn, setTextFilterColumn] = useState<string>('');
  const [textFilterType, setTextFilterType] = useState<string>('equals');
  const [textFilterValue, setTextFilterValue] = useState<string>('');
  const [textFilterValue2, setTextFilterValue2] = useState<string>('');
  const [textFilterValues, setTextFilterValues] = useState<string[]>([]);
  const [isApplyingTextFilter, setIsApplyingTextFilter] = useState(false);

  const handleTextFilter = async () => {
    if (!selectedDataset || !textFilterColumn || !textFilterType) { showToast('warning', 'Please select a column and filter type'); return; }
    if (['equals', 'contains', 'starts_with', 'ends_with', 'not_equals'].includes(textFilterType) && !textFilterValue) { showToast('warning', 'Please enter a filter value'); return; }
    if (textFilterType === 'between' && (!textFilterValue || !textFilterValue2)) { showToast('warning', 'Please enter both values for "between" filter'); return; }
    if (textFilterType === 'in' && textFilterValues.length === 0) { showToast('warning', 'Please enter at least one value for "in" filter'); return; }
    setIsApplyingTextFilter(true);
    try {
      const params = new URLSearchParams();
      params.append('file_name', selectedDataset.name);
      params.append('column', textFilterColumn);
      params.append('filter_type', textFilterType);
      if (['equals', 'contains', 'starts_with', 'ends_with', 'not_equals'].includes(textFilterType)) params.append('value', textFilterValue);
      else if (textFilterType === 'between') { params.append('value', textFilterValue); params.append('value2', textFilterValue2); }
      else if (textFilterType === 'in') textFilterValues.forEach(val => params.append('values', val));
      const apiUrl = `http://127.0.0.1:8000/text-filter/?${params.toString()}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        showToast('success', `Preview ready: ${getTextFilterDescription()}`);
        setCurrentFilterType('text_filter');
        await fetchFilterPreview();
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to apply text filter: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to apply text filter. Please check your connection.');
    } finally {
      setIsApplyingTextFilter(false);
    }
  };

  const getTextFilterDescription = () => {
    const filterLabels: { [key: string]: string } = {
      'equals': `equals "${textFilterValue}"`, 'contains': `contains "${textFilterValue}"`,
      'starts_with': `starts with "${textFilterValue}"`, 'ends_with': `ends with "${textFilterValue}"`,
      'not_equals': `not equals "${textFilterValue}"`, 'between': `between "${textFilterValue}" and "${textFilterValue2}"`,
      'in': `in [${textFilterValues.join(', ')}]`, 'empty': 'is empty', 'not_empty': 'is not empty'
    };
    return `${textFilterColumn} ${filterLabels[textFilterType] || textFilterType}`;
  };

  const [numberFilterColumn, setNumberFilterColumn] = useState<string>('');
  const [numberFilterType, setNumberFilterType] = useState<string>('equals');
  const [numberFilterValue, setNumberFilterValue] = useState<string>('');
  const [numberFilterValue2, setNumberFilterValue2] = useState<string>('');
  const [numberFilterValues, setNumberFilterValues] = useState<string[]>([]);
  const [isApplyingNumberFilter, setIsApplyingNumberFilter] = useState(false);

  const handleNumberFilter = async () => {
    if (!selectedDataset || !numberFilterColumn || !numberFilterType) { showToast('warning', 'Please select a column and filter type'); return; }
    if (['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'].includes(numberFilterType) && !numberFilterValue) { showToast('warning', 'Please enter a filter value'); return; }
    if (numberFilterType === 'between' && (!numberFilterValue || !numberFilterValue2)) { showToast('warning', 'Please enter both values for "between" filter'); return; }
    if (numberFilterType === 'in' && numberFilterValues.length === 0) { showToast('warning', 'Please enter at least one value for "in" filter'); return; }
    setIsApplyingNumberFilter(true);
    try {
      const params = new URLSearchParams();
      params.append('file_name', selectedDataset.name);
      params.append('column', numberFilterColumn);
      params.append('filter_type', numberFilterType);
      if (['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'].includes(numberFilterType)) params.append('value', numberFilterValue);
      else if (numberFilterType === 'between') { params.append('value', numberFilterValue); params.append('value2', numberFilterValue2); }
      else if (numberFilterType === 'in') numberFilterValues.forEach(val => params.append('values', val));
      const apiUrl = `http://127.0.0.1:8000/number-filter/?${params.toString()}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        showToast('success', `Preview ready: ${getNumberFilterDescription()}`);
        setCurrentFilterType('number_filter');
        await fetchFilterPreview();
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to apply number filter: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to apply number filter. Please check your connection.');
    } finally {
      setIsApplyingNumberFilter(false);
    }
  };

  const getNumberFilterDescription = () => {
    const filterLabels: { [key: string]: string } = {
      'equals': `equals ${numberFilterValue}`, 'not_equals': `not equals ${numberFilterValue}`,
      'greater_than': `> ${numberFilterValue}`, 'less_than': `< ${numberFilterValue}`,
      'greater_than_or_equal': `>= ${numberFilterValue}`, 'less_than_or_equal': `<= ${numberFilterValue}`,
      'between': `between ${numberFilterValue} and ${numberFilterValue2}`,
      'in': `in [${numberFilterValues.join(', ')}]`, 'empty': 'is empty', 'not_empty': 'is not empty'
    };
    return `${numberFilterColumn} ${filterLabels[numberFilterType] || numberFilterType}`;
  };

  const [isUndoing, setIsUndoing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  interface HistoryItem { track_id: string; note: string; }
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [databaseTables, setDatabaseTables] = useState<string[]>([]);
  const [showTablesDropdown, setShowTablesDropdown] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tablesDropdownPosition, setTablesDropdownPosition] = useState({ top: 0, left: 0 });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState<UploadedDataset | null>(null);
  const [hasTransformations, setHasTransformations] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [isSelectingColumns, setIsSelectingColumns] = useState(false);

  const toggleColumnSelection = (columnName: string) => {
    setSelectedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnName)) newSet.delete(columnName); else newSet.add(columnName);
      return newSet;
    });
  };

  const selectAllColumns = () => {
    if (!selectedDataset) return;
    setSelectedColumns(new Set(getColumnHeaders(selectedDataset)));
  };

  const deselectAllColumns = () => setSelectedColumns(new Set());
  const areAllColumnsSelected = () => {
    if (!selectedDataset) return false;
    const allColumns = getColumnHeaders(selectedDataset);
    return allColumns.length > 0 && selectedColumns.size === allColumns.length;
  };
  const toggleSelectAll = () => areAllColumnsSelected() ? deselectAllColumns() : selectAllColumns();

  useEffect(() => {
    fetchDatasetsFromAPI();
    fetchPromptDatasets();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showTablesDropdown && !target.closest('.tables-dropdown-container')) setShowTablesDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTablesDropdown]);

  const getFileTypeFromName = (filename: string): FileType => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'xlsx' || ext === 'xls') return 'excel';
    if (ext === 'json') return 'json';
    return 'csv';
  };

  // =============================================
  // FETCH PROMPT/SAVED DATASETS
  // =============================================
  const fetchPromptDatasets = async () => {
    setLoadingPromptDatasets(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/prompt/list/', {
        method: 'GET',
        headers: { "X-API-Key": EXCEL_API_KEY }
      });
      if (response.ok) {
        const data = await response.json();
        setPromptDatasets(data.files || []);
      } else {
        console.error('Failed to fetch prompt datasets');
      }
    } catch (error) {
      console.error('Error fetching prompt datasets:', error);
    } finally {
      setLoadingPromptDatasets(false);
    }
  };

  const handleDeletePromptDataset = async () => {
    if (!promptDatasetToDelete) return;
    setIsDeletingPrompt(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/prompt/delete/?file_name=${encodeURIComponent(promptDatasetToDelete.file_name)}`,
        { method: 'DELETE', headers: { "X-API-Key": EXCEL_API_KEY } }
      );
      if (res.ok) {
        showToast('success', `"${promptDatasetToDelete.file_name}" deleted successfully`);
        setDeletePromptModalOpen(false);
        setPromptDatasetToDelete(null);
        await fetchPromptDatasets();
      } else {
        showToast('error', `Delete failed: ${await res.text()}`);
      }
    } catch {
      showToast('error', 'Failed to delete saved dataset');
    } finally {
      setIsDeletingPrompt(false);
    }
  };

  // =============================================
  // HANDLE SAVE AS - opens the Save As modal
  // =============================================
  const openSaveAsModal = () => {
    if (!selectedDataset) return;
    // Pre-fill with dataset name (without extension) + "_filtered"
    const baseName = selectedDataset.name.replace(/\.[^/.]+$/, '');
    setSaveAsFileName(`${baseName}_filtered`);
    setShowSaveAsModal(true);
  };

  const handleSaveAs = async () => {
    if (!selectedDataset || !saveAsFileName.trim()) {
      showToast('warning', 'Please enter a file name');
      return;
    }

    setIsSavingAs(true);
    console.log('💾 Saving filtered dataset as:', saveAsFileName.trim());

    try {
      const url = `http://127.0.0.1:8000/save-filtered-to-prompt/?source_file=${encodeURIComponent(selectedDataset.name)}&new_file=${encodeURIComponent(saveAsFileName.trim())}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          "X-API-Key": EXCEL_API_KEY,
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Saved As successful:', result);

        showToast('success', `Dataset saved as "${saveAsFileName.trim()}" successfully! ✅`);

        // Close Save As modal
        setShowSaveAsModal(false);
        setSaveAsFileName('');

        // Exit preview mode
        setIsPreviewMode(false);
        setPreviewData(null);
        setCurrentFilterType(null);
        setSelectedTransformation(null);
        resetFilterForms();

        // Refresh prompt datasets list and switch to Saved tab
        await fetchPromptDatasets();
        setActiveTab('saved');

      } else {
        const errorText = await response.text();
        console.error('❌ Save As failed:', errorText);
        showToast('error', `Failed to save: ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error saving as:', error);
      showToast('error', 'Failed to save dataset. Please check your connection.');
    } finally {
      setIsSavingAs(false);
    }
  };

  const fetchDatabaseTables = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const buttonRect = event.currentTarget.getBoundingClientRect();
    setTablesDropdownPosition({ top: buttonRect.bottom + 8, left: buttonRect.left });
    setLoadingTables(true);
    setShowTablesDropdown(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/tables/?schema=public', { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (!response.ok) throw new Error(`API returned status ${response.status}`);
      const data = await response.json();
      const tables = data.tables || [];
      setDatabaseTables(tables);
      showToast('success', `Loaded ${tables.length} tables from database`);
    } catch (error) {
      showToast('error', 'Failed to load database tables');
      setShowTablesDropdown(false);
    } finally {
      setLoadingTables(false);
    }
  };

  const viewTableData = async (tableName: string) => {
    setShowTablesDropdown(false);
    const tableDataset: UploadedDataset = {
      id: `table-${tableName}-${Date.now()}`, name: tableName, type: 'csv',
      uploadDate: new Date(), rows: 0, columns: 0, size: 0,
      previewData: [], fullData: [], columnHeaders: [], file: tableName
    };
    await openTableViewer(tableDataset);
  };

  const openTableViewer = async (dataset: UploadedDataset) => {
    try {
      setIsViewerOpen(true);
      setSelectedDataset({ ...dataset, fullData: [] });
      const apiUrl = `http://127.0.0.1:8000/load-table/?table_name=${encodeURIComponent(dataset.name)}&schema=public`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const fullDataResponse = await response.json();
        const fullData = fullDataResponse.preview || fullDataResponse.data || [];
        const columnHeaders = fullDataResponse.columns || [];
        const rows = fullDataResponse.rows || fullData.length;
        setSelectedDataset({ ...dataset, fullData, rows, columns: columnHeaders.length, columnHeaders });
        showToast('success', `Table loaded: ${rows} rows × ${columnHeaders.length} columns`);
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to load table: ${errorText}`);
        setIsViewerOpen(false);
      }
    } catch (error) {
      showToast('error', 'Failed to load table data');
      setIsViewerOpen(false);
    }
  };

  const fetchDatasetsFromAPI = async () => {
    setLoadingDatasets(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/list-uploads/', { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (!response.ok) throw new Error(`API returned status ${response.status}`);
      const apiData = await response.json();
      const fileNames = apiData.files || [];
      const datasetsFromAPI: UploadedDataset[] = Array.isArray(fileNames) ? fileNames.map((filename: string, index: number) => ({
        id: `dataset-${index}-${Date.now()}`, name: filename, type: getFileTypeFromName(filename),
        uploadDate: new Date(), rows: 0, columns: 0, size: 0, previewData: [], fullData: [], columnHeaders: [], file: filename
      })) : [];
      setUploadedDatasets(datasetsFromAPI);
    } catch (error) {
      showToast('error', `Failed to load datasets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUploadedDatasets([]);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const openFileTypeModal = () => { setShowDatasetModal(true); setSelectedUploadType(null); setSelectedFile(null); };
  const selectUploadType = (fileType: FileType) => setSelectedUploadType(fileType);
  const closeDatasetModal = () => { setShowDatasetModal(false); setSelectedUploadType(null); setSelectedFile(null); };
  const openModal = (fileType: FileType) => { setSelectedFileType(fileType); setIsModalOpen(true); setUploadedFile(null); };
  const closeModal = () => { setIsModalOpen(false); setSelectedFileType(null); setUploadedFile(null); setIsDragging(false); setIsUploading(false); };

  const openViewer = async (dataset: UploadedDataset) => {
    try {
      setIsViewerOpen(true);
      setSelectedDataset({ ...dataset, fullData: [] });
      const encodedFilename = encodeURIComponent(dataset.name);
      const apiUrl = `http://127.0.0.1:8000/view-data/?file_name=${encodedFilename}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const fullDataResponse = await response.json();
        const fullData = fullDataResponse.data || [];
        const columnHeaders = fullDataResponse.columns || [];
        const rows = fullDataResponse.rows || fullData.length;
        setSelectedDataset({ ...dataset, fullData, rows, columns: columnHeaders.length, columnHeaders });
        await checkTransformationHistory(dataset.name);
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to load dataset: ${errorText}`);
        setIsViewerOpen(false);
      }
    } catch (error) {
      showToast('error', 'Failed to load dataset. Please check your connection.');
      setIsViewerOpen(false);
    }
  };

  // Open a saved (prompt) dataset in the viewer
  // Open a saved (prompt) dataset in the viewer
  const openPromptDatasetViewer = async (promptDataset: PromptDataset) => {
    try {
      setIsViewerOpen(true);

      // Create a base dataset object with the metadata
      const dataset: UploadedDataset = {
        id: `prompt-${promptDataset.file_name}-${Date.now()}`,
        name: promptDataset.file_name,
        type: 'csv', // Default type
        uploadDate: new Date(),
        rows: promptDataset.rows,
        columns: promptDataset.column_count,
        size: 0,
        previewData: [],
        fullData: [],
        columnHeaders: promptDataset.columns,
        file: promptDataset.file_name
      };

      setSelectedDataset({ ...dataset, fullData: [] });

      // Use the prompt/select/ endpoint to get the full data
      const apiUrl = `http://127.0.0.1:8000/prompt/select/?file_name=${encodeURIComponent(promptDataset.file_name)}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { "X-API-Key": EXCEL_API_KEY }
      });

      if (response.ok) {
        const result = await response.json();

        // The response contains both preview and full_data
        const fullData = result.full_data || result.preview || [];
        const columnHeaders = result.columns || [];
        const rows = result.rows || fullData.length;

        setSelectedDataset({
          ...dataset,
          fullData,
          rows,
          columns: columnHeaders.length,
          columnHeaders
        });

        showToast('success', `Saved dataset loaded: ${rows} rows × ${columnHeaders.length} columns`);
      } else {
        // Fallback to view-data if prompt endpoint fails
        const fallbackUrl = `http://127.0.0.1:8000/view-data/?file_name=${encodeURIComponent(promptDataset.file_name)}`;
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: { "X-API-Key": EXCEL_API_KEY }
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const fullData = fallbackData.data || [];
          const columnHeaders = fallbackData.columns || [];
          const rows = fallbackData.rows || fullData.length;

          setSelectedDataset({
            ...dataset,
            fullData,
            rows,
            columns: columnHeaders.length,
            columnHeaders
          });

          showToast('success', `Saved dataset loaded: ${rows} rows × ${columnHeaders.length} columns`);
        } else {
          const errorText = await fallbackResponse.text();
          showToast('error', `Failed to load saved dataset: ${errorText}`);
          setIsViewerOpen(false);
        }
      }
    } catch (error) {
      console.error('Error loading saved dataset:', error);
      showToast('error', 'Failed to load saved dataset. Please check your connection.');
      setIsViewerOpen(false);
    }
  };


  const checkTransformationHistory = async (fileName: string) => {
    try {
      const apiUrl = `http://127.0.0.1:8000/history/?file_name=${encodeURIComponent(fileName)}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const result = await response.json();
        const history = result.history || [];
        setHasTransformations(history.length > 0);
      }
    } catch (error) {
      console.error('Error checking transformation history:', error);
    }
  };

  const fetchDateSummary = async () => {
    if (!selectedDataset || !dateColumn) { showToast('warning', 'Please select a date column'); return; }
    setIsLoadingDateSummary(true);
    try {
      const apiUrl = `http://127.0.0.1:8000/filter-by-date/?file_name=${encodeURIComponent(selectedDataset.name)}&date_column=${encodeURIComponent(dateColumn)}&flat_list=false`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const result = await response.json();
        const summary = result.unique_dates_summary || {};
        const years = Object.keys(summary).map(y => parseInt(y)).sort((a, b) => b - a);
        const uniqueDaysCount = result.unique_days_count || 31;
        const days = Array.from({ length: uniqueDaysCount }, (_, i) => i + 1);
        setAvailableYears(years);
        setAvailableMonths(summary);
        setAvailableDays(days);
        setDateSummaryLoaded(true);
        showToast('success', `Found data from ${years.length} year(s)`);
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to load date information: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to load date information. Please check your connection.');
    } finally {
      setIsLoadingDateSummary(false);
    }
  };

  const getDateColumns = (dataset: UploadedDataset): string[] => {
    const headers = getColumnHeaders(dataset);
    return headers.filter(header => {
      const lowerHeader = header.toLowerCase();
      return lowerHeader.includes('date') || lowerHeader.includes('time') ||
        lowerHeader.includes('datetime') || lowerHeader.includes('day') ||
        lowerHeader.includes('month') || lowerHeader.includes('year');
    });
  };

  const toggleFilterValue = (value: any) => {
    const newSet = new Set(selectedFilterValues);
    if (newSet.has(value)) newSet.delete(value); else newSet.add(value);
    setSelectedFilterValues(newSet);
  };

  const selectAllFilterValues = () => {
    if (!uniqueValuesData) return;
    const filteredValues = uniqueValuesData.unique_values.filter((value: any) =>
      String(value).toLowerCase().includes(uniqueValuesSearchTerm.toLowerCase())
    );
    const newSet = new Set(selectedFilterValues);
    filteredValues.forEach((value: any) => newSet.add(value));
    setSelectedFilterValues(newSet);
  };

  const deselectAllFilterValues = () => setSelectedFilterValues(new Set());

  const getFilteredUniqueValues = () => {
    if (!uniqueValuesData) return [];
    if (!uniqueValuesSearchTerm) return uniqueValuesData.unique_values;
    return uniqueValuesData.unique_values.filter((value: any) =>
      String(value).toLowerCase().includes(uniqueValuesSearchTerm.toLowerCase())
    );
  };

  const fetchFilterPreview = async () => {
    if (!selectedDataset) return;
    try {
      const apiUrl = `http://127.0.0.1:8000/get-current-filtered/?file_name=${encodeURIComponent(selectedDataset.name)}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const result = await response.json();
        setPreviewData(result);
        setIsPreviewMode(true);
        const filteredData = result.preview || result.data || [];
        const columnHeaders = result.columns || selectedDataset.columnHeaders || [];
        const rows = result.rows || filteredData.length;
        setSelectedDataset({ ...selectedDataset, fullData: filteredData, rows, columns: columnHeaders.length, columnHeaders });
        showToast('success', `Preview loaded: ${rows} rows displayed (${result.dropped_rows || 0} filtered out)`);
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to load preview: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to load preview. Please check your connection.');
    }
  };

  const saveCurrentFilter = async () => {
    if (!selectedDataset) return;
    setIsSavingFilter(true);
    try {
      const saveApiUrl = `http://127.0.0.1:8000/save-filter/?file_name=${encodeURIComponent(selectedDataset.name)}`;
      const saveResponse = await fetch(saveApiUrl, { method: 'POST', headers: { "X-API-Key": EXCEL_API_KEY, "Content-Type": "application/json" } });
      if (saveResponse.ok) {
        showToast('success', 'All changes saved successfully! ✅');
        setHasTransformations(true);
        setIsPreviewMode(false);
        setPreviewData(null);
        setCurrentFilterType(null);
        setSelectedTransformation(null);
        resetFilterForms();
        await refreshSavedDataset();
      } else {
        const saveError = await saveResponse.text();
        showToast('error', `Failed to save changes: ${saveError}`);
      }
    } catch (error) {
      showToast('error', 'Failed to save changes. Please check your connection.');
    } finally {
      setIsSavingFilter(false);
    }
  };

  const refreshSavedDataset = async () => {
    if (!selectedDataset) return;
    try {
      const encodedFilename = encodeURIComponent(selectedDataset.name);
      const apiUrl = `http://127.0.0.1:8000/view-data/?file_name=${encodedFilename}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const fullDataResponse = await response.json();
        const fullData = fullDataResponse.data || [];
        const columnHeaders = fullDataResponse.columns || [];
        const rows = fullDataResponse.rows || fullData.length;
        setSelectedDataset({ ...selectedDataset, fullData, rows, columns: columnHeaders.length, columnHeaders });
        showToast('info', `Dataset updated: ${rows} rows`);
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  const cancelFilterPreview = async () => {
    if (!selectedDataset) return;
    try {
      const encodedFilename = encodeURIComponent(selectedDataset.name);
      const apiUrl = `http://127.0.0.1:8000/view-data/?file_name=${encodedFilename}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const fullDataResponse = await response.json();
        const fullData = fullDataResponse.data || [];
        const columnHeaders = fullDataResponse.columns || [];
        const rows = fullDataResponse.rows || fullData.length;
        setSelectedDataset({ ...selectedDataset, fullData, rows, columns: columnHeaders.length, columnHeaders });
      }
      setIsPreviewMode(false);
      setPreviewData(null);
      setCurrentFilterType(null);
      setSortColumn(null);
      setSortOrder('asc');
      resetFilterForms();
      showToast('info', 'Preview cancelled - showing last saved state');
    } catch (error) {
      showToast('error', 'Failed to cancel preview');
    }
  };

  const resetFilterForms = () => {
    setGroupByColumns([]); setAggregateColumn(''); setAggregateFunction('');
    setDateColumn(''); setSelectedYears([]); setSelectedMonths([]); setSelectedDays([]);
    setDateSummaryLoaded(false); setFilterColumn(''); setSelectedFilterValues(new Set());
    setUniqueValuesLoaded(false); setUniqueValuesData(null); setUniqueValuesSearchTerm('');
    setTextFilterColumn(''); setTextFilterType('equals'); setTextFilterValue('');
    setTextFilterValue2(''); setTextFilterValues([]); setNumberFilterColumn('');
    setNumberFilterType('equals'); setNumberFilterValue(''); setNumberFilterValue2('');
    setNumberFilterValues([]);
  };

  const closeViewer = () => {
    setSelectedDataset(null); setIsViewerOpen(false); setIsEditPanelOpen(false);
    setSelectedTransformation(null); setRenameOldColumn(''); setRenameNewColumn('');
    setTypeCastColumn(''); setTypeCastNewType(''); setHistoryData([]);
    setHasTransformations(false); setGroupByColumns([]); setAggregateColumn('');
    setAggregateFunction(''); setDateColumn(''); setSelectedYears([]);
    setSelectedMonths([]); setSelectedDays([]); setDateSummaryLoaded(false);
    setIsPreviewMode(false); setPreviewData(null); setCurrentFilterType(null);
  };

  const toggleEditPanel = () => {
    setIsEditPanelOpen(!isEditPanelOpen); setSelectedTransformation(null);
    setRenameOldColumn(''); setRenameNewColumn(''); setTypeCastColumn('');
    setTypeCastNewType(''); setHistoryData([]);
  };

  const fetchHistory = async () => {
    if (!selectedDataset) return;
    setIsLoadingHistory(true);
    try {
      const apiUrl = `http://127.0.0.1:8000/history/?file_name=${encodeURIComponent(selectedDataset.name)}`;
      const response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const result = await response.json();
        const history = result.history || [];
        setHistoryData(history);
        setHasTransformations(history.length > 0);
        if (history.length === 0) showToast('info', 'No transformation history found for this dataset');
        else showToast('success', `Loaded ${history.length} transformation(s)`);
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to load history: ${errorText}`);
        setHistoryData([]); setHasTransformations(false);
      }
    } catch (error) {
      showToast('error', 'Failed to load history. Please check your connection.');
      setHistoryData([]); setHasTransformations(false);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUndo = async () => {
    if (!selectedDataset) return;
    setIsUndoing(true);
    try {
      const apiUrl = `http://127.0.0.1:8000/undo-latest/?file_name=${encodeURIComponent(selectedDataset.name)}`;
      let response = await fetch(apiUrl, { method: 'POST', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(apiUrl, { method: 'PUT', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(apiUrl, { method: 'PATCH', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(apiUrl, { method: 'DELETE', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.status === 405) response = await fetch(apiUrl, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        const result = await response.json();
        showToast('success', result.message || 'Last transformation undone successfully');
        await refreshCurrentDataset();
        if (selectedTransformation === 'get_history') await fetchHistory();
      } else if (response.status === 404) {
        showToast('info', 'No transformations to undo');
      } else {
        const errorText = await response.text();
        showToast('error', `Failed to undo: ${errorText}`);
      }
    } catch (error) {
      showToast('error', 'Failed to undo transformation. Please check your connection.');
    } finally {
      setIsUndoing(false);
    }
  };

  const handleReset = async () => {
    if (!selectedDataset) return;
    setIsResetting(true);
    try {
      const endpointVariations = [
        `http://127.0.0.1:8000/reset-to-original/?file_name=${encodeURIComponent(selectedDataset.name)}`,
        `http://127.0.0.1:8000/reset/?file_name=${encodeURIComponent(selectedDataset.name)}`,
        `http://127.0.0.1:8000/reset-dataset/?file_name=${encodeURIComponent(selectedDataset.name)}`,
        `http://127.0.0.1:8000/revert/?file_name=${encodeURIComponent(selectedDataset.name)}`
      ];
      let response = null;
      let successfulEndpoint = '';
      for (const endpoint of endpointVariations) {
        response = await fetch(endpoint, { method: 'POST', headers: { "X-API-Key": EXCEL_API_KEY } });
        if (response.ok) { successfulEndpoint = endpoint; break; }
        if (response.status === 405) {
          response = await fetch(endpoint, { method: 'GET', headers: { "X-API-Key": EXCEL_API_KEY } });
          if (response.ok) { successfulEndpoint = endpoint; break; }
        }
        if (response.status === 405) {
          response = await fetch(endpoint, { method: 'PUT', headers: { "X-API-Key": EXCEL_API_KEY } });
          if (response.ok) { successfulEndpoint = endpoint; break; }
        }
      }
      if (response && response.ok) {
        let result;
        try { result = await response.json(); } catch { result = { message: 'Reset successful' }; }
        showToast('success', result.message || 'Dataset reset to original successfully');
        setHasTransformations(false);
        await refreshCurrentDataset();
        if (selectedTransformation === 'get_history') await fetchHistory();
        setShowResetModal(false);
      } else {
        const errorText = response ? await response.text() : 'Network error';
        if (response && response.status === 404) showToast('info', 'Reset endpoint not found or dataset is already in original state');
        else showToast('error', `Reset failed: ${errorText}`);
      }
    } catch (error) {
      showToast('error', `Failed to reset dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  const getAcceptedFileTypes = (type: FileType) => {
    switch (type) {
      case 'csv': return '.csv';
      case 'excel': return '.xlsx,.xls';
      case 'json': return '.json';
      default: return '';
    }
  };

  const handleDatasetFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) { showToast('error', 'File size exceeds 10MB limit'); event.target.value = ''; setSelectedFile(null); return; }
      const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'];
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls|json)$/i)) {
        showToast('error', 'Please select a CSV, Excel, or JSON file'); event.target.value = ''; setSelectedFile(null); return;
      }
    }
    setSelectedFile(file);
  };

  const handleDatasetUpload = async () => {
    if (!selectedFile || !selectedUploadType) { showToast('warning', 'Please select a file type and file to upload'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      let apiUrl = '';
      switch (selectedUploadType) {
        case 'csv': apiUrl = 'http://127.0.0.1:8000/upload-csv/'; break;
        case 'excel': apiUrl = 'http://127.0.0.1:8000/upload-excel/'; break;
        case 'json': apiUrl = 'http://127.0.0.1:8000/upload-json/'; break;
        default: throw new Error('Unsupported file type');
      }
      const response = await fetch(apiUrl, { method: 'POST', body: formData, headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) {
        closeDatasetModal();
        showToast('success', `Dataset "${selectedFile.name}" uploaded successfully!`);
        setTimeout(() => fetchDatasetsFromAPI(), 500);
      } else {
        const errorText = await response.text();
        showToast('error', `Upload failed: ${errorText}`);
      }
    } catch (error) {
      showToast('error', `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDataset = async (dataset: UploadedDataset, event: React.MouseEvent) => {
    event.stopPropagation();
    setDatasetToDelete(dataset);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!datasetToDelete) return;
    try {
      const filename = encodeURIComponent(datasetToDelete.name);
      const response = await fetch(`http://127.0.0.1:8000/delete-upload/?file_name=${filename}`, { method: 'DELETE', headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response.ok) { showToast('success', 'Dataset deleted successfully!'); fetchDatasetsFromAPI(); }
      else { const errorText = await response.text(); showToast('error', `Delete failed: ${errorText}`); }
    } catch (error) {
      showToast('error', 'Failed to delete dataset');
    } finally {
      setDeleteModalOpen(false); setDatasetToDelete(null);
    }
  };

  const cancelDelete = () => { setDeleteModalOpen(false); setDatasetToDelete(null); };

  const getFileIcon = (type: FileType) => {
    switch (type) {
      case 'csv': return <FileText className="w-6 h-6 text-blue-600" />;
      case 'excel': return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
      case 'json': return <FileJson className="w-6 h-6 text-purple-600" />;
      default: return <Upload className="w-6 h-6 text-gray-600" />;
    }
  };

  const formatDate = (date: Date | string): string => {
    if (!date) return 'Unknown';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return 'Invalid Date'; }
  };

  const getColumnHeaders = (dataset: UploadedDataset): string[] => {
    if (dataset.columnHeaders && dataset.columnHeaders.length > 0) return dataset.columnHeaders;
    if (!dataset.fullData || dataset.fullData.length === 0) return Array.from({ length: dataset.columns }, (_, i) => `Column ${i + 1}`);
    if (Array.isArray(dataset.fullData[0])) return dataset.fullData[0].map((_: any, index: number) => `Column ${index + 1}`);
    return Object.keys(dataset.fullData[0]);
  };

  const transformationOptions = [
    { id: 'rename_column', label: 'Rename Column', icon: <Type className="h-5 w-5" />, color: 'green' },
    { id: 'type_cast', label: 'Type Cast', icon: <FileText className="h-5 w-5" />, color: 'purple' },
    { id: 'group_and_aggregate', label: 'Group & Aggregate', icon: <Database className="h-5 w-5" />, color: 'orange' },
    { id: 'filter_by_date', label: 'Filter by Date', icon: <Calendar className="h-5 w-5" />, color: 'pink' },
    { id: 'get_history', label: 'Get History', icon: <History className="h-5 w-5" />, color: 'gray' },
    { id: 'filter_by_values', label: 'Filter by Values', icon: <Filter className="h-5 w-5" />, color: 'indigo' },
    { id: 'text_filter', label: 'Text Filter', icon: <Type className="h-5 w-5" />, color: 'blue' },
    { id: 'number_filter', label: 'Number Filter', icon: <Hash className="h-5 w-5" />, color: 'teal' }
  ];

  return (
    <div>
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${getToastColor(toast.type)} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px] animate-slide-in`}>
            <div className="flex-shrink-0">{getToastIcon(toast.type)}</div>
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="flex-shrink-0 hover:bg-white/20 rounded p-1 transition-colors"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">External Datasets</h1>
          <div className="flex space-x-3">
            <div className="relative tables-dropdown-container">
              <button onClick={fetchDatabaseTables} className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center space-x-2 shadow-sm transition-colors duration-150 hover:bg-purple-700">
                <Table className="h-4 w-4" />
                <span>View Tables</span>
                {loadingTables && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              </button>
              {showTablesDropdown && (
                <div className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-200 z-50 w-80 max-h-96 overflow-hidden flex flex-col" style={{ top: `${tablesDropdownPosition.top}px`, left: `${tablesDropdownPosition.left}px` }}>
                  <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-purple-100 border-b border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-purple-600" />
                        <h3 className="text-sm font-bold text-gray-900">Database Tables</h3>
                      </div>
                      <button onClick={() => setShowTablesDropdown(false)} className="text-gray-500 hover:text-gray-700 p-1 hover:bg-white/50 rounded transition-colors"><X className="h-4 w-4" /></button>
                    </div>
                    {databaseTables.length > 0 && <p className="text-xs text-gray-600 mt-1">{databaseTables.length} tables found</p>}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {loadingTables ? (
                      <div className="flex flex-col items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-green-600 mb-2" /><p className="text-sm text-gray-600">Loading tables...</p></div>
                    ) : databaseTables.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8"><Database className="h-12 w-12 text-gray-300 mb-2" /><p className="text-sm text-gray-600">No tables found</p></div>
                    ) : (
                      <div className="py-2">
                        {databaseTables.map((tableName, index) => (
                          <button key={index} onClick={() => viewTableData(tableName)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0 group">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors"><Table className="h-4 w-4 text-purple-600" /></div>
                            <div className="flex-1 text-left"><p className="text-sm font-medium text-gray-900 group-hover:text-purple-600 transition-colors">{tableName}</p><p className="text-xs text-gray-500">Click to view data</p></div>
                            <Eye className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={openFileTypeModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center space-x-2 shadow-sm transition-colors duration-150 hover:bg-blue-700">
              <Plus className="h-4 w-4" /><span>Upload Dataset</span>
            </button>
          </div>
        </div>

        {/* ============================================= */}
        {/* TABS - Uploaded / Saved */}
        {/* ============================================= */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-0" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('uploaded')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${activeTab === 'uploaded'
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Database className="h-4 w-4" />
              Uploaded Datasets
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'uploaded' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {uploadedDatasets.length}
              </span>
            </button>
            <button
              onClick={() => { setActiveTab('saved'); fetchPromptDatasets(); }}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 flex items-center gap-2 ${activeTab === 'saved'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <BookMarked className="h-4 w-4" />
              Saved Datasets
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'saved' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {promptDatasets.length}
              </span>
            </button>
          </nav>
        </div>

        {/* ============================================= */}
        {/* TAB CONTENT - UPLOADED DATASETS */}
        {/* ============================================= */}
        {activeTab === 'uploaded' && (
          <div className="mt-2">
            {loadingDatasets ? (
              <div className="flex flex-col justify-center items-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                <span className="text-lg text-gray-600">Loading datasets...</span>
              </div>
            ) : uploadedDatasets.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
                <Database className="h-16 w-16 text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg font-medium">No datasets uploaded yet</p>
                <p className="text-gray-500 text-sm mt-2">Click "Upload Dataset" to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {uploadedDatasets.map((dataset) => (
                  <div key={dataset.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-blue-400 overflow-hidden group">
                    <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0">{getFileIcon(dataset.type)}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-gray-900 truncate" title={dataset.name}>{dataset.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">{dataset.type.toUpperCase()} File</p>
                          </div>
                        </div>
                        <button onClick={(e) => handleDeleteDataset(dataset, e)} className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete dataset">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs text-blue-600 font-medium mb-1">Uploaded</p>
                        <p className="text-xs text-gray-700 font-semibold">{formatDate(dataset.uploadDate)}</p>
                      </div>
                      <button onClick={() => openViewer(dataset)} className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 transition-colors duration-200 font-medium shadow-sm group-hover:shadow-md">
                        <Eye className="h-4 w-4" /><span>View Dataset</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================= */}
        {/* TAB CONTENT - SAVED DATASETS */}
        {/* ============================================= */}
        {activeTab === 'saved' && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-4">
              {/* <p className="text-sm text-gray-600">Datasets saved via "Save As" from filtered/transformed data</p> */}
              <button onClick={fetchPromptDatasets} disabled={loadingPromptDatasets} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 text-gray-600 ${loadingPromptDatasets ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingPromptDatasets ? (
              <div className="flex flex-col justify-center items-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mb-4" />
                <span className="text-lg text-gray-600">Loading saved datasets...</span>
              </div>
            ) : promptDatasets.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-64 border-2 border-dashed border-emerald-300 rounded-lg bg-emerald-50">
                <BookMarked className="h-16 w-16 text-emerald-400 mb-4" />
                <p className="text-gray-600 text-lg font-medium">No saved datasets yet</p>
                <p className="text-gray-500 text-sm mt-2">Apply filters to a dataset, then use "Save As" in Preview Mode</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {promptDatasets.map((dataset, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border-2 border-gray-200 hover:border-emerald-400 overflow-hidden group">
                    <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-white">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 p-1.5 bg-emerald-100 rounded-lg">
                            <BookMarked className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-gray-900 truncate" title={dataset.file_name}>{dataset.file_name}</h3>
                            <p className="text-xs text-emerald-600 font-medium mt-0.5">Saved from: {dataset.created_from}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setPromptDatasetToDelete(dataset); setDeletePromptModalOpen(true); }}
                          className="ml-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      {/* <div className="grid grid-cols-2 gap-2">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-xs text-blue-600 font-medium mb-1">Rows</p>
                          <p className="text-lg font-bold text-blue-900">{dataset.rows.toLocaleString()}</p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <p className="text-xs text-purple-600 font-medium mb-1">Columns</p>
                          <p className="text-lg font-bold text-purple-900">{dataset.column_count}</p>
                        </div>
                      </div> */}
                      {/* Column names preview */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        {/* <p className="text-xs text-gray-600 font-medium mb-2">Columns:</p>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                          {dataset.columns.slice(0, 6).map((col, colIdx) => (
                            <span key={colIdx} className="px-2 py-0.5 bg-white text-xs text-gray-700 rounded border border-gray-200 truncate max-w-[80px]" title={col}>{col}</span>
                          ))}
                          {dataset.columns.length > 6 && (
                            <span className="px-2 py-0.5 bg-gray-200 text-xs text-gray-600 rounded">+{dataset.columns.length - 6} more</span>
                          )}
                        </div> */}
                      </div>
                      <button onClick={() => openPromptDatasetViewer(dataset)} className="w-full mt-2 px-4 py-3 bg-emerald-600 text-white rounded-lg flex items-center justify-center space-x-2 hover:bg-emerald-700 transition-colors duration-200 font-medium shadow-sm group-hover:shadow-md">
                        <Eye className="h-4 w-4" /><span>View Dataset</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* File Type Selection Modal */}
        {showDatasetModal && !selectedUploadType && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Select File Type</h3>
                  <button onClick={closeDatasetModal} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button onClick={() => selectUploadType('csv')} className="group relative bg-white hover:bg-gray-50 rounded-xl p-6 border-2 border-gray-300 hover:border-blue-500 transition-all duration-300 hover:shadow-xl hover:scale-105">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg"><FileText className="w-8 h-8 text-white" /></div>
                      <div className="text-center"><h3 className="text-lg font-bold text-gray-900 mb-1">CSV File</h3><p className="text-sm text-gray-600">Upload comma-separated values</p></div>
                    </div>
                  </button>
                  <button onClick={() => selectUploadType('excel')} className="group relative bg-white hover:bg-gray-50 rounded-xl p-6 border-2 border-gray-300 hover:border-green-500 transition-all duration-300 hover:shadow-xl hover:scale-105">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg"><FileSpreadsheet className="w-8 h-8 text-white" /></div>
                      <div className="text-center"><h3 className="text-lg font-bold text-gray-900 mb-1">Excel File</h3><p className="text-sm text-gray-600">Upload Excel spreadsheet</p></div>
                    </div>
                  </button>
                  <button onClick={() => selectUploadType('json')} className="group relative bg-white hover:bg-gray-50 rounded-xl p-6 border-2 border-gray-300 hover:border-purple-500 transition-all duration-300 hover:shadow-xl hover:scale-105">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg"><FileJson className="w-8 h-8 text-white" /></div>
                      <div className="text-center"><h3 className="text-lg font-bold text-gray-900 mb-1">JSON File</h3><p className="text-sm text-gray-600">Upload JSON data file</p></div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Modal */}
        {showDatasetModal && selectedUploadType && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Upload {selectedUploadType.toUpperCase()} File</h3>
                  <button onClick={closeDatasetModal} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                </div>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload {selectedUploadType.toUpperCase()} File *</label>
                  <input type="file" onChange={handleDatasetFileChange} accept={getAcceptedFileTypes(selectedUploadType)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  <p className="mt-1 text-xs text-gray-500">Supported format: {selectedUploadType.toUpperCase()} (Max 10MB)</p>
                  {selectedFile && <p className="mt-1 text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Selected: {selectedFile.name}</p>}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-xs text-blue-800"><strong>Note:</strong> The system will automatically extract and process your {selectedUploadType.toUpperCase()} dataset.</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button onClick={() => setSelectedUploadType(null)} disabled={uploading} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50">Back</button>
                <button onClick={handleDatasetUpload} disabled={uploading || !selectedFile} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                  {uploading ? (<><Loader2 className="h-4 w-4 animate-spin" /><span>Uploading...</span></>) : (<><Upload className="h-4 w-4" /><span>Upload Dataset</span></>)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && datasetToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Confirm Delete</h3>
                  <button onClick={cancelDelete} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-gray-700 font-medium">Are you sure you want to delete <span className="font-bold text-red-800">{datasetToDelete.name}</span>?</p>
                    <p className="text-sm text-gray-600 mt-1">This action cannot be undone.</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button onClick={cancelDelete} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center space-x-2">
                  <X className="h-4 w-4" /><span>Delete Dataset</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Saved Dataset Confirmation Modal */}
        {deletePromptModalOpen && promptDatasetToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Delete Saved Dataset</h3>
                  <button onClick={() => { setDeletePromptModalOpen(false); setPromptDatasetToDelete(null); }} disabled={isDeletingPrompt} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-gray-700 font-medium">Are you sure you want to delete <span className="font-bold text-red-800">"{promptDatasetToDelete.file_name}"</span>?</p>
                    <p className="text-sm text-gray-500 mt-1">This action cannot be undone.</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button onClick={() => { setDeletePromptModalOpen(false); setPromptDatasetToDelete(null); }} disabled={isDeletingPrompt} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleDeletePromptDataset} disabled={isDeletingPrompt} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 disabled:opacity-50">
                  {isDeletingPrompt
                    ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Deleting...</span></>
                    : <><Trash2 className="h-4 w-4" /><span>Delete</span></>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        {showResetModal && selectedDataset && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Confirm Reset</h3>
                  <button onClick={() => setShowResetModal(false)} className="text-gray-400 hover:text-gray-600" disabled={isResetting}><X className="h-6 w-6" /></button>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="h-8 w-8 text-orange-500 flex-shrink-0" />
                  <div>
                    <p className="text-gray-700 font-medium">Are you sure you want to reset <span className="font-bold text-orange-800">{selectedDataset.name}</span> to its original state?</p>
                    <p className="text-sm text-gray-600 mt-2">This will remove ALL transformations and cannot be undone.</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button onClick={() => setShowResetModal(false)} disabled={isResetting} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handleReset} disabled={isResetting} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isResetting ? (<><Loader2 className="h-4 w-4 animate-spin" /><span>Resetting...</span></>) : (<><RefreshCw className="h-4 w-4" /><span>Reset to Original</span></>)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================= */}
        {/* SAVE AS MODAL */}
        {/* ============================================= */}
        {showSaveAsModal && selectedDataset && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <SaveAll className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Save As New Dataset</h3>
                      <p className="text-emerald-100 text-sm">Save the filtered data with a custom name</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowSaveAsModal(false); setSaveAsFileName(''); }} className="text-white/70 hover:text-white p-1 rounded transition-colors" disabled={isSavingAs}>
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5 space-y-5">
                {/* Source Info */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 font-medium mb-1">Source Dataset</p>
                  <div className="flex items-center gap-2">
                    {getFileIcon(selectedDataset.type)}
                    <span className="text-sm font-semibold text-gray-900">{selectedDataset.name}</span>
                  </div>
                  {previewData && (
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                      <span>✅ <strong>{previewData.rows?.toLocaleString()}</strong> rows will be saved</span>
                      <span>🗑️ <strong>{previewData.dropped_rows?.toLocaleString()}</strong> filtered out</span>
                    </div>
                  )}
                </div>

                {/* File Name Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Dataset Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={saveAsFileName}
                    onChange={(e) => setSaveAsFileName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && saveAsFileName.trim()) handleSaveAs(); }}
                    placeholder="Enter a name for the saved dataset"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 font-medium"
                    autoFocus
                    disabled={isSavingAs}
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    This will be saved in the "Saved Datasets" tab. You can access it anytime.
                  </p>
                </div>

                {/* Info box */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
                  <BookMarked className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-emerald-800">
                    <p className="font-medium mb-1">What happens next?</p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-emerald-700">
                      <li>The filtered dataset is saved under your chosen name</li>
                      <li>It will appear in the <strong>Saved Datasets</strong> tab</li>
                      <li>The original dataset remains unchanged</li>
                      <li>You can save multiple versions with different names</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                <button
                  onClick={() => { setShowSaveAsModal(false); setSaveAsFileName(''); }}
                  disabled={isSavingAs}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAs}
                  disabled={isSavingAs || !saveAsFileName.trim()}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSavingAs ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /><span>Saving...</span></>
                  ) : (
                    <><SaveAll className="h-4 w-4" /><span>Save As "{saveAsFileName || '...'}"</span></>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================= */}
        {/* DATASET VIEWER MODAL - FULLSCREEN */}
        {/* ============================================= */}
        {isViewerOpen && selectedDataset && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
            {/* Viewer Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-white shadow-sm">
             <div className="flex items-center gap-4">
               {getFileIcon(selectedDataset.type)}
               <div>
                 <h3 className="text-xl font-bold text-gray-900">{selectedDataset.name}</h3>
                 <p className="text-sm text-gray-600">
                   {selectedDataset.rows > 0 ? (
                     <>
                     </>
                   ) : (
                     'Loading...'
                   )}
                 </p>
               </div>
               {/* Edit Dataset button moved here, next to the title */}
               <button
                 onClick={toggleEditPanel}
                 className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all duration-200 ${isEditPanelOpen
                   ? 'bg-blue-600 text-white shadow-md'
                   : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50'
                   }`}
               >
                 <Edit3 className="h-5 w-5" />
                 <span>{isEditPanelOpen ? 'Close Edit' : 'Edit Dataset'}</span>
               </button>
             </div>
             <div className="flex items-center gap-3">
               <button
                 onClick={closeViewer}
                 className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
                 title="Close viewer"
               >
                 <X className="w-6 h-6 text-gray-600 group-hover:text-red-600" />
               </button>
             </div>
           </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Edit Panel */}
             <div
  className={`bg-gray-50 border-r-2 border-gray-200 transition-all duration-300 ease-in-out flex-shrink-0 ${
    isEditPanelOpen ? 'w-72' : 'w-0'
  } overflow-hidden`}
>
                {isEditPanelOpen && (
                 <div className="h-full flex flex-col w-72">
                 
                       {/* Sidebar Header with X Close Button */}
                       <div className="flex items-center justify-between px-4 py-3 bg-white border-b-2 border-gray-200">
                         <div className="flex items-center gap-2">
                           <Edit3 className="h-4 w-4 text-blue-600" />
                           <span className="text-sm font-bold text-gray-800">Edit Dataset</span>
                         </div>
                         <button
                           onClick={toggleEditPanel}
                           className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-all duration-200"
                           title="Close"
                         >
                           <X className="h-3.5 w-3.5" />
                         </button>
                       </div>
                 
                       {/* Transformation Options */}
                       <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                         {transformationOptions.map((option) => (
                           <button
                             key={option.id}
                             onClick={() => handleTransformationSelect(option.id)}
                             className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all duration-200 text-left ${
                               selectedTransformation === option.id
                                 ? `bg-${option.color}-100 border-2 border-${option.color}-500 shadow-sm`
                                 : 'bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-sm hover:bg-gray-50'
                             }`}
                           >
                             <div
                               className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                 selectedTransformation === option.id
                                   ? `bg-${option.color}-200 text-${option.color}-700`
                                   : `bg-${option.color}-50 text-${option.color}-500`
                               }`}
                             >
                               {option.icon}
                             </div>
                             <span className={`text-sm font-medium ${
                               selectedTransformation === option.id ? 'text-gray-900' : 'text-gray-700'
                             }`}>
                               {option.label}
                             </span>
                           </button>
                         ))}
                       </div>
                 
                     </div>
                )}
              </div>
              
{/* Slim Toggle Strip - visible when sidebar is CLOSED */}
{!isEditPanelOpen && (
  <button
    onClick={toggleEditPanel}
    className="flex-shrink-0 w-9 bg-white border-r-2 border-gray-200 flex flex-col items-center justify-start pt-4 gap-1 hover:bg-blue-50 transition-colors group"
    title="Open Edit Panel"
  >
    <div className="w-6 h-6 rounded-md bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
      <svg
        className="w-3.5 h-3.5 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
    <span
      className="text-xs font-semibold text-blue-600 mt-2"
      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
    >
      
    </span>
  </button>
)}

              {/* Middle - Table */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Stats Bar */}
                {selectedDataset.rows > 0 && (
                  <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 flex-wrap">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-lg">
                      <div className="text-sm font-medium text-blue-700">Rows:</div>
                      <div className="text-lg font-bold text-blue-600">{selectedDataset.rows.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg">
                      <div className="text-sm font-medium text-green-700">Columns:</div>
                      <div className="text-lg font-bold text-green-600">{selectedDataset.columns}</div>
                    </div>
                    {sortColumn && !isPreviewMode && (
                      <button onClick={() => { setSortColumn(null); setSortOrder('asc'); refreshCurrentDataset(); }} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                        <X className="h-4 w-4 text-gray-700" /><div className="text-sm font-medium text-gray-700">Clear Sort</div>
                      </button>
                    )}
                    {!isPreviewMode && (
                      <button onClick={fetchFilterPreview} disabled={!hasTransformations} className="flex items-center gap-2 px-4 py-2 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <Eye className="h-4 w-4 text-yellow-700" /><div className="text-sm font-medium text-yellow-700">Preview Changes</div>
                      </button>
                    )}
                    <button onClick={handleUndo} disabled={isUndoing || !hasTransformations} className="flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {isUndoing ? <><Loader2 className="h-4 w-4 animate-spin text-purple-700" /><div className="text-sm font-medium text-purple-700">Undoing...</div></> : <><RotateCcw className="h-4 w-4 text-purple-700" /><div className="text-sm font-medium text-purple-700">Undo</div></>}
                    </button>
                    <button onClick={() => setShowResetModal(true)} disabled={!hasTransformations} className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <RefreshCw className="h-4 w-4 text-red-700" /><div className="text-sm font-medium text-red-700">Reset</div>
                    </button>
                    {/* ── SAVE AS BUTTON — lives next to Reset, always visible ── */}
                    <button onClick={openSaveAsModal} disabled={isSavingAs || !hasTransformations} className="flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {isSavingAs ? <><Loader2 className="h-4 w-4 animate-spin text-emerald-700" /><div className="text-sm font-medium text-emerald-700">Saving As...</div></> : <><SaveAll className="h-4 w-4 text-emerald-700" /><div className="text-sm font-medium text-emerald-700">Save As</div></>}
                    </button>
                  </div>
                )}

                {/* Preview Mode Banner */}
                {isPreviewMode && previewData && (
                  <div className="px-6 py-4 bg-yellow-50 border-b-2 border-yellow-300">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-200 rounded-full"><AlertTriangle className="h-6 w-6 text-yellow-700" /></div>
                          <div>
                            <p className="text-base font-bold text-yellow-900">🔍 Preview Mode - Changes Not Saved</p>
                            <p className="text-xs text-yellow-700 mt-1">Review filtered data below. Use "Save" to overwrite, or "Save As" (in the bar above) to create a new dataset.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={cancelFilterPreview} disabled={isSavingFilter} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm">
                            <X className="h-4 w-4" /><span className="font-medium">Cancel</span>
                          </button>
                          {/* SAVE (overwrite) */}
                          <button onClick={saveCurrentFilter} disabled={isSavingFilter} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm">
                            {isSavingFilter ? (<><Loader2 className="h-4 w-4 animate-spin" /><span className="font-medium">Saving...</span></>) : (<><Save className="h-4 w-4" /><span className="font-medium">Save</span></>)}
                          </button>
                        </div>
                      </div>

                      {/* Statistics Grid */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-white rounded-lg p-3 border-2 border-yellow-300 shadow-sm">
                          <p className="text-xs text-gray-600 font-medium mb-1">Current Rows</p>
                          <p className="text-2xl font-bold text-blue-600">{previewData.rows?.toLocaleString() || 0}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border-2 border-yellow-300 shadow-sm">
                          <p className="text-xs text-gray-600 font-medium mb-1">Filtered Out</p>
                          <p className="text-2xl font-bold text-red-600">{previewData.dropped_rows?.toLocaleString() || 0}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border-2 border-yellow-300 shadow-sm">
                          <p className="text-xs text-gray-600 font-medium mb-1">Original Total</p>
                          <p className="text-2xl font-bold text-gray-600">{((previewData.rows || 0) + (previewData.dropped_rows || 0)).toLocaleString()}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border-2 border-yellow-300 shadow-sm">
                          <p className="text-xs text-gray-600 font-medium mb-1">Retention Rate</p>
                          <p className="text-2xl font-bold text-green-600">
                            {previewData.rows && (previewData.rows + (previewData.dropped_rows || 0)) > 0
                              ? `${((previewData.rows / (previewData.rows + (previewData.dropped_rows || 0))) * 100).toFixed(1)}%`
                              : '0%'}
                          </p>
                        </div>
                      </div>

                      {currentFilterType && (
                        <div className="bg-white rounded-lg p-3 border-2 border-yellow-300">
                          <p className="text-xs text-gray-600 font-medium mb-1">Active Transformation:</p>
                          <p className="text-sm font-bold text-gray-900">
                            {currentFilterType === 'sort'
                              ? `SORT: ${previewData?.sort_column} (${previewData?.sort_order === 'asc' ? '↑ Ascending' : '↓ Descending'})`
                              : currentFilterType.replace(/_/g, ' ').toUpperCase()}
                          </p>
                        </div>
                      )}

                      <div className="bg-yellow-200 border-2 border-yellow-400 rounded-lg p-3">
                        <p className="text-xs text-yellow-900 font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <strong>Tip:</strong> Use <strong>"Save"</strong> to overwrite the current file, or use the <strong>"Save As"</strong> button in the stats bar above to create a new named dataset.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-hidden bg-gray-100">
                  {selectedDataset.fullData && selectedDataset.fullData.length > 0 ? (
                    <div className="h-full overflow-auto">
                      {isSelectingColumns && (
                        <div className="sticky top-0 z-30 bg-yellow-50 border-b border-yellow-200 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={areAllColumnsSelected()} onChange={toggleSelectAll} className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500" />
                                <span className="text-sm font-medium text-gray-700">{areAllColumnsSelected() ? 'Deselect All' : 'Select All'}</span>
                              </div>
                              <span className="text-sm text-gray-600">{selectedColumns.size} of {getColumnHeaders(selectedDataset).length} columns selected</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setIsSelectingColumns(false)} className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">Cancel</button>
                              <button onClick={() => { setIsSelectingColumns(false); }} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" disabled={selectedColumns.size === 0}>Edit Selected ({selectedColumns.size})</button>
                            </div>
                          </div>
                        </div>
                      )}
                      <table className="min-w-full bg-white border-collapse">
                        <thead className="sticky top-0 z-10 shadow-md">
                          <tr className="bg-gradient-to-r from-gray-800 to-gray-700">
                            <th className="px-4 py-3 text-left text-xs font-bold text-white border-r border-gray-600 bg-gray-900 sticky left-0 z-20 min-w-[60px]">
                              {!isSelectingColumns && (
                                <div className="flex items-center justify-between">
                                  <span>#</span>
                                  <button onClick={() => setIsSelectingColumns(true)} className="ml-2 p-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors" title="Select columns to edit">Select</button>
                                </div>
                              )}
                            </th>
                            {getColumnHeaders(selectedDataset).map((header, index) => (
                              <th key={index} className="px-6 py-3 text-left text-sm font-semibold text-white border-r border-gray-600 whitespace-nowrap min-w-[150px] group relative">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    {isSelectingColumns && (
                                      <input type="checkbox" checked={selectedColumns.has(header)} onChange={(e) => { e.stopPropagation(); toggleColumnSelection(header); }} className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500" onClick={(e) => e.stopPropagation()} />
                                    )}
                                    <span className={`flex-1 cursor-pointer ${isSelectingColumns ? selectedColumns.has(header) ? 'text-yellow-300 font-bold' : 'text-gray-300' : sortColumn === header ? 'text-blue-300 font-bold' : ''}`}
                                      onClick={() => !isSelectingColumns && handleColumnSort(header)} title={`Click to sort by ${header}`}>{header}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {!isSelectingColumns && (
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => handleColumnSort(header)}>
                                        <SortIndicator columnName={header} />
                                      </div>
                                    )}
                                    {!isSelectingColumns && (
                                      <button onClick={(e) => { e.stopPropagation(); fetchColumnFilterValues(header, e); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-600 rounded" title={`Filter ${header}`}>
                                        <Filter className="h-4 w-4 text-gray-300 hover:text-white" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDataset.fullData.map((row, rowIndex) => (
                            <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors border-b border-gray-200`}>
                              <td className="px-4 py-3 text-xs text-gray-600 font-semibold border-r border-gray-200 bg-gray-100 sticky left-0 z-10 text-center">{rowIndex + 1}</td>
                              {getColumnHeaders(selectedDataset).map((header, cellIndex) => (
                                <td key={cellIndex} className={`px-6 py-3 text-sm text-gray-800 border-r border-gray-200 whitespace-nowrap ${isSelectingColumns && selectedColumns.has(header) ? 'bg-yellow-50 border-yellow-200' : ''}`}>
                                  {String(row[header] !== undefined && row[header] !== null ? row[header] : '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center items-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
                      <Loader2 className="h-16 w-16 animate-spin text-blue-600 mb-4" />
                      <span className="text-xl text-gray-700 font-semibold">Loading dataset...</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {selectedDataset.fullData && selectedDataset.fullData.length > 0 && (
                  <div className="px-6 py-3 bg-gray-800 text-white border-t border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-6 text-sm">
                      <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /><strong>Dataset:</strong> {selectedDataset.name}</span>
                      <span className="flex items-center gap-2"><Database className="h-4 w-4" /><strong>Total Records:</strong> {selectedDataset.rows.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Form Panel */}
              <div
                className={`bg-white border-l-2 border-gray-200 transition-all duration-300 ease-in-out ${selectedTransformation ? 'w-96' : 'w-0'
                  } overflow-hidden`}
              >
                {/* RENAME COLUMN FORM */}
                {selectedTransformation === 'rename_column' && (
                  <div className="h-full flex flex-col">
                    {/* Form Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
                      <div className="flex items-center gap-2">
                        <Type className="h-6 w-6 text-green-600" />
                        <h3 className="text-lg font-bold text-gray-900">Rename Column</h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Change a column's name</p>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* File Name Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dataset Name
                        </label>
                        <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-300">
                          <div className="flex items-center gap-2">
                            {getFileIcon(selectedDataset.type)}
                            <span className="text-sm font-semibold text-gray-900">
                              {selectedDataset.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Old Column Name Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Column to Rename <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={renameOldColumn}
                          onChange={(e) => setRenameOldColumn(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select a column --</option>
                          {getColumnHeaders(selectedDataset).map((header, index) => (
                            <option key={index} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* New Column Name Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New Column Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={renameNewColumn}
                          onChange={(e) => setRenameNewColumn(e.target.value)}
                          placeholder="Enter new column name"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>

                      {/* Info Box */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Important:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li>This will rename the column in the original dataset</li>
                              <li>The change will be reflected immediately</li>
                              <li>Make sure the new name doesn't already exist</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Form Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                      <button
                        onClick={handleRenameColumn}
                        disabled={!renameOldColumn || !renameNewColumn || isRenamingColumn}
                        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRenamingColumn ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Renaming & Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTransformation(null);
                          setRenameOldColumn('');
                          setRenameNewColumn('');
                        }}
                        disabled={isRenamingColumn}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* TYPE CAST FORM */}
                {selectedTransformation === 'type_cast' && (
                  <div className="h-full flex flex-col">
                    {/* Form Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
                      <div className="flex items-center gap-2">
                        <FileText className="h-6 w-6 text-purple-600" />
                        <h3 className="text-lg font-bold text-gray-900">Type Cast</h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Convert column data type</p>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* File Name Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dataset Name
                        </label>
                        <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-300">
                          <div className="flex items-center gap-2">
                            {getFileIcon(selectedDataset.type)}
                            <span className="text-sm font-semibold text-gray-900">
                              {selectedDataset.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Column Name Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Column <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={typeCastColumn}
                          onChange={(e) => setTypeCastColumn(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select a column --</option>
                          {getColumnHeaders(selectedDataset).map((header, index) => (
                            <option key={index} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Data Type Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Convert To <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={typeCastNewType}
                          onChange={(e) => setTypeCastNewType(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select data type --</option>
                          <option value="int">Integer (int)</option>
                          <option value="float">Float (float)</option>
                          <option value="string">String (str)</option>
                          <option value="bool">Boolean (bool)</option>
                          <option value="datetime">DateTime (datetime)</option>
                          <option value="category">Category (category)</option>
                        </select>
                      </div>

                      {/* Info Box */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-yellow-800">
                            <p className="font-medium mb-1">Warning:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li>Converting data types may result in data loss</li>
                              <li>Invalid conversions will be set to null/NaN</li>
                              <li>Make sure the data is compatible with the target type</li>
                              <li>This operation modifies the original dataset</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Type Examples */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-900 mb-2">Common Use Cases:</p>
                        <ul className="text-xs text-blue-800 space-y-1">
                          <li><strong>int:</strong> Whole numbers (1, 2, 3)</li>
                          <li><strong>float:</strong> Decimal numbers (1.5, 2.7)</li>
                          <li><strong>string:</strong> Text data</li>
                          <li><strong>bool:</strong> True/False values</li>
                          <li><strong>datetime:</strong> Date and time values</li>
                        </ul>
                      </div>
                    </div>

                    {/* Form Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                      <button
                        onClick={handleTypeCast}
                        disabled={!typeCastColumn || !typeCastNewType || isTypeCasting}
                        className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTypeCasting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Converting...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            <span>Convert Type</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTransformation(null);
                          setTypeCastColumn('');
                          setTypeCastNewType('');
                        }}
                        disabled={isTypeCasting}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* GET HISTORY PANEL */}
                {selectedTransformation === 'get_history' && (
                  <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <History className="h-6 w-6 text-gray-600" />
                          <h3 className="text-lg font-bold text-gray-900">Transformation History</h3>
                        </div>
                        <button
                          onClick={fetchHistory}
                          disabled={isLoadingHistory}
                          className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Refresh history"
                        >
                          <RefreshCw className={`h-5 w-5 text-gray-600 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">View all changes made to this dataset</p>
                    </div>

                    {/* Dataset Info */}
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        {getFileIcon(selectedDataset.type)}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{selectedDataset.name}</p>
                          <p className="text-xs text-gray-600">
                            {historyData.length} transformation{historyData.length !== 1 ? 's' : ''} recorded
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* History Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {isLoadingHistory ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <Loader2 className="h-12 w-12 animate-spin text-gray-600 mb-4" />
                          <p className="text-sm text-gray-600">Loading history...</p>
                        </div>
                      ) : historyData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <History className="h-16 w-16 text-gray-300 mb-4" />
                          <p className="text-sm font-medium text-gray-600">No history available</p>
                          <p className="text-xs text-gray-500 mt-1">Transformations will appear here</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {historyData.map((item, index) => (
                            <div
                              key={item.track_id}
                              className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-blue-300 transition-colors"
                            >
                              {/* Version Number */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-bold text-blue-600">
                                      #{historyData.length - index}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold text-gray-500">VERSION</span>
                                </div>
                              </div>

                              {/* Transformation Note */}
                              <div className="mb-3">
                                <p className="text-sm font-medium text-gray-900 mb-1">
                                  {item.note}
                                </p>
                              </div>

                              {/* Track ID */}
                              <div className="bg-gray-50 rounded p-2 border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">Track ID</p>
                                <code className="text-xs font-mono text-gray-700 break-all">
                                  {item.track_id}
                                </code>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
                      {historyData.length > 0 && (
                        <>
                          <button
                            onClick={handleUndo}
                            disabled={isUndoing}
                            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isUndoing ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>Undoing...</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="h-5 w-5" />
                                <span>Undo Latest</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setShowResetModal(true)}
                            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                          >
                            <RefreshCw className="h-5 w-5" />
                            <span>Reset to Original</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setSelectedTransformation(null);
                          setHistoryData([]);
                        }}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}



                {/* GROUP AND AGGREGATE FORM */}
                {selectedTransformation === 'group_and_aggregate' && (
                  <div className="h-full flex flex-col">
                    {/* Form Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
                      <div className="flex items-center gap-2">
                        <Database className="h-6 w-6 text-orange-600" />
                        <h3 className="text-lg font-bold text-gray-900">Group & Aggregate</h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Group data and perform aggregations</p>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* File Name Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dataset Name
                        </label>
                        <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-300">
                          <div className="flex items-center gap-2">
                            {getFileIcon(selectedDataset.type)}
                            <span className="text-sm font-semibold text-gray-900">
                              {selectedDataset.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Group By Columns - Multi-select */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Group By Columns <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                          {getColumnHeaders(selectedDataset).map((header, index) => (
                            <label
                              key={index}
                              className="flex items-center gap-3 p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={groupByColumns.includes(header)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setGroupByColumns([...groupByColumns, header]);
                                  } else {
                                    setGroupByColumns(groupByColumns.filter(col => col !== header));
                                  }
                                }}
                                className="h-4 w-4 text-orange-600 rounded focus:ring-orange-500"
                              />
                              <span className="text-sm font-medium text-gray-900">{header}</span>
                            </label>
                          ))}
                        </div>
                        {groupByColumns.length > 0 && (
                          <div className="mt-2 p-2 bg-orange-50 rounded border border-orange-200">
                            <p className="text-xs text-orange-800">
                              Selected: <span className="font-semibold">{groupByColumns.join(', ')}</span>
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Aggregate Column Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Aggregate Column <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={aggregateColumn}
                          onChange={(e) => setAggregateColumn(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select column to aggregate --</option>
                          {getColumnHeaders(selectedDataset).map((header, index) => (
                            <option key={index} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Aggregate Function Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Aggregation Function <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={aggregateFunction}
                          onChange={(e) => setAggregateFunction(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select function --</option>
                          <option value="sum">Sum - Total of all values</option>
                          <option value="count">Count - Number of rows</option>
                          <option value="mean">Mean - Average value</option>
                          <option value="median">Median - Middle value</option>
                          <option value="min">Min - Smallest value</option>
                          <option value="max">Max - Largest value</option>
                          <option value="std">Std - Standard deviation</option>
                          <option value="var">Var - Variance</option>
                          <option value="first">First - First value</option>
                          <option value="last">Last - Last value</option>
                        </select>
                      </div>

                      {/* Info Box */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">How it works:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li>Select one or more columns to group by</li>
                              <li>Choose a column to perform aggregation on</li>
                              <li>Pick an aggregation function (sum, count, etc.)</li>
                              <li>The result will show grouped data with aggregated values</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Example Box */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-green-900 mb-2">Example:</p>
                        <div className="text-xs text-green-800 space-y-1">
                          <p><strong>Group by:</strong> Category, Region</p>
                          <p><strong>Aggregate:</strong> Sales (with Sum)</p>
                          <p><strong>Result:</strong> Total sales for each category in each region</p>
                        </div>
                      </div>
                    </div>

                    {/* Form Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                      <button
                        onClick={handleGroupAndAggregate}
                        disabled={groupByColumns.length === 0 || !aggregateColumn || !aggregateFunction || isGroupingAggregating}
                        className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-orange-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGroupingAggregating ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Loading Preview...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-5 w-5" />
                            <span>Preview Grouping</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTransformation(null);
                          setGroupByColumns([]);
                          setAggregateColumn('');
                          setAggregateFunction('');
                        }}
                        disabled={isGroupingAggregating}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}




                {/* FILTER BY DATE FORM - EXCEL-LIKE HIERARCHICAL FILTERING */}
                {selectedTransformation === 'filter_by_date' && (
                  <div className="h-full flex flex-col">
                    {/* Form Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-white">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-6 w-6 text-pink-600" />
                        <h3 className="text-lg font-bold text-gray-900">Filter by Date</h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Filter records by date ranges (Excel-style)</p>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* File Name Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dataset Name
                        </label>
                        <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-300">
                          <div className="flex items-center gap-2">
                            {getFileIcon(selectedDataset.type)}
                            <span className="text-sm font-semibold text-gray-900">
                              {selectedDataset.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Date Column Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Date Column <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={dateColumn}
                          onChange={(e) => {
                            setDateColumn(e.target.value);
                            setDateSummaryLoaded(false);
                            setSelectedYears([]);
                            setSelectedMonths([]);
                            setSelectedDays([]);
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select date column --</option>
                          {getDateColumns(selectedDataset).length > 0 ? (
                            getDateColumns(selectedDataset).map((header, index) => (
                              <option key={index} value={header}>
                                {header}
                              </option>
                            ))
                          ) : (
                            getColumnHeaders(selectedDataset).map((header, index) => (
                              <option key={index} value={header}>
                                {header}
                              </option>
                            ))
                          )}
                        </select>
                        {dateColumn && !dateSummaryLoaded && (
                          <button
                            onClick={fetchDateSummary}
                            disabled={isLoadingDateSummary}
                            className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isLoadingDateSummary ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading dates...</span>
                              </>
                            ) : (
                              <>
                                <Calendar className="h-4 w-4" />
                                <span>Load Available Dates</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Date Filters - Show only after summary is loaded */}
                      {dateSummaryLoaded && (
                        <>
                          {/* Year Filter */}
                          {availableYears.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Filter by Year(s) (Optional)
                              </label>
                              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2 bg-white">
                                {availableYears.map((year) => {
                                  const monthsInYear = Object.keys(availableMonths[year] || {}).length;
                                  return (
                                    <label
                                      key={year}
                                      className="flex items-center gap-3 p-2 hover:bg-pink-50 rounded cursor-pointer transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedYears.includes(year)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedYears([...selectedYears, year]);
                                          } else {
                                            setSelectedYears(selectedYears.filter(y => y !== year));
                                            // Clear months and days that belong to this year
                                            const monthsToRemove = Object.keys(availableMonths[year] || {}).map(Number);
                                            setSelectedMonths(selectedMonths.filter(m => !monthsToRemove.includes(m)));
                                            setSelectedDays([]);
                                          }
                                        }}
                                        className="h-4 w-4 text-pink-600 rounded focus:ring-pink-500"
                                      />
                                      <span className="text-sm font-medium text-gray-900">{year}</span>
                                      <span className="text-xs text-gray-500 ml-auto">
                                        {monthsInYear} month{monthsInYear !== 1 ? 's' : ''}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                              {selectedYears.length > 0 && (
                                <div className="mt-2 p-2 bg-pink-50 rounded border border-pink-200">
                                  <p className="text-xs text-pink-800">
                                    Selected: <span className="font-semibold">{selectedYears.join(', ')}</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Month Filter - Dynamically filtered based on selected years */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Filter by Month(s) (Optional)
                              {selectedYears.length > 0 && (
                                <span className="text-xs text-gray-500 ml-2">
                                  (Showing months from selected year{selectedYears.length > 1 ? 's' : ''})
                                </span>
                              )}
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { num: 1, name: 'Jan' }, { num: 2, name: 'Feb' }, { num: 3, name: 'Mar' },
                                { num: 4, name: 'Apr' }, { num: 5, name: 'May' }, { num: 6, name: 'Jun' },
                                { num: 7, name: 'Jul' }, { num: 8, name: 'Aug' }, { num: 9, name: 'Sep' },
                                { num: 10, name: 'Oct' }, { num: 11, name: 'Nov' }, { num: 12, name: 'Dec' }
                              ].map((month) => {
                                // Check if this month exists in any of the selected years
                                let isAvailable = false;
                                if (selectedYears.length === 0) {
                                  // If no year selected, check if month exists in any year
                                  isAvailable = Object.values(availableMonths).some(yearMonths =>
                                    yearMonths.hasOwnProperty(month.num.toString())
                                  );
                                } else {
                                  // Check if month exists in selected years
                                  isAvailable = selectedYears.some(year =>
                                    availableMonths[year]?.hasOwnProperty(month.num.toString())
                                  );
                                }

                                const isSelected = selectedMonths.includes(month.num);

                                return (
                                  <button
                                    key={month.num}
                                    onClick={() => {
                                      if (!isAvailable) return;

                                      if (isSelected) {
                                        setSelectedMonths(selectedMonths.filter(m => m !== month.num));
                                        setSelectedDays([]); // Clear days when deselecting month
                                      } else {
                                        setSelectedMonths([...selectedMonths, month.num]);
                                      }
                                    }}
                                    disabled={!isAvailable}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isSelected
                                      ? 'bg-pink-600 text-white shadow-md'
                                      : isAvailable
                                        ? 'bg-white text-gray-700 border border-gray-300 hover:bg-pink-50'
                                        : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                      }`}
                                    title={!isAvailable ? 'Not available in selected year(s)' : ''}
                                  >
                                    {month.name}
                                  </button>
                                );
                              })}
                            </div>
                            {selectedMonths.length > 0 && (
                              <div className="mt-2 p-2 bg-pink-50 rounded border border-pink-200">
                                <p className="text-xs text-pink-800">
                                  Selected: <span className="font-semibold">
                                    {selectedMonths.sort((a, b) => a - b).map(m =>
                                      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
                                    ).join(', ')}
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Day Filter - Dynamically filtered based on selected years and months */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Filter by Day(s) (Optional)
                              {(selectedYears.length > 0 || selectedMonths.length > 0) && (
                                <span className="text-xs text-gray-500 ml-2">
                                  (Showing days from selected year{selectedYears.length > 1 ? 's' : ''}/month{selectedMonths.length > 1 ? 's' : ''})
                                </span>
                              )}
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-white">
                              <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                                  // Determine if this day is available based on selected years and months
                                  let isAvailable = false;

                                  if (selectedYears.length === 0 && selectedMonths.length === 0) {
                                    // No filters - check if day exists in any year/month
                                    isAvailable = Object.values(availableMonths).some(yearMonths =>
                                      Object.values(yearMonths).some(days => Array.isArray(days) && days.includes(day))
                                    );
                                  } else if (selectedYears.length > 0 && selectedMonths.length === 0) {
                                    // Only years selected - check if day exists in any month of selected years
                                    isAvailable = selectedYears.some(year =>
                                      Object.values(availableMonths[year] || {}).some(days => Array.isArray(days) && days.includes(day))
                                    );
                                  } else if (selectedYears.length === 0 && selectedMonths.length > 0) {
                                    // Only months selected - check if day exists in selected months across all years
                                    isAvailable = Object.values(availableMonths).some(yearMonths =>
                                      selectedMonths.some(month => {
                                        const days = yearMonths[month.toString()];
                                        return Array.isArray(days) && days.includes(day);
                                      })
                                    );
                                  } else {
                                    // Both years and months selected - check specific year/month combinations
                                    isAvailable = selectedYears.some(year =>
                                      selectedMonths.some(month => {
                                        const days = availableMonths[year]?.[month.toString()];
                                        return Array.isArray(days) && days.includes(day);
                                      })
                                    );
                                  }

                                  const isSelected = selectedDays.includes(day);

                                  return (
                                    <button
                                      key={day}
                                      onClick={() => {
                                        if (!isAvailable) return;

                                        if (isSelected) {
                                          setSelectedDays(selectedDays.filter(d => d !== day));
                                        } else {
                                          setSelectedDays([...selectedDays, day]);
                                        }
                                      }}
                                      disabled={!isAvailable}
                                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${isSelected
                                        ? 'bg-pink-600 text-white shadow-sm'
                                        : isAvailable
                                          ? 'bg-white text-gray-700 border border-gray-200 hover:bg-pink-50'
                                          : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'
                                        }`}
                                      title={!isAvailable ? 'Not available in selected year(s)/month(s)' : ''}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {selectedDays.length > 0 && (
                              <div className="mt-2 p-2 bg-pink-50 rounded border border-pink-200">
                                <p className="text-xs text-pink-800">
                                  Selected: <span className="font-semibold">{selectedDays.sort((a, b) => a - b).join(', ')}</span>
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Info Box */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-blue-800">
                                <p className="font-medium mb-1">Excel-Like Filtering:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                  <li>Select year(s) to see only months available in those years</li>
                                  <li>Select month(s) to see only days available in those months</li>
                                  <li>Grayed out options are not available in your selection</li>
                                  <li>Filters work with AND logic when combined</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Example Box */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-green-900 mb-2">Example Usage:</p>
                        <div className="text-xs text-green-800 space-y-1">
                          <p><strong>Scenario 1:</strong> Select Year=2024 → Only months available in 2024 will be enabled</p>
                          <p><strong>Scenario 2:</strong> Select Year=2024, Month=Jan → Only days in January 2024 will be enabled</p>
                          <p><strong>Scenario 3:</strong> Select Month=Jan (no year) → All days available in January across all years</p>
                        </div>
                      </div>
                    </div>

                    {/* Form Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                      <button
                        onClick={handleFilterByDate}
                        disabled={!dateColumn || !dateSummaryLoaded || isFilteringByDate || (selectedYears.length === 0 && selectedMonths.length === 0 && selectedDays.length === 0)}
                        className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-pink-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFilteringByDate ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Applying Filter...</span>
                          </>
                        ) : (
                          <>
                            <Filter className="h-5 w-5" />
                            <span>Apply Date Filter</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTransformation(null);
                          setDateColumn('');
                          setSelectedYears([]);
                          setSelectedMonths([]);
                          setSelectedDays([]);
                          setDateSummaryLoaded(false);
                        }}
                        disabled={isFilteringByDate}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}


                {/* FILTER BY UNIQUE VALUES FORM */}
                {selectedTransformation === 'filter_by_values' && (
                  <div className="h-full flex flex-col">
                    {/* Form Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
                      <div className="flex items-center gap-2">
                        <Filter className="h-6 w-6 text-indigo-600" />
                        <h3 className="text-lg font-bold text-gray-900">Filter by Values</h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Filter records by specific column values</p>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* File Name Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dataset Name
                        </label>
                        <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-300">
                          <div className="flex items-center gap-2">
                            {getFileIcon(selectedDataset.type)}
                            <span className="text-sm font-semibold text-gray-900">
                              {selectedDataset.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Column Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Column to Filter <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={filterColumn}
                          onChange={(e) => {
                            setFilterColumn(e.target.value);
                            setUniqueValuesLoaded(false);
                            setUniqueValuesData(null);
                            setSelectedFilterValues(new Set());
                            setUniqueValuesSearchTerm('');
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select a column --</option>
                          {getColumnHeaders(selectedDataset).map((header, index) => (
                            <option key={index} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                        {filterColumn && !uniqueValuesLoaded && (
                          <button
                            onClick={fetchUniqueValues}
                            disabled={isLoadingUniqueValues}
                            className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isLoadingUniqueValues ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading values...</span>
                              </>
                            ) : (
                              <>
                                <Filter className="h-4 w-4" />
                                <span>Load Unique Values</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Unique Values Display - Show only after values are loaded */}
                      {uniqueValuesLoaded && uniqueValuesData && (
                        <>
                          {/* Statistics */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <p className="text-xs text-blue-600 font-medium">Total Rows</p>
                              <p className="text-lg font-bold text-blue-900">{uniqueValuesData.total_rows}</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                              <p className="text-xs text-green-600 font-medium">Unique Values</p>
                              <p className="text-lg font-bold text-green-900">{uniqueValuesData.unique_values_count}</p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                              <p className="text-xs text-purple-600 font-medium">Null Rows</p>
                              <p className="text-lg font-bold text-purple-900">{uniqueValuesData.null_rows}</p>
                            </div>
                          </div>

                          {/* Search Box */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Search Values
                            </label>
                            <input
                              type="text"
                              value={uniqueValuesSearchTerm}
                              onChange={(e) => setUniqueValuesSearchTerm(e.target.value)}
                              placeholder="Type to search..."
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>

                          {/* Selection Controls */}
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={selectAllFilterValues}
                              className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                            >
                              Select All {uniqueValuesSearchTerm && '(Filtered)'}
                            </button>
                            <button
                              onClick={deselectAllFilterValues}
                              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                            >
                              Clear Selection
                            </button>
                          </div>

                          {/* Selected Count */}
                          {selectedFilterValues.size > 0 && (
                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                              <p className="text-sm text-indigo-800">
                                <span className="font-bold">{selectedFilterValues.size}</span> value(s) selected
                              </p>
                            </div>
                          )}

                          {/* Values List */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Select Values to Keep <span className="text-red-500">*</span>
                            </label>
                            <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                              {getFilteredUniqueValues().length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                  <Filter className="h-12 w-12 text-gray-300 mb-2" />
                                  <p className="text-sm text-gray-600">No values match your search</p>
                                </div>
                              ) : (
                                <div className="p-2 space-y-1">
                                  {getFilteredUniqueValues().map((value: any, index: number) => {
                                    const count = uniqueValuesData.value_counts[String(value)] || 0;
                                    const isSelected = selectedFilterValues.has(value);

                                    return (
                                      <label
                                        key={index}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${isSelected
                                          ? 'bg-indigo-100 border-2 border-indigo-500'
                                          : 'hover:bg-gray-50 border-2 border-transparent'
                                          }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleFilterValue(value)}
                                          className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate" title={String(value)}>
                                            {String(value)}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {count} occurrence{count !== 1 ? 's' : ''} ({((count / uniqueValuesData.total_rows) * 100).toFixed(1)}%)
                                          </p>
                                        </div>
                                        {isSelected && (
                                          <Check className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Info Box */}
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-yellow-800">
                                <p className="font-medium mb-1">Important:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                  <li>Only rows with selected values will be kept</li>
                                  <li>Unselected values will be filtered out</li>
                                  <li>This modifies the dataset - use undo if needed</li>
                                  <li>Null values are counted separately</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Example Box */}
                      {!uniqueValuesLoaded && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-900 mb-2">How it works:</p>
                          <div className="text-xs text-green-800 space-y-1">
                            <p><strong>Step 1:</strong> Select a column to filter (e.g., Status, Category)</p>
                            <p><strong>Step 2:</strong> Click "Load Unique Values" to see all unique values</p>
                            <p><strong>Step 3:</strong> Select which values you want to keep</p>
                            <p><strong>Step 4:</strong> Apply filter - only selected values will remain</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Form Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                      <button
                        onClick={handleFilterByUniqueValues}
                        disabled={!filterColumn || !uniqueValuesLoaded || selectedFilterValues.size === 0 || isApplyingFilter}
                        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isApplyingFilter ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Applying Filter...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            <span>Apply Filter ({selectedFilterValues.size} values)</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTransformation(null);
                          setFilterColumn('');
                          setSelectedFilterValues(new Set());
                          setUniqueValuesLoaded(false);
                          setUniqueValuesData(null);
                          setUniqueValuesSearchTerm('');
                        }}
                        disabled={isApplyingFilter}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}



                {/* Column Filter Dropdown */}
                {filterDropdownOpen && (
                  <div
                    className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 z-[60] w-96 overflow-hidden flex flex-col"
                    style={{
                      top: `${filterDropdownPosition.top}px`,
                      left: `${filterDropdownPosition.left}px`,
                      maxHeight: `min(600px, ${window.innerHeight - filterDropdownPosition.top - 20}px)` // Dynamic max height
                    }}
                  >
                    {/* Dropdown Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-indigo-100 border-b border-indigo-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Filter className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-sm font-bold text-gray-900">Filter: {filterDropdownOpen}</h3>
                        </div>
                        <button
                          onClick={() => {
                            setFilterDropdownOpen(null);
                            setColumnFilterValues(null);
                          }}
                          className="text-gray-500 hover:text-gray-700 p-1 hover:bg-white/50 rounded transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Loading State */}
                    {isLoadingColumnFilter ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
                        <p className="text-sm text-gray-600">Loading values...</p>
                      </div>
                    ) : columnFilterValues ? (
                      <>
                        {/* Statistics */}
                        <div className="p-3 bg-gray-50 border-b border-gray-200">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center">
                              <p className="text-gray-600">Total</p>
                              <p className="font-bold text-gray-900">{columnFilterValues.total_rows}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-600">Unique</p>
                              <p className="font-bold text-indigo-600">{columnFilterValues.unique_values_count}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-600">Nulls</p>
                              <p className="font-bold text-red-600">{columnFilterValues.null_rows}</p>
                            </div>
                          </div>
                        </div>

                        {/* Search Box */}
                        <div className="p-3 border-b border-gray-200">
                          <input
                            type="text"
                            value={columnFilterSearchTerm}
                            onChange={(e) => setColumnFilterSearchTerm(e.target.value)}
                            placeholder="Search values..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Selection Controls */}
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                          <button
                            onClick={selectAllColumnFilterValues}
                            className="flex-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors font-medium"
                          >
                            Select All
                          </button>
                          <button
                            onClick={deselectAllColumnFilterValues}
                            className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                          >
                            Clear
                          </button>
                          <span className="text-xs text-gray-600">
                            {selectedColumnFilterValues.size} selected
                          </span>
                        </div>

                        {/* Values List */}
                        <div className="flex-1 overflow-y-auto">
                          {getFilteredColumnValues().length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8">
                              <Filter className="h-12 w-12 text-gray-300 mb-2" />
                              <p className="text-sm text-gray-600">No values found</p>
                            </div>
                          ) : (
                            <div className="p-2">
                              {getFilteredColumnValues().map((value: any, index: number) => {
                                const count = columnFilterValues.value_counts[String(value)] || 0;
                                const isSelected = selectedColumnFilterValues.has(value);
                                const percentage = ((count / columnFilterValues.total_rows) * 100).toFixed(1);

                                return (
                                  <label
                                    key={index}
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'
                                      }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleColumnFilterValue(value)}
                                      className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate" title={String(value)}>
                                        {String(value)}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {count.toLocaleString()} ({percentage}%)
                                      </p>
                                    </div>
                                    {isSelected && <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
                          <button
                            onClick={() => {
                              setFilterDropdownOpen(null);
                              setColumnFilterValues(null);
                            }}
                            className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={applyColumnFilter}
                            disabled={isApplyingFilter || selectedColumnFilterValues.size === 0}
                            className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isApplyingFilter ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Applying...</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4" />
                                <span>OK</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}




                {/* TEXT FILTER FORM */}
                {selectedTransformation === 'text_filter' && (
                  <div className="h-full flex flex-col">
                    {/* Form Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                      <div className="flex items-center gap-2">
                        <Type className="h-6 w-6 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-900">Text Filter</h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Filter text data with advanced conditions</p>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* File Name Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dataset Name
                        </label>
                        <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-300">
                          <div className="flex items-center gap-2">
                            {getFileIcon(selectedDataset.type)}
                            <span className="text-sm font-semibold text-gray-900">
                              {selectedDataset.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Column Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Column <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={textFilterColumn}
                          onChange={(e) => setTextFilterColumn(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select a column --</option>
                          {getColumnHeaders(selectedDataset).map((header, index) => (
                            <option key={index} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Filter Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Filter Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={textFilterType}
                          onChange={(e) => {
                            setTextFilterType(e.target.value);
                            // Reset values when filter type changes
                            setTextFilterValue('');
                            setTextFilterValue2('');
                            setTextFilterValues([]);
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="equals">Equals</option>
                          <option value="contains">Contains</option>
                          <option value="starts_with">Starts With</option>
                          <option value="ends_with">Ends With</option>
                          <option value="not_equals">Not Equals</option>
                          <option value="between">Between (Alphabetically)</option>
                          <option value="in">In List</option>
                          <option value="empty">Is Empty</option>
                          <option value="not_empty">Is Not Empty</option>
                        </select>
                      </div>

                      {/* Single Value Input (for equals, contains, starts_with, ends_with, not_equals) */}
                      {['equals', 'contains', 'starts_with', 'ends_with', 'not_equals'].includes(textFilterType) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Filter Value <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={textFilterValue}
                            onChange={(e) => setTextFilterValue(e.target.value)}
                            placeholder={`Enter value to ${textFilterType.replace('_', ' ')}`}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}

                      {/* Between Values (for between filter) */}
                      {textFilterType === 'between' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Start Value <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={textFilterValue}
                              onChange={(e) => setTextFilterValue(e.target.value)}
                              placeholder="Enter start value"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              End Value <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={textFilterValue2}
                              onChange={(e) => setTextFilterValue2(e.target.value)}
                              placeholder="Enter end value"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}

                      {/* Multiple Values Input (for 'in' filter) */}
                      {textFilterType === 'in' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Values (one per line) <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={textFilterValues.join('\n')}
                            onChange={(e) => setTextFilterValues(e.target.value.split('\n').filter(v => v.trim()))}
                            placeholder="Enter values, one per line"
                            rows={6}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                          {textFilterValues.length > 0 && (
                            <p className="mt-2 text-xs text-gray-600">
                              {textFilterValues.length} value(s) entered
                            </p>
                          )}
                        </div>
                      )}

                      {/* Info Box */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Filter Types:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li><strong>Equals:</strong> Exact match</li>
                              <li><strong>Contains:</strong> Value exists anywhere in text</li>
                              <li><strong>Starts With:</strong> Text begins with value</li>
                              <li><strong>Ends With:</strong> Text ends with value</li>
                              <li><strong>Between:</strong> Alphabetically between two values</li>
                              <li><strong>In:</strong> Matches any value in the list</li>
                              <li><strong>Empty/Not Empty:</strong> Check for null/empty values</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Preview Info */}
                      {textFilterColumn && textFilterType && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-900 mb-1">Filter Preview:</p>
                          <p className="text-xs text-green-800">
                            Will filter <strong>{textFilterColumn}</strong> where value{' '}
                            <strong>{getTextFilterDescription().split(' ').slice(1).join(' ')}</strong>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Form Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                      <button
                        onClick={handleTextFilter}
                        disabled={!textFilterColumn || !textFilterType || isApplyingTextFilter}
                        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isApplyingTextFilter ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Applying Filter...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-5 w-5" />
                            <span>Preview Filter</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTransformation(null);
                          setTextFilterColumn('');
                          setTextFilterType('equals');
                          setTextFilterValue('');
                          setTextFilterValue2('');
                          setTextFilterValues([]);
                        }}
                        disabled={isApplyingTextFilter}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}


                {/* NUMBER FILTER FORM */}
                {selectedTransformation === 'number_filter' && (
                  <div className="h-full flex flex-col">
                    {/* Form Header */}
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-white">
                      <div className="flex items-center gap-2">
                        <Hash className="h-6 w-6 text-teal-600" />
                        <h3 className="text-lg font-bold text-gray-900">Number Filter</h3>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Filter numeric data with advanced conditions</p>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* File Name Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dataset Name
                        </label>
                        <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-300">
                          <div className="flex items-center gap-2">
                            {getFileIcon(selectedDataset.type)}
                            <span className="text-sm font-semibold text-gray-900">
                              {selectedDataset.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Column Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Numeric Column <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={numberFilterColumn}
                          onChange={(e) => setNumberFilterColumn(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Select a column --</option>
                          {getColumnHeaders(selectedDataset).map((header, index) => (
                            <option key={index} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Filter Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Filter Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={numberFilterType}
                          onChange={(e) => {
                            setNumberFilterType(e.target.value);
                            // Reset values when filter type changes
                            setNumberFilterValue('');
                            setNumberFilterValue2('');
                            setNumberFilterValues([]);
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="equals">Equals (=)</option>
                          <option value="not_equals">Not Equals (≠)</option>
                          <option value="greater_than">Greater Than (&gt;)</option>
                          <option value="less_than">Less Than (&lt;)</option>
                          <option value="greater_than_or_equal">Greater Than or Equal (≥)</option>
                          <option value="less_than_or_equal">Less Than or Equal (≤)</option>
                          <option value="between">Between</option>
                          <option value="in">In List</option>
                          <option value="empty">Is Empty/Null</option>
                          <option value="not_empty">Is Not Empty/Null</option>
                        </select>
                      </div>

                      {/* Single Value Input (for equals, not_equals, comparisons) */}
                      {['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'].includes(numberFilterType) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Value <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={numberFilterValue}
                            onChange={(e) => setNumberFilterValue(e.target.value)}
                            placeholder="Enter numeric value"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          />
                        </div>
                      )}

                      {/* Between Values */}
                      {numberFilterType === 'between' && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Minimum Value <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={numberFilterValue}
                              onChange={(e) => setNumberFilterValue(e.target.value)}
                              placeholder="Enter minimum value"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Maximum Value <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={numberFilterValue2}
                              onChange={(e) => setNumberFilterValue2(e.target.value)}
                              placeholder="Enter maximum value"
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}

                      {/* Multiple Values Input (for 'in' filter) */}
                      {numberFilterType === 'in' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Values (one per line) <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={numberFilterValues.join('\n')}
                            onChange={(e) => setNumberFilterValues(e.target.value.split('\n').filter(v => v.trim() && !isNaN(Number(v.trim()))))}
                            placeholder="Enter numeric values, one per line&#10;Example:&#10;100&#10;200&#10;300"
                            rows={6}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none font-mono"
                          />
                          {numberFilterValues.length > 0 && (
                            <p className="mt-2 text-xs text-gray-600">
                              {numberFilterValues.length} value(s) entered
                            </p>
                          )}
                        </div>
                      )}

                      {/* Info Box */}
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-teal-800">
                            <p className="font-medium mb-1">Filter Types:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li><strong>Equals:</strong> Exact match (value = N)</li>
                              <li><strong>Greater/Less Than:</strong> Comparison operators</li>
                              <li><strong>Between:</strong> Range from min to max (inclusive)</li>
                              <li><strong>In:</strong> Matches any number in the list</li>
                              <li><strong>Empty/Not Empty:</strong> Check for null values</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Preview Info */}
                      {numberFilterColumn && numberFilterType && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-900 mb-1">Filter Preview:</p>
                          <p className="text-xs text-green-800">
                            Will filter <strong>{numberFilterColumn}</strong> where value{' '}
                            <strong>{getNumberFilterDescription().split(' ').slice(1).join(' ')}</strong>
                          </p>
                        </div>
                      )}

                      {/* Example Box */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-900 mb-2">Examples:</p>
                        <div className="text-xs text-blue-800 space-y-1">
                          <p><strong>Equals 100:</strong> Only rows where column = 100</p>
                          <p><strong>Greater Than 50:</strong> All values &gt; 50</p>
                          <p><strong>Between 10 and 100:</strong> Values from 10 to 100 (inclusive)</p>
                          <p><strong>In [10, 20, 30]:</strong> Values matching 10, 20, or 30</p>
                        </div>
                      </div>
                    </div>

                    {/* Form Footer */}
                    <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                      <button
                        onClick={handleNumberFilter}
                        disabled={!numberFilterColumn || !numberFilterType || isApplyingNumberFilter}
                        className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-teal-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isApplyingNumberFilter ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Applying Filter...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-5 w-5" />
                            <span>Preview Filter</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTransformation(null);
                          setNumberFilterColumn('');
                          setNumberFilterType('equals');
                          setNumberFilterValue('');
                          setNumberFilterValue2('');
                          setNumberFilterValues([]);
                        }}
                        disabled={isApplyingNumberFilter}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}



              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}