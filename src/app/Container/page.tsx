// container with data sources and info object




'use client';

import { useState, useEffect, SetStateAction, useRef, ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import PptxGenJS from "pptxgenjs";
import { useSearchParams } from "next/navigation";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../context/LanguageContext";
import { translateBatch, translateText, formatNumber } from "../utils/translateService";
// import { MdManageSearch } from "react-icons/md";
import { FaPlay, FaPen, FaTrash, FaEdit, FaCheck, FaBan } from "react-icons/fa";
import { FaFileUpload, FaCaretUp, FaCaretDown, FaUpload, FaTimes, FaComment, FaBars } from 'react-icons/fa';
import axios from "axios";
import React from "react";
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
// import { useDropzone } from "react-dropzone";
import { PencilIcon, TrashIcon, PlusIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon, Edit } from 'lucide-react';
import { Pie, Bar, Line } from "react-chartjs-2";
import { MdArrowDropDown, MdArrowDropUp } from 'react-icons/md';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  // ChartData,
} from "chart.js";
import Spinner from "../components/Spinner";
import { FiMic, FiSave } from "react-icons/fi";
import { toast } from "react-toastify";
import styles from "../CXO/CXO.module.css";
import ExcelTableComponent from "../components/ExcelTableComponent";
import TimelineSettings from "../components/TimelineSettings";
import ParameterSettings from "../components/ParameterSettings";
import { usePathname, useRouter } from 'next/navigation';
import TallySetting from "../components/TallySetting";
import ManageParameterSetting from "../components/Manageparametersetting";
import KpiUpdates from "../components/KpiUpdates";
import dynamic from "next/dynamic";
const ReportComponent = dynamic(() => import("../components/ReportComponent"), { ssr: false });

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

type Prompt = {
  output_type: string;
  name: string;
  filename: string;
  created_by: string;
  // loggedInUserName: ReactNode;
  id: string;
  prompt_text: string;
  user_name?: string;
  prompt_title: string;
  created_at: Date | string;
  updated_at: Date | string;
  data_source_id?: number;
  dataset_name?: string;
};

type RunResult = {
  message?: string[];
  table?: {
    columns: string[];
    data: string[][];
  };
  charts?: unknown[];
  detail?: string;
};

// interface ConfigurationDetails {
//   key1: string;
//   key2: number;
//   // Add other properties as per the actual structure
// }

// interface Item {
//   id?: string;
//   name?: string;
//   configuration_details: ConfigurationDetails;
// }

interface Item {
  id?: string;
  name?: string;
  configuration_details: Record<string, string>;
}



interface ChartDataFormat {
  labels: string[];
  categories?: string[];
  values: number[] | number[][];
  isStacked?: boolean;
}

interface ChartData {
  chart_type: 'bar' | 'line' | 'pie';
  data_format: {
    labels: string[];
    categories: string[];
    values: number[][] | number[]; // nested for bar/line, flat for pie
    isStacked: boolean;
  };
  insight: string[];
}

// interface MasterDataItem {
//   id: number;
//   table_name: string;
//   file_name: string;
// }



interface MasterDataItem {
  id: string;
  fieldName: string;
  fieldDescription: string;
  fieldType: string;
  fieldLength: string;
  fieldValue: string;
}

interface MasterDataTable {
  id: string;
  table_name: string;
  description: string;
}



type DocumentationColumn = {
  column_name: string;
  description: string;
};

type DocumentationItem = {
  id: string;
  data_source_id: number;
  source_name: string;
  source_type: string;
  columns: DocumentationColumn[];
};

interface PromptComment {
  id: number;           // ✅ 'id' not 'comment_id'
  comment_text: string;
  prompt_id: number;
  user_id: number | null;
  user_name: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}




export default function Page() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const boardId = searchParams.get("board_id");
  const mainBoardId = searchParams.get("main_board_id");
  // type Prompt = {
  //   id: string;
  //   prompt_text: string;
  //   user_name: string;
  // };
  const [promptRunInfo, setPromptRunInfo] = useState<Record<string, {
  sourceName: string | null;
  filteredVersion: string | null;
}>>({});
  const [promptOutputTypes, setPromptOutputTypes] = useState<Record<string, string>>({});
  const [isDropdownOpenn, setIsDropdownOpenn] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  // Map of prompt id → translated prompt_text (for current language)
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  // Map of prompt id → translated prompt_title (for current language)
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [, setLoading] = useState(false);
  const [, setShowCharts] = useState(false);
  type TableRow = {
    approval_status: 'pending' | 'approved' | 'rejected';
    id: string;
    table_name: string;
    table_description: string;
    files: {
      approval_status: 'pending' | 'approved' | 'rejected';
      id: string;
      month_year: string;
      filename: string;
      created_at: string;
    }[];
  };

  const [rows, setRows] = useState<TableRow[]>([]);

  // const loggedInUserEmail = localStorage.getItem('loggedInUserEmail');
  // const [data, setData] = useState([]);
  const [newPromptName, setNewPromptName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // const [loadingManageTables, setLoadingManageTables] = useState(false);
  // const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModallOpen, setIsModallOpen] = useState(false);
  type RunResult = {
    data: any;
    message: string[];
    table: {
      columns: string[];
      data: string[][];
    };
    charts: ChartData[];
  };

  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [translatedResultColumns, setTranslatedResultColumns] = useState<string[]>([]);
  const [translatedResultData, setTranslatedResultData] = useState<string[][]>([]);
  const [translatedResultMessages, setTranslatedResultMessages] = useState<string[]>([]);
  const [translatedPromptDisplay, setTranslatedPromptDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tableSortCol, setTableSortCol] = useState<number | null>(null);
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('asc');
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [view,] = useState("manage-tables");
  const [isRunClicked, setIsRunClicked] = useState(false);
  const [hasReprompted, setHasReprompted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptEnRef = useRef(''); // English original — always sent to API
  const [translatedPromptInput, setTranslatedPromptInput] = useState('');
  const isApplyingTranslation = useRef(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tableName: "",
    tableDescription: "",
  });
  const [editPromptId, setEditPromptId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [, setLoadingPromptPlay] = useState<string | null>(null);
  const [loadingPromptsRepository,] = useState(false);
  const [activeTab, setActiveTab] = useState("prompts"); // State to manage active tab
  const [returnTab, setReturnTab] = useState("prompts"); // Tab to return to when closing result modal
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<TableRow | null>(null);
  const [, setDocId] = useState<string | null>(null);
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [editRowKey, setEditRowKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});

  const [isOpen, setIsOpen] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  // const [comments, setComments] = useState<Comment[]>([]);

  // const [savedComments, setSavedComments] = useState<Comment[]>([]);
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);


  const [promptsLoading, setPromptsLoading] = useState(false);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);

  const [isUploadModalOpenMaster, setUploadModalOpenMaster] = useState(false);
  const [selectedFileMaster, setSelectedFileMaster] = useState<File | null>(null);
  const [itemss, setItemss] = useState<MasterDataItem[]>([]); // To store fetched items
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);
  const [tableNameMaster, setTableNameMaster] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValuess, setEditValuess] = useState<Partial<MasterDataItem>>({});
  const [showTableModal, setShowTableModal] = useState(false);
  const [tables, setTables] = useState<MasterDataTable[]>([]);
  const [newTable, setNewTable] = useState({
    table_name: '',
    description: ''
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTable, setEditingTable] = useState<MasterDataTable | null>(null);
  const [editTableData, setEditTableData] = useState({
    table_name: '',
    description: ''
  });


  const [showDeleteModal, setShowDeleteModal] = useState(false);
  type MasterDataTable = { id: string; table_name: string; description?: string }; // Add/adjust this type as needed
  const [settingsToDelete, setSettingsToDelete] = useState<MasterDataTable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dropDownOpen, setDropDownOpen] = useState<Record<string, boolean>>({});
  const [loadingg, setLoadingg] = useState(false);
  const [errorr, setErrorr] = useState<string | null>(null);
  const [rowss, setRowss] = useState<MasterDataItem[]>([
    // {
    //   id: '1',
    //   fieldName: 'z.company_name',
    //   fieldDescription: 'z.company_description',
    //   fieldType: 'character',
    //   fieldLength: 'length',
    //   fieldValue: 'value'
    // }
  ]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({ email: '', subject: '', message: '', tableOption: 'limited', reportType: '' });
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date();
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // Format: YYYY-MM-DD
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    rowToDelete: TableRow | null;
  }>({
    isOpen: false,
    rowToDelete: null,
  });



  const [isViewTablesModalOpen, setIsViewTablesModalOpen] = useState(false);
  const [pgTables, setPgTables] = useState<any[]>([]);
  const [pgTablesLoading, setPgTablesLoading] = useState(false);
  const [pgDbInfo, setPgDbInfo] = useState<{ database_name: string; table_count: number } | null>(null);

  const [searchTermRepository, setSearchTermRepository] = useState("");


  const [isSavingInfoObject, setIsSavingInfoObject] = useState(false);
  const [isDeletingInfoObject, setIsDeletingInfoObject] = useState(false);

  // Filter repository prompts based on search term
  const filteredRepositoryPrompts = prompts.filter(prompt =>
    prompt.prompt_text.toLowerCase().includes(searchTermRepository.toLowerCase()) ||
    (prompt.user_name && prompt.user_name.toLowerCase().includes(searchTermRepository.toLowerCase()))
  );
  // const [prompts, setPrompts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [filteredPrompt, setFilteredPrompt] = useState<Prompt[]>([]);


  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [filterStatusMap, setFilterStatusMap] = useState<Record<number, boolean>>({});


  // New states for approval functionality
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedApprovalItem, setSelectedApprovalItem] = useState<{
    type: 'table' | 'file';
    id: string;
    tableId?: string;
    name: string;
  } | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  const [dataSources, setDataSources] = useState<any[]>([]);
  const [dataSourcesLoading, setDataSourcesLoading] = useState(false);

  const [selectedPgTable, setSelectedPgTable] = useState<any | null>(null);
  const [showAddDataSourceModal, setShowAddDataSourceModal] = useState(false);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [resultTab, setResultTab] = useState('message');
  const [addDataSourceForm, setAddDataSourceForm] = useState({
    source_name: "",
    description: "",
    row_limit: 100000,
  });
  const [isAddingDataSource, setIsAddingDataSource] = useState(false);
  const [data, setData] = useState<DocumentationItem[]>([]);
  const [dataFiltered, setDataFiltered] = useState<DocumentationItem[]>([]);

  const [deleteDataSourceConfirm, setDeleteDataSourceConfirm] = useState<{
    isOpen: boolean;
    source: any | null;
  }>({ isOpen: false, source: null });
  const [isDeletingDataSource, setIsDeletingDataSource] = useState(false);
  const [anyFilterEnabled, setAnyFilterEnabled] = useState<boolean | null>(null);
const [paramFilterMap, setParamFilterMap] = useState<Record<number, boolean>>({}); 

const fetchParamFilterStatuses = async () => {
  if (!boardId || dataSources.length === 0) return;
  try {
    const map: Record<number, boolean> = {};
    await Promise.allSettled(
      dataSources.map(async (ds) => {
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/parameter-settings/data-source/${ds.id}/settings`,
            { headers: { "X-API-Key": EXCEL_API_KEY } }
          );
          if (!res.ok) return;
          const json = await res.json();
          const items: any[] = Array.isArray(json) ? json
            : Array.isArray(json.settings) ? json.settings
            : json.parameter_setting ? [json.parameter_setting]
            : json.id ? [json] : [];
          items.forEach((item: any) => {
            if (item.is_filter_enabled !== undefined) {
              map[Number(ds.id)] = Boolean(item.is_filter_enabled);
            }
          });
        } catch {}
      })
    );
    setParamFilterMap(map);
    setAnyFilterEnabled(Object.values(map).some(v => v === true));
  } catch {}
};

useEffect(() => {
  if (typeof window !== 'undefined' && !sessionStorage.getItem('currentUserData')) {
    router.replace('/Login');
  }
}, []);

// Auto-translate prompt_text AND prompt_title when language or prompts list changes
useEffect(() => {
  if (language === 'en' || prompts.length === 0) {
    setTranslatedTexts({});
    setTranslatedTitles({});
    return;
  }

  // Translate the main prompt_text (what's shown in cards)
  const texts = prompts.map((p) => p.prompt_text || '');
  translateBatch(texts, language).then((translated) => {
    const map: Record<string, string> = {};
    prompts.forEach((p, i) => { map[p.id] = translated[i] || texts[i]; });
    setTranslatedTexts(map);
  });

  // Also translate prompt_title (shown in the View Prompts drawer)
  const titles = prompts.map((p) => p.prompt_title || '');
  const hasAnyTitle = titles.some(t => t.trim() !== '');
  if (hasAnyTitle) {
    translateBatch(titles, language).then((translated) => {
      const map: Record<string, string> = {};
      prompts.forEach((p, i) => { if (p.prompt_title) map[p.id] = translated[i] || titles[i]; });
      setTranslatedTitles(map);
    });
  }
}, [language, prompts]);

// Debounce: auto-translate the prompt input textarea when language is not English
useEffect(() => {
  if (language === 'en') {
    setTranslatedPromptInput('');
    return;
  }
  const en = promptEnRef.current.trim();
  if (!en || isApplyingTranslation.current) return;

  const timer = setTimeout(() => {
    translateText(en, language).then(translated => {
      if (translated && translated !== en) {
        isApplyingTranslation.current = true;
        setTranslatedPromptInput(translated);
        setTimeout(() => { isApplyingTranslation.current = false; }, 100);
      }
    });
  }, 700);
  return () => clearTimeout(timer);
}, [newPromptName, language]);

// Translate run result (table columns, table data strings, messages, prompt display) when language or result changes
useEffect(() => {
  if (!runResult || language === 'en') {
    setTranslatedResultColumns([]);
    setTranslatedResultData([]);
    setTranslatedResultMessages([]);
    setTranslatedPromptDisplay('');
    return;
  }

  const columns = runResult.table?.columns ?? [];
  const messages: string[] = Array.isArray(runResult.message) ? runResult.message : (runResult.message ? [runResult.message as unknown as string] : []);
  const tableData = runResult.table?.data ?? [];
  const promptText = selectedPrompt || '';

  // Apply number formatting synchronously first; collect string cells for translation
  const formattedData: string[][] = tableData.map(row => [...row]);
  const stringCellCoords: { row: number; col: number }[] = [];
  const stringCellTexts: string[] = [];
  tableData.forEach((row, r) => {
    row.forEach((cell, c) => {
      const str = String(cell ?? '');
      if (!str) return;
      if (!isNaN(Number(str))) {
        formattedData[r][c] = formatNumber(str, language);
      } else {
        stringCellCoords.push({ row: r, col: c });
        stringCellTexts.push(str);
      }
    });
  });

  const allTexts = [...columns, ...messages, promptText, ...stringCellTexts];
  if (!allTexts.some(t => t.trim())) {
    setTranslatedResultData(formattedData);
    return;
  }

  translateBatch(allTexts, language).then(translated => {
    const colEnd = columns.length;
    const msgEnd = colEnd + messages.length;
    const promptIdx = msgEnd;
    const cellStart = promptIdx + 1;

    setTranslatedResultColumns(translated.slice(0, colEnd));
    setTranslatedResultMessages(translated.slice(colEnd, msgEnd));
    setTranslatedPromptDisplay(translated[promptIdx] || promptText);

    // Apply string translations on top of the already-number-formatted data
    stringCellCoords.forEach(({ row, col }, i) => {
      formattedData[row][col] = translated[cellStart + i] || tableData[row][col];
    });
    setTranslatedResultData(formattedData);
  });
}, [runResult, language, selectedPrompt]);

useEffect(() => {
  if (boardId) {
    fetchDataSources();
  }
}, [boardId]);

useEffect(() => {
  if (dataSources.length === 0) return;
  
  fetchParamFilterStatuses(); // initial fetch
  
  // Poll every 5 seconds when on parameter tab
  const interval = setInterval(() => {
    if (activeTab === "parameter" || activeTab === "prompts") {
      fetchParamFilterStatuses();
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, [dataSources, activeTab]);

  const fetchFilterStatuses = async () => {
  if (!boardId || dataSources.length === 0) return;
  try {
    const statusMap: Record<number, boolean> = {};
    await Promise.allSettled(
      dataSources.map(async (ds) => {
        const res = await fetch(
          `${API_BASE_URL}/main-boards/boards/data-sources/${ds.id}/settings`,
          { headers: { "X-API-Key": EXCEL_API_KEY } }
        );
        if (res.ok) {
          const json = await res.json();
          const items: any[] = Array.isArray(json) ? json : json.settings || [];
          items.forEach((item: any) => {
            if (item.is_filter_enabled !== undefined) {
              statusMap[Number(ds.id)] = Boolean(item.is_filter_enabled);
            }
          });
        }
      })
    );
    setFilterStatusMap(statusMap);
  } catch (e) {}
};


  const handleDeleteDataSource = async () => {
    if (!deleteDataSourceConfirm.source) return;

    let userId: string | null = null;
    const currentUserData = sessionStorage.getItem("currentUserData");
    if (currentUserData) {
      try {
        const parsed = JSON.parse(currentUserData);
        userId = String(parsed.userId);
      } catch (e) { }
    }
    if (!userId) { toast.error("User session not found."); return; }

    setIsDeletingDataSource(true);
    try {
      const sourceId = deleteDataSourceConfirm.source.id;
      const deletedTableId = deleteDataSourceConfirm.source?.data_management_table_id;

      // Single API that handles everything (data source + files + table)
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/data-sources/${sourceId}/complete?user_id=${parseInt(userId, 10)}`,
        {
          method: "DELETE",
          headers: { accept: "application/json", "X-API-Key": EXCEL_API_KEY },
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to delete data source");

      // Update local state
      if (deletedTableId) {
        setRows(prev => prev.filter(r => String(r.id) !== String(deletedTableId)));

        // localStorage safety net for refresh
        const storageKey = `deleted_table_ids_board_${boardId}`;
        const existing: string[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (!existing.includes(String(deletedTableId))) {
          existing.push(String(deletedTableId));
          localStorage.setItem(storageKey, JSON.stringify(existing));
        }
      }

      toast.success(`Data source deleted! .`);
      await fetchDataSources();
      setDeleteDataSourceConfirm({ isOpen: false, source: null });

    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsDeletingDataSource(false);
    }
  };

  const handleAddPgTableAsDataSource = async () => {
    if (!selectedPgTable) return;

    let userId: string | null = null;
    const currentUserData = sessionStorage.getItem("currentUserData");
    if (currentUserData) {
      try {
        const parsed = JSON.parse(currentUserData);
        userId = String(parsed.userId);
      } catch (e) {
        console.error("Failed to parse session:", e);
      }
    }

    if (!userId) {
      toast.error("User session not found. Please log in again.");
      return;
    }

    setIsAddingDataSource(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/data-sources/board/${boardId}/add-pg?user_id=${parseInt(userId, 10)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
            "X-API-Key": EXCEL_API_KEY,
          },
          body: JSON.stringify({
            table_name: selectedPgTable.table_name,
            source_name: addDataSourceForm.source_name,
            description: addDataSourceForm.description,
            row_limit: addDataSourceForm.row_limit,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || "Failed to add data source");
      }

      toast.success(`Table "${selectedPgTable.table_name}" added as data source! (Slot ${data.slot_number}/${data.total_slots})`);
      fetchDataSources();
      setShowAddDataSourceModal(false);
      setSelectedPgTable(null);
      setAddDataSourceForm({ source_name: "", description: "", row_limit: 100000 });
    } catch (error: any) {
      console.error("Failed to add data source:", error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsAddingDataSource(false);
    }
  };




  const fetchDataSources = async () => {
    let userId: string | null = null;
    const currentUserData = sessionStorage.getItem("currentUserData");
    if (currentUserData) {
      try {
        const parsed = JSON.parse(currentUserData);
        userId = String(parsed.userId);
      } catch (e) { }
    }

    if (!userId || !boardId) return;

    setDataSourcesLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/data-sources/board/${boardId}?user_id=${parseInt(userId, 10)}`,
        {
          headers: {
            accept: "application/json",
            "X-API-Key": EXCEL_API_KEY,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch data sources");
      const data = await response.json();
      setDataSources(data);
    } catch (error) {
      console.error("Failed to fetch data sources:", error);
    } finally {
      setDataSourcesLoading(false);
    }
  };

  // Call it when tables tab is active
  useEffect(() => {
    if (boardId) {
      fetchDataSources(); // ✅ always fetch, not just for tables tab
    }
  }, [boardId]);

  // ADD THIS NEW ONE:
useEffect(() => {
  if (dataSources.length > 0) {
    fetchFilterStatuses();
  }
}, [dataSources]);


  // Add this helper function near your other helpers
  const getDatasetName = (prompt: Prompt): string | null => {
    // Direct field from API
    if (prompt.dataset_name) return prompt.dataset_name;

    // Cross-reference with dataSources using data_source_id
    if (prompt.data_source_id && dataSources.length > 0) {
      const match = dataSources.find(
        ds => ds.id === prompt.data_source_id || ds.data_source_id === prompt.data_source_id
      );
      if (match) return match.source_name || match.name;
    }

    return null;
  };


  // Export as TXT
  const downloadPromptsAsTXT = () => {
    const promptsToDownload = searchTerm ? filteredPrompts : prompts;

    if (promptsToDownload.length === 0) {
      toast.error("No prompts to download");
      return;
    }

    let textContent = "PROMPTS EXPORT\n";
    textContent += `Exported on: ${new Date().toLocaleString()}\n`;
    textContent += `Total Prompts: ${promptsToDownload.length}\n`;
    textContent += "=".repeat(80) + "\n\n";

    promptsToDownload.forEach((prompt, index) => {
      // textContent += `${index + 1}. ${prompt.prompt_title || 'Untitled Prompt'}\n`;
      // textContent += `-`.repeat(80) + "\n";
      textContent += `Prompt Text: ${prompt.prompt_text}\n`;
      // textContent += `Created By: ${prompt.user_name || prompt.created_by || 'Unknown'}\n`;
      // textContent += `Created At: ${new Date(prompt.created_at).toLocaleString()}\n`;
      // textContent += `Updated At: ${new Date(prompt.updated_at).toLocaleString()}\n`;
      textContent += "\n" + "=".repeat(80) + "\n\n";
    });

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompts_board_${boardId}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${promptsToDownload.length} prompts as TXT!`);
    setShowExportModal(false);
  };


  const handleSubmitMultipleFiles = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();

    if (!selectedDate || selectedFiles.length === 0) {
      toast.error('Please select both date and files');
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData object
      const formData = new FormData();

      // IMPORTANT: API expects 'month_year' not 'date'
      formData.append('month_year', selectedDate);

      // IMPORTANT: API expects 'file' (singular) not 'files' (plural)
      // Note: The API documentation shows it accepts a single file, not multiple
      // If you need to support multiple files, you might need to make multiple API calls
      selectedFiles.forEach((file) => {
        formData.append('file', file); // Changed from 'files' to 'file'
      });

      // Make API call
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/data-management-table/status/upload/${selectedTableId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'X-API-Key': EXCEL_API_KEY,
            // Don't set Content-Type header - let browser set it with boundary
          },
          body: formData, // YOU WERE MISSING THIS!
        }
      );

      if (!response.ok) {
        // Try to get error details
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      // console.log('Upload success:', result);

      // Handle success
      toast.success("Files uploaded successfully!");
      handleCloseUploadModal();

      // Optionally refresh your data table
      // fetchTableData();

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('An unknown error occurred. Please try again later.');
    } finally {
      setIsUploading(false);
    }

    // After successful upload
    await fetchDataSources(); // refresh approved sources
    await fetchRows();        // refresh info-objects list (whatever your rows fetch fn is)
  };

  const handleViewTables = async () => {
    let userId: string | null = null;

    // Read from sessionStorage (where login stores it)
    const currentUserData = sessionStorage.getItem("currentUserData");
    if (currentUserData) {
      try {
        const parsed = JSON.parse(currentUserData);
        userId = String(parsed.userId);
      } catch (e) {
        console.error("Failed to parse currentUserData from sessionStorage:", e);
      }
    }

    if (!userId) {
      toast.error("User session not found. Please log in again.");
      return;
    }

    setPgTablesLoading(true);
    setIsViewTablesModalOpen(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/data-sources/pg-tables/${boardId}?user_id=${parseInt(userId, 10)}`,
        {
          headers: {
            accept: "application/json",
            "X-API-Key": EXCEL_API_KEY,
          },
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      // console.log("PG Tables API response:", data);
      setPgTables(data.tables || []);
      setPgDbInfo({
        database_name: data.database_name,
        table_count: data.table_count,
      });
    } catch (error) {
      console.error("Failed to fetch PG tables:", error);
      setPgTables([]);
    } finally {
      setPgTablesLoading(false);
    }
  };

  // Export as CSV
  const downloadPromptsAsCSV = () => {
    const promptsToDownload = searchTerm ? filteredPrompts : prompts;

    if (promptsToDownload.length === 0) {
      toast.error("No prompts to download");
      return;
    }

    const headers = ['No.', 'Prompt Text', 'Created By', 'Created At', 'Updated At'];

    const rows = promptsToDownload.map((prompt, index) => [
      index + 1,
      // `"${(prompt.prompt_title || 'Untitled').replace(/"/g, '""')}"`,
      `"${prompt.prompt_text.replace(/"/g, '""')}"`,
      `"${(prompt.user_name || prompt.created_by || 'Unknown').replace(/"/g, '""')}"`,
      new Date(prompt.created_at).toLocaleString(),
      new Date(prompt.updated_at).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompts_board_${boardId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${promptsToDownload.length} prompts as CSV!`);
    setShowExportModal(false);
  };

  const handleImportPrompts = async (fileArg?: File) => {
    const file = fileArg ?? importFile;
    if (!file) {
      toast.error("Please select a file to import");
      return;
    }

    if (!boardId) {
      toast.error("Board ID is missing");
      return;
    }

    setIsImporting(true);

    try {
      const fileContent = await file.text();
      let promptsToImport: { prompt_text: string; prompt_title?: string }[] = [];

      // Parse based on file type
      if (file.name.endsWith('.csv')) {
        // Parse CSV
        const lines = fileContent.split('\n').slice(1); // Skip header
        const parsed = lines
          .filter(line => line.trim())
          .map(line => {
            const match = line.match(/^\d+,(".*?"|[^,]*),(".*?"|[^,]*)/);
            if (match) {
              const title = match[1].replace(/^"|"$/g, '').replace(/""/g, '"');
              const text = match[2].replace(/^"|"$/g, '').replace(/""/g, '"');
              return { prompt_title: title, prompt_text: text };
            }
            return null;
          })
          .filter((p): p is { prompt_text: string; prompt_title: string } => p !== null);
      } else {
        // Parse TXT
        const sections = fileContent.split('='.repeat(80));
        promptsToImport = sections
          .slice(1) // Skip header
          .filter(section => section.trim())
          .map(section => {
            const titleMatch = section.match(/\d+\.\s*(.*?)\n/);
            const textMatch = section.match(/Prompt Text:\s*(.*?)\n/);

            if (textMatch) {
              return {
                prompt_title: titleMatch ? titleMatch[1].trim() : 'Imported Prompt',
                prompt_text: textMatch[1].trim()
              };
            }
            return null;
          })
          .filter((p): p is { prompt_text: string; prompt_title: string } => p !== null);
      }

      if (promptsToImport.length === 0) {
        toast.error("No valid prompts found in the file");
        setIsImporting(false);
        return;
      }

      // Get logged-in user info
      let loggedInUserName = localStorage.getItem('loggedInUserName') || 'Unknown User';

      // Import each prompt
      let successCount = 0;
      let failCount = 0;

      for (const prompt of promptsToImport) {
        try {
          const promptData = {
            board_id: boardId,
            prompt_text: prompt.prompt_text,
            prompt_title: prompt.prompt_title || 'Imported Prompt',
            prompt_out: "out_string",
            user_name: loggedInUserName,
            created_by: loggedInUserName
          };

          const response = await fetch(
            `${API_BASE_URL}/main-boards/boards/prompts/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": EXCEL_API_KEY
              },
              body: JSON.stringify(promptData),
            }
          );

          if (response.ok) {
            const newPrompt = await response.json();
            setPrompts(prev => [...prev, newPrompt]);
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error("Error importing prompt:", error);
          failCount++;
        }
      }

      setIsImporting(false);
      setImportFile(null);
      setShowImportModal(false);

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} prompt${successCount > 1 ? 's' : ''}!`);
      }
      if (failCount > 0) {
        toast.warning(`Failed to import ${failCount} prompt${failCount > 1 ? 's' : ''}`);
      }

    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read the import file");
      setIsImporting(false);
    }
  };

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  const [mainBoardDisplayName, setMainBoardDisplayName] = useState<string>("");
  const [boardDisplayName, setBoardDisplayName] = useState<string>("");

  useEffect(() => {
    if (!mainBoardId || !boardId) return;
    let userId = "";
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("currentUserData") : null;
    if (stored) {
      try { userId = JSON.parse(stored).userId || ""; } catch { /* */ }
    }
    if (!userId) return;
    fetch(`${API_BASE_URL}/main-boards/get_all_info_tree?user_id=${userId}`, {
      headers: { Accept: "application/json", "X-API-Key": EXCEL_API_KEY },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: Array<{ id?: string | number; main_board_id: string; name: string; boards: Record<string, { name: string; is_active: boolean }> }> | null) => {
        if (!Array.isArray(data)) return;
        const mb = data.find(m => String(m.main_board_id) === String(mainBoardId) || String(m.id) === String(mainBoardId));
        if (mb) {
          setMainBoardDisplayName(mb.name || "");
          const board = mb.boards?.[boardId];
          if (board) setBoardDisplayName(board.name || "");
        }
      })
      .catch(() => { /* silently fail */ });
  }, [mainBoardId, boardId]);

  // Add this useEffect to filter prompts based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredPrompt(prompts);
    } else {
      const query = searchTerm.toLowerCase();
      const filtered = prompts.filter(prompt =>
        (prompt.prompt_title && prompt.prompt_title.toLowerCase().includes(query)) ||
        (prompt.prompt_text && prompt.prompt_text.toLowerCase().includes(query))
      );
      setFilteredPrompt(filtered);
    }
  }, [prompts, searchTerm]);

  // Filter prompts based on search term
  const filteredPrompts = prompts.filter(prompt =>
    prompt.prompt_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (prompt.user_name && prompt.user_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filter tables based on approval status
  const filteredTablesByApproval = rows.filter(row => {
    if (approvalFilter === 'all') return true;
    return row.approval_status === approvalFilter;
  });

  // Fetch user details from localStorage (Replace this with API call if needed)
  const [user, setUser] = useState({
    name: "",
    email: "",
    id: "",
    role: "",
  });



  // Fetch user details from localStorage inside useEffect
  useEffect(() => {
    const currentUserData = sessionStorage.getItem("currentUserData");
    if (currentUserData) {
      try {
        const parsed = JSON.parse(currentUserData);
        setUser({
          name: parsed.userName || "",
          email: parsed.email || "",
          id: String(parsed.userId) || "",
          role: parsed.userRole || "",
        });
      } catch (e) {
        console.error("Failed to parse user session:", e);
      }
    }
  }, []);


  // Toggle dropdown visibility
  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };


  const toggleDropdowns = (id: SetStateAction<string | null>) => {
    setIsDropdownOpenn(isDropdownOpenn === id ? null : id);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);




  // Direct approval without modal
 // Direct approval without modal
  const handleDirectApprove = async (type: 'table' | 'file', id: string, tableId?: string) => {
    try {
      let endpoint;
      let userId: string | null = null;

      const currentUserData = sessionStorage.getItem("currentUserData");
      if (currentUserData) {
        try {
          const parsed = JSON.parse(currentUserData);
          userId = String(parsed.userId);
        } catch (e) {
          console.error("Failed to parse session:", e);
        }
      }

      if (!userId) {
        toast.error("User session not found. Please log in again.");
        return;
      }

      if (type === 'table') {
        const tableRow = rows.find(r => r.id === id);
        if (!tableRow) {
          toast.error("Table not found");
          return;
        }

        const loadingToast = toast.loading("Adding CSV as data source...");

        try {
          // STEP 1: Add CSV as data source
          const addCsvResponse = await fetch(
            `${API_BASE_URL}/main-boards/boards/data-sources/board/${boardId}/add-csv?user_id=${parseInt(userId, 10)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": EXCEL_API_KEY
              },
              body: JSON.stringify({
                data_management_table_id: parseInt(id, 10),
                source_name: tableRow.table_name,
                description: tableRow.table_description
              }),
            }
          );

          if (!addCsvResponse.ok) {
            const errorData = await addCsvResponse.json();
            toast.dismiss(loadingToast);
            toast.error(`Failed to add CSV: ${errorData.detail || errorData.message || "Unknown error"}`);
            return;
          }

          const csvResult = await addCsvResponse.json();

          // STEP 2: Try approve — but don't fail if CORS blocks it on localhost
          try {
            const approveResponse = await fetch(
              `${API_BASE_URL}/main-boards/boards/data-management-table/status/approve/${id}?new_approval_status=true`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "X-API-Key": EXCEL_API_KEY
                }
              }
            );
            if (!approveResponse.ok) {
              console.warn("Approve endpoint failed — continuing with optimistic UI update");
            }
          } catch (approveError) {
            // CORS on localhost — safe to ignore, works fine in production
            console.warn("Approve CORS error (localhost only):", approveError);
          }

          // STEP 3: Update UI optimistically regardless
          setRows((prevRows) =>
            prevRows.map((row) =>
              row.id === id ? { ...row, approval_status: 'approved' } : row
            )
          );

          toast.dismiss(loadingToast);
          toast.success(
            `✅ Info-Object approved and added to Slot ${csvResult.slot_number}/${csvResult.total_slots}!`,
            { autoClose: 4000 }
          );

          try {
            await fetchDataSources();
          } catch (e) {
            console.warn("fetchDataSources failed silently:", e);
          }

        } catch (error) {
          toast.dismiss(loadingToast);
          console.error("Error in approval process:", error);
          toast.error("An error occurred during approval");
        }


      } else {
        endpoint = `${API_BASE_URL}/main-boards/boards/data-management-table/status/approve/${id}?new_approval_status=true`;

        const response = await fetch(endpoint, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": EXCEL_API_KEY
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          toast.error(`Failed to approve: ${errorData.message || "Unknown error"}`);
          return;
        }

        setRows((prevRows) =>
          prevRows.map((row) => {
            if (row.id === tableId) {
              return {
                ...row,
                files: row.files.map((file) =>
                  file.id === id ? { ...file, approval_status: 'approved' } : file
                ),
              };
            }
            return row;
          })
        );
        toast.success("File approved successfully!");

        // ✅ fetchDataSources inside its own try so errors don't trigger outer catch
        try {
          await fetchDataSources();
        } catch (e) {
          console.warn("fetchDataSources failed silently:", e);
        }
      }

    } catch (error) {
      console.error("Error approving:", error);
      toast.error("An error occurred while approving");
    }
    // ❌ removed: await fetchDataSources() — was causing outer catch to fire
  };
  // Multiple file upload handler
  const handleMultipleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    setSelectedFiles(files);
  };




  const generatePPTBlob = async (includeTable: boolean | undefined, tableOption: string | undefined) => {
    try {
      // Convert parameters to match backend expectations
      const params = new URLSearchParams();
      params.append('include_charts', 'true');
      params.append('include_summary', 'true');

      // Ensure parameters are properly formatted
      if (includeTable !== undefined) {
        params.append('include_table', String(includeTable));
      }
      if (tableOption) {
        params.append('table_option', tableOption);
      }

      const response = await fetch(
        `http://localhost:8002/client-users/generate-ppt?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            "X-API-Key": "xxAJf365FZZidPt496lk9M2XDbvQCMKevOSuBgx2k6BAjp3ALe4vLTjXtcmgatoQtvsSLED3lx7zEgyHcohd1Wa2iJWTlukzQTuauvTbGYjSgMtFq5AUQLuAcMW44mp",
          },
        }
      );

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          // Handle different error response formats
          if (typeof errorData === 'string') {
            errorDetails = errorData;
          } else if (errorData.detail) {
            errorDetails = errorData.detail;
          } else if (errorData.message) {
            errorDetails = errorData.message;
          } else if (errorData.errors) {
            errorDetails = Object.entries(errorData.errors)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
          } else {
            errorDetails = JSON.stringify(errorData);
          }
        } catch (e) {
          errorDetails = `Failed to parse error response (Status ${response.status})`;
        }
        throw new Error(errorDetails);
      }

      return await response.blob();
    } catch (error) {
      console.error('PPT generation failed:', error);
      const errorMessage = error instanceof Error ?
        error.message :
        typeof error === 'object' ?
          JSON.stringify(error, null, 2) :
          String(error);
      throw new Error(`PPT generation failed: ${errorMessage}`);
    }
  };


  const sendViaEmail = async (includeTable: boolean | undefined, tableOption: string | undefined) => {
    if (!emailData.email) {
      toast.error('Please enter a recipient email address');
      return;
    }
    try {
      // Generate PPT client-side using PptxGenJS (same as download, avoids CORS/backend issues)
      const pptBase64 = await downloadPPT(
        includeTable ?? true,
        tableOption ?? 'limited',
        true
      ) as string;

      if (!pptBase64) {
        throw new Error('Failed to generate PPT — please check that there is chart/table data available.');
      }

      // Send via Next.js API route (uses nodemailer server-side, no CORS)
      const response = await fetch('/api/send-report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: emailData.email,
          subject: emailData.subject || 'Your Data Analysis Report',
          message: emailData.message || '',
          reportType: includeTable ? 'complete' : 'charts-only',
          tableOption: tableOption || 'limited',
          pptBase64,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errMsg = result.error || result.message || `HTTP ${response.status}`;
        if (errMsg.includes('OverQuota') || errMsg.includes('out of storage space')) {
          throw new Error("The recipient's email inbox is full. Please use a different email address.");
        }
        throw new Error(errMsg);
      }

      toast.success('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to send email: ${errorMessage}`);
    } finally {
      setShowEmailModal(false);
      setShowDownloadModal(false);
    }
  };



  const downloadPrompts = () => {
    // Get the prompts to download (use filtered if there's a search, otherwise all prompts)
    const promptsToDownload = searchTerm ? filteredPrompts : prompts;

    if (promptsToDownload.length === 0) {
      toast.error("No prompts to download");
      return;
    }

    // Format the prompts as text
    let textContent = "PROMPTS EXPORT\n";
    textContent += `Exported on: ${new Date().toLocaleString()}\n`;
    textContent += `Total Prompts: ${promptsToDownload.length}\n`;
    textContent += "=".repeat(80) + "\n\n";

    promptsToDownload.forEach((prompt, index) => {
      // textContent += `${index + 1}. ${prompt.prompt_title || 'Untitled Prompt'}\n`;
      // textContent += `-`.repeat(80) + "\n";
      textContent += `Prompt Text: ${prompt.prompt_text}\n`;
      // textContent += `Created By: ${prompt.user_name || prompt.created_by || 'Unknown'}\n`;
      // textContent += `Created At: ${new Date(prompt.created_at).toLocaleString()}\n`;
      // textContent += `Updated At: ${new Date(prompt.updated_at).toLocaleString()}\n`;
      textContent += "\n" + "=".repeat(80) + "\n\n";
    });


    //     const downloadPromptsAsCSV = () => {
    //   const promptsToDownload = searchTerm ? filteredPrompts : prompts;

    //   if (promptsToDownload.length === 0) {
    //     toast.error("No prompts to download");
    //     return;
    //   }

    //   // CSV headers
    //   const headers = ['No.', 'Title', 'Prompt Text', 'Created By', 'Created At', 'Updated At'];

    //   // Convert prompts to CSV rows
    //   const rows = promptsToDownload.map((prompt, index) => [
    //     index + 1,
    //     `"${(prompt.prompt_title || 'Untitled').replace(/"/g, '""')}"`,
    //     `"${prompt.prompt_text.replace(/"/g, '""')}"`,
    //     `"${(prompt.user_name || prompt.created_by || 'Unknown').replace(/"/g, '""')}"`,
    //     new Date(prompt.created_at).toLocaleString(),
    //     new Date(prompt.updated_at).toLocaleString()
    //   ]);

    //   // Combine headers and rows
    //   const csvContent = [
    //     headers.join(','),
    //     ...rows.map(row => row.join(','))
    //   ].join('\n');

    //   // Download
    //   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    //   const url = URL.createObjectURL(blob);
    //   const link = document.createElement('a');
    //   link.href = url;
    //   link.download = `prompts_${new Date().toISOString().split('T')[0]}.csv`;
    //   document.body.appendChild(link);
    //   link.click();
    //   document.body.removeChild(link);
    //   URL.revokeObjectURL(url);

    //   toast.success(`Downloaded ${promptsToDownload.length} prompts as CSV!`);
    // };

    // Create blob and download
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompts_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded ${promptsToDownload.length} prompts successfully!`);
  };


  // Add mainBoardId definition (replace with actual logic as needed)
  // const mainBoardId = searchParams.get("main_board_id") || ""; // or set a default/fallback value
  //view prompt button
  const handlePromptClick = (prompt: Prompt) => {
    setNewPromptName(prompt.prompt_text);
    setShowPromptsModal(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleViewPromptsClick = () => {
    setShowPromptsModal(true);
  };

  const handleClosePromptsModal = () => {
    setSearchTerm('');
    setShowPromptsModal(false);
    setCurrentPromptIndex(0);
  };

  interface PromptSuggestion {
    prompt_text: string;
    category: string;
    difficulty: string;
    columns_used: string[];
    confidence: number;
  }

  const [showGeneratePromptModal, setShowGeneratePromptModal] = useState(false);
  const [generatedSuggestions, setGeneratedSuggestions] = useState<PromptSuggestion[]>([]);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSearchTerm, setGenerateSearchTerm] = useState('');
  const [generateSourceName, setGenerateSourceName] = useState('');
  const [generatedPromptIds, setGeneratedPromptIds] = useState<Set<string>>(new Set());
  const [isSavingGenerated, setIsSavingGenerated] = useState(false);
  const [generateDone, setGenerateDone] = useState(false);

  // Load generated prompt IDs from localStorage when boardId is available
  useEffect(() => {
    if (!boardId) return;
    try {
      const stored = localStorage.getItem(`gen_prompt_ids_${boardId}`);
      if (stored) {
        setGeneratedPromptIds(new Set(JSON.parse(stored).map(String)));
      }
    } catch {}
  }, [boardId]);

  // Persist generateDone across sessions — load from localStorage on mount
  useEffect(() => {
    if (!boardId) return;
    try {
      if (localStorage.getItem(`generate_done_${boardId}`) === 'true') {
        setGenerateDone(true);
      }
    } catch {}
  }, [boardId]);

  const handleGeneratePrompt = async () => {
    if (!dataSources || dataSources.length === 0) {
      setGenerateError('No data source found. Please add a data source in Manage Tables first.');
      setGeneratedSuggestions([]);
      setShowGeneratePromptModal(true);
      return;
    }
    const source = dataSources[0];
    setGenerateSourceName(source.source_name || '');
    setShowGeneratePromptModal(true);
    setGenerateLoading(true);
    setGenerateError(null);
    setGeneratedSuggestions([]);
    try {
      const res = await fetch(`${API_BASE_URL}/prompt-suggestions/source/${source.id}`, {
        headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const byCategory: Record<string, PromptSuggestion[]> = data?.suggestions_by_category || {};
      const all: PromptSuggestion[] = Object.values(byCategory).flat();
      setGeneratedSuggestions(all);
    } catch {
      setGenerateError('Failed to generate prompt suggestions. Please try again.');
    } finally {
      setGenerateLoading(false);
    }
  };

  const filteredGeneratedSuggestions = generatedSuggestions.filter(s =>
    s.prompt_text.toLowerCase().includes(generateSearchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(generateSearchTerm.toLowerCase())
  );

  const handleGenerateAndSavePrompts = async () => {
    if (!dataSources || dataSources.length === 0) {
      toast.error('No data source found. Please add a data source in Manage Tables first.');
      return;
    }
    if (!boardId) {
      toast.error('Board ID is missing.');
      return;
    }
    const source = dataSources[0];
    setIsSavingGenerated(true);
    try {
      const res = await fetch(`${API_BASE_URL}/prompt-suggestions/source/${source.id}`, {
        headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const byCategory: Record<string, PromptSuggestion[]> = data?.suggestions_by_category || {};
      const all: PromptSuggestion[] = Object.values(byCategory).flat();
      if (all.length === 0) {
        toast.info('No prompt suggestions returned.');
        return;
      }

      let loggedInUserName: string | null = null;
      try {
        const currentUserData = sessionStorage.getItem('currentUserData');
        if (currentUserData) {
          const userData = JSON.parse(currentUserData);
          loggedInUserName = userData.userName;
        }
      } catch {}
      if (!loggedInUserName) {
        loggedInUserName = localStorage.getItem('loggedInUserName');
      }
      if (!loggedInUserName) loggedInUserName = 'AI';

      const newIds: string[] = [];
      const savedPrompts: Prompt[] = [];
      for (const suggestion of all) {
        const promptData = {
          board_id: boardId,
          prompt_text: suggestion.prompt_text.trim(),
          prompt_out: 'out_string',
          user_name: loggedInUserName,
          created_by: loggedInUserName,
        };
        const saveRes = await fetch(`${API_BASE_URL}/main-boards/boards/prompts/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': EXCEL_API_KEY },
          body: JSON.stringify(promptData),
        });
        if (saveRes.ok) {
          const saved: Prompt = await saveRes.json();
          savedPrompts.push(saved);
          newIds.push(String(saved.id));
        }
      }

      if (savedPrompts.length > 0) {
        setPrompts(prev => [...prev, ...savedPrompts]);
        setGeneratedPromptIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.add(id));
          try {
            localStorage.setItem(`gen_prompt_ids_${boardId}`, JSON.stringify([...next]));
          } catch {}
          return next;
        });
        toast.success(`${savedPrompts.length} generated prompt${savedPrompts.length > 1 ? 's' : ''} saved!`);
        setGenerateDone(true);
        try { localStorage.setItem(`generate_done_${boardId}`, 'true'); } catch {}
      }
    } catch {
      toast.error('Failed to generate and save prompts. Please try again.');
    } finally {
      setIsSavingGenerated(false);
    }
  };

  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, PromptComment[]>>({});
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');


  // Open comment modal and fetch comments for the prompt
  const handleCommentClick = async (promptId: string) => {
    setCurrentPromptId(promptId);
    setIsCommentOpen(true);
    setEditingCommentId(null);
    setCommentText('');
    await fetchComments(promptId);
  };


  // Fetch comments from API
  const fetchComments = async (promptId: string) => {
    try {
      setCommentsLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/prompts/${promptId}/comments?order_by=created_at&order_dir=DESC`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": EXCEL_API_KEY,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();

      // 👇 ADD THIS — check browser console to see actual field names
      // console.log('Comments API response:', JSON.stringify(data, null, 2));

      const comments: PromptComment[] = Array.isArray(data) ? data : data.comments || [];
      setCommentsMap(prev => ({ ...prev, [promptId]: comments }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Close comment modal
  const handleCloseComment = () => {
    setIsCommentOpen(false);
    setCommentText('');
    setEditingCommentId(null);
  };
  // Get comments for current prompt
  const getCurrentPromptComments = (): PromptComment[] => {
    if (!currentPromptId) return [];
    return commentsMap[currentPromptId] || [];
  };


  // Handle saving (create or update) a comment
  const handleSaveComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentPromptId) return;

    try {
      setCommentSaving(true);

      if (editingCommentId !== null) {
        const response = await fetch(
          `${API_BASE_URL}/main-boards/boards/prompts/comments/${editingCommentId}?comment_text=${encodeURIComponent(commentText)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": EXCEL_API_KEY,
            },
          }
        );
        if (!response.ok) throw new Error('Failed to update comment');
        const data = await response.json();
        const updatedComment: PromptComment = data.comment; // ✅ unwrap from { success, comment }

        setCommentsMap(prev => ({
          ...prev,
          [currentPromptId]: (prev[currentPromptId] || []).map(c =>
            c.id === editingCommentId ? updatedComment : c // ✅ replace with actual API response
          )
        }));
        setEditingCommentId(null);
      } else {
        const response = await fetch(
          `${API_BASE_URL}/main-boards/boards/prompts/${currentPromptId}/comments?comment_text=${encodeURIComponent(commentText)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": EXCEL_API_KEY,
            },
          }
        );
        if (!response.ok) throw new Error('Failed to create comment');
        const data = await response.json();
        const newComment: PromptComment = data.comment ?? data; // ✅ unwrap if wrapped

        setCommentsMap(prev => ({
          ...prev,
          [currentPromptId]: [newComment, ...(prev[currentPromptId] || [])] // ✅ shows immediately
        }));
      }

      setCommentText('');
    } catch (error) {
      console.error('Error saving comment:', error);
    } finally {
      setCommentSaving(false);
    }
  };


  const handleEditComment = (commentId: number) => {
    if (!currentPromptId) return;
    const commentToEdit = commentsMap[currentPromptId]?.find(c => c.id === commentId); // ✅ .id
    if (commentToEdit) {
      setCommentText(commentToEdit.comment_text);
      setEditingCommentId(commentId);
    }
  };

  // Handle deleting a comment
  const handleDeleteComment = async (commentId: number) => {
    if (!currentPromptId) return;
    try {
      setDeletingCommentId(commentId);
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/prompts/comments/${commentId}`,
        {
          method: "DELETE",
          headers: { "X-API-Key": EXCEL_API_KEY },
        }
      );
      if (!response.ok) throw new Error('Failed to delete comment');

      setCommentsMap(prev => ({
        ...prev,
        [currentPromptId]: (prev[currentPromptId] || []).filter(c => c.id !== commentId) // ✅ .id
      }));
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Format date for display
  const formatDate = (date: Date | string | number) => {
    if (!date) return '';
    return new Date(date).toLocaleString();
  };

  // Get comment count for a specific prompt
  const getCommentCount = (promptId: string): number => {
    return commentsMap[promptId]?.length || 0;
  };


  // Toggle dropdown
  const handleToggleDropdown = (id: SetStateAction<string | null>) => {
    setExpandedRow(prev => (prev === id ? null : id as string));
    setIsOpen(!isOpen);
  };

  // const toggleDropdowns = (rowId: string | boolean | ((prevState: boolean) => boolean)) => {
  //   setIsDropdownOpenn(isDropdownOpenn === rowId ? null : rowId as string);
  // };

  const [items, setItems] = useState<Item[]>([]);
  const [newItemMode, setNewItemMode] = useState<boolean>(false);
  const [isNewItemDropdownOpen, setIsNewItemDropdownOpen] = useState<boolean>(false);


  const [dropdownRows, setDropdownRows] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' },
  ]);

  const handleAddDropdownRow = () => {
    setDropdownRows([...dropdownRows, { key: '', value: '' }]);
  };

  const handleDropdownInputChange = (index: number, field: 'key' | 'value', value: string) => {
    const updatedRows = [...dropdownRows];
    updatedRows[index][field] = value; // Now TypeScript knows field is either 'key' or 'value'
    setDropdownRows(updatedRows);
  };

  const handleDeleteDropdownItem = (index: number) => {
    const updatedRows = dropdownRows.filter((_, i) => i !== index);
    setDropdownRows(updatedRows);
  };

  const handleEditDropdownItem = (index: number) => {
    // Logic to handle editing the dropdown row
    // console.log("Editing dropdown row at index:", index);
    // Example: Enable edit mode for the row or open a modal
  };

  // Mock functions for UI demonstration - these will be replaced with backend calls
  const handleAddItem = () => {
    // This will be replaced with your backend implementation
    setNewItemMode(false);
  };

  const handleEditItem = (id: number) => {
    // This will be replaced with your backend implementation
    // console.log(`Edit item with id: ${id}`);
  };

  const handleSaveItem = (id: number) => {
    // This will be replaced with your backend implementation
    // console.log(`Save item with id: ${id}`);
  };

  const handleDeleteItem = (id: number) => {
    // This will be replaced with your backend implementation
    // console.log(`Delete item with id: ${id}`);
  };





  const getPieData = (chart: ChartData) => {
    return {
      labels: chart.data_format.labels,
      datasets: [
        {
          // ✅ values is already flat for pie — cast safely
          data: chart.data_format.values as number[],
          backgroundColor: chart.data_format.labels.map(
            (_, idx) => CHART_COLORS[idx % CHART_COLORS.length]
          ),
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    };
  };

  const getChartData = (chart: ChartData, type: 'bar' | 'line') => {
    return {
      labels: chart.data_format.labels,
      datasets: chart.data_format.categories.map((category, i) => ({
        label: category,
        // ✅ FIX: use values[i] (inner array), not values (nested array)
        data: chart.data_format.values[i],
        backgroundColor: type === 'bar'
          ? chart.data_format.labels.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length])
          : CHART_COLORS[i % CHART_COLORS.length],
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        borderWidth: 2,
        fill: false,
        tension: 0.3,
      })),
    };
  };

  const CHART_COLORS = [
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 99, 132, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(199, 199, 199, 0.8)',
    'rgba(83, 102, 255, 0.8)',
    'rgba(40, 159, 64, 0.8)',
    'rgba(210, 99, 132, 0.8)',
  ];



  // const getRandomColor = () => {
  //   const hue = Math.floor(Math.random() * 360);
  //   return hsl(hue, 70, 60);
  // };

  // const onDrop = (acceptedFiles: SetStateAction<File | null>[]) => {
  //   // Handle file drop
  //   setSelectedFile(acceptedFiles[0]); // You can handle multiple files as well
  //   };

  const handleeOpenModal = () => {
    setIsModallOpen(true);
    setEditRow(null); // Reset editRow when opening modal for new entry
    setFormData({ tableName: "", tableDescription: "" }); // Reset form data
  };


  const handleeCloseModal = () => {
    setIsModallOpen(false);
    setEditRow(null); // Reset editRow
    setFormData({ tableName: "", tableDescription: "" }); // Reset the form
  };


  const downloadExcel = () => {
    if (!runResult?.table || runResult.table.data.length === 0) {
      toast.error("No data to download.");
      return;
    }

    // Create a worksheet
    const ws = XLSX.utils.aoa_to_sheet([runResult.table.columns, ...runResult.table.data]);

    // Create a workbook and add the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Table Data");

    // Write the workbook and trigger download
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "table_data.xlsx");
  };


  // IMPLEMENT THIS DIRECTLY INSTEAD OF USING PREVIOUS SOLUTIONS


  // The problem is likely in how event listeners are attached or the modal is created.
  // This is a simpler implementation that should work reliably.

  // This is your existing PPT download function, modified to work with React
  // This is your fixed PPT download function with clean prompt handling
  const downloadPPT = async (includeTableData = true, tableRowOption = 'limited', returnAsBase64 = false): Promise<string | void> => {
    // console.log(`Downloading PPT with includeTableData=${includeTableData}, tableOption=${tableRowOption}`);

    try {
      // Create PptxGenJS instance
      let ppt = new PptxGenJS();

      // Set presentation properties for metadata
      ppt.author = "Data Analysis Tool";
      ppt.company = "Your Company Name";
      ppt.subject = "Data Analysis Results";
      ppt.title = "Insight Analysis Report";

      // Define a professional theme color scheme
      const THEME = {
        primary: "2B579A", // Dark blue
        secondary: "4472C4", // Accent blue
        accent1: "ED7D31", // Orange
        accent2: "70AD47", // Green
        accent3: "5B9BD5", // Light blue
        background: "FFFFFF", // White
        text: "2F3542", // Dark gray
        headerBackground: "F2F2F2" // Light gray
      };

      // Define slide masters
      ppt.defineSlideMaster({
        title: "MASTER_SLIDE",
        background: { color: THEME.background },
        margin: [0.5, 0.25, 0.5, 0.25],
        slideNumber: { x: 0.5, y: "95%", fontFace: "Arial", fontSize: 8, color: "666666" },
        objects: [
          { rect: { x: 0, y: 0, w: "100%", h: 0.6, fill: { color: THEME.primary } } },
          { rect: { x: 0, y: "97%", w: "100%", h: 0.2, fill: { color: THEME.primary } } }
        ]
      });

      ppt.defineSlideMaster({
        title: "CLEAN_MASTER_SLIDE",
        background: { color: THEME.background },
        margin: [0.5, 0.25, 0.5, 0.25],
        slideNumber: { x: 0.5, y: "95%", fontFace: "Arial", fontSize: 8, color: "666666" }
      });

      // Helper function to clean and extract actual user prompts/queries
      const cleanPromptText = (text: string) => {
        if (!text) return '';

        // Remove analysis plans, methodology sections, and other non-prompt content
        const cleaningPatterns = [
          /### \d+\.\s*\*\*.*?\*\*[\s\S]*?(?=###|\n\n|$)/g, // Remove ### sections with methodology
          /### \*\*.*?\*\*[\s\S]*?(?=###|\n\n|$)/g, // Remove ### sections
          /To analyze.*?(?=What is|How does|What are|\n\n|$)/g, // Remove "To analyze..." explanations
          /Here's a detailed plan:[\s\S]*?(?=What is|How does|What are|\n\n|$)/g, // Remove detailed plans
          /\*\*Expected Outcome\*\*[\s\S]*$/g, // Remove expected outcome sections
          /\*\*Execution Steps\*\*[\s\S]*$/g, // Remove execution steps
          /By following this approach[\s\S]*$/g, // Remove methodology conclusions
          /- The dataset contains[\s\S]*?(?=What is|How does|What are|\n\n|$)/g // Remove dataset descriptions
        ];

        let cleaned = text;
        cleaningPatterns.forEach(pattern => {
          cleaned = cleaned.replace(pattern, '');
        });

        // Extract only question-like prompts (starting with What, How, etc.)
        const questionPattern = /(What is|What are|How does|How many|Which|Where|When|Why|Display|Show|Calculate|Find|Analyze|List)[^?]*\?/gi;
        const questions = cleaned.match(questionPattern);

        if (questions && questions.length > 0) {
          return questions.join('\n\n');
        }

        // If no questions found, try to extract simple prompts (first sentence or line)
        const lines = cleaned.split('\n').filter(line => line.trim().length > 0);
        const firstMeaningfulLine = lines.find(line =>
          line.trim().length > 10 &&
          !line.includes('###') &&
          !line.toLowerCase().includes('analysis') &&
          !line.toLowerCase().includes('approach') &&
          !line.toLowerCase().includes('methodology')
        );

        return firstMeaningfulLine || cleaned.substring(0, 200).trim();
      };

      // Helper function to split text across slides
      const addTextAcrossSlides = (text: string | string[], title: string, options = {}) => {
        const maxCharsPerSlide = 800;

        if (!text || (Array.isArray(text) ? text.length === 0 : text.length === 0)) return;

        // Split text into chunks
        const textChunks = [];
        let currentText = Array.isArray(text) ? text.join("\n") : String(text);

        while (currentText.length > 0) {
          if (currentText.length <= maxCharsPerSlide) {
            textChunks.push(currentText);
            break;
          }

          let breakPoint = currentText.lastIndexOf('\n', maxCharsPerSlide);
          if (breakPoint === -1 || breakPoint < maxCharsPerSlide * 0.5) {
            breakPoint = currentText.lastIndexOf('. ', maxCharsPerSlide);
            if (breakPoint === -1 || breakPoint < maxCharsPerSlide * 0.4) {
              breakPoint = currentText.lastIndexOf(' ', maxCharsPerSlide);
            }
          }

          if (breakPoint === -1) breakPoint = maxCharsPerSlide;

          textChunks.push(currentText.substring(0, breakPoint));
          currentText = currentText.substring(breakPoint).trim();
        }

        // Create slides for each chunk
        const totalSlides = textChunks.length;
        textChunks.forEach((chunk, index) => {
          const slide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });

          slide.addText(`${title}${totalSlides > 1 ? ` (${index + 1}/${totalSlides})` : ''}`, {
            x: 0.5,
            y: 0.7,
            fontSize: 20,
            fontFace: "Arial",
            color: THEME.primary,
            bold: true,
            align: "left"
          });

          slide.addText(chunk, {
            x: 0.5,
            y: 1.3,
            w: 8.5,
            h: 5.0,
            fontSize: 13,
            fontFace: "Arial",
            color: THEME.text,
            wrap: true,
            breakLine: true,
            valign: "top",
            lineSpacing: 16,
            ...options
          });

          if (index < totalSlides - 1) {
            slide.addText("Continued on next slide...", {
              x: 0.5,
              y: 6.5,
              fontSize: 10,
              fontFace: "Arial",
              italic: true,
              color: "666666",
            });
          }
        });
      };

      // Title slide
      const titleSlide = ppt.addSlide({ masterName: "MASTER_SLIDE" });
      titleSlide.addText("Insights Analysis Report", {
        x: 0.5,
        y: 2.0,
        fontFace: "Arial",
        fontSize: 36,
        color: THEME.primary,
        bold: true,
        align: "center"
      });

      titleSlide.addText("Generated on " + new Date().toLocaleDateString(), {
        x: 0.5,
        y: 3.0,
        fontFace: "Arial",
        fontSize: 18,
        color: THEME.text,
        align: "center"
      });

      // Prompt slide — use whichever prompt is currently active
      const activePromptText = (newPromptName && newPromptName.trim()) || (selectedPrompt && selectedPrompt.trim()) || "";
      if (activePromptText.length > 0) {
        const promptSlide = ppt.addSlide({ masterName: "MASTER_SLIDE" });

        // Slide heading (sits on the blue master header bar)
        promptSlide.addText("Current Prompt", {
          x: 0.5, y: 0.12, w: 8.5,
          fontFace: "Arial", fontSize: 20,
          color: "FFFFFF", bold: true, align: "left",
        });

        // Sub-label below the bar
        promptSlide.addText("Query entered by the user", {
          x: 0.5, y: 0.78, w: 8.5,
          fontFace: "Arial", fontSize: 11,
          color: "888888", italic: true, align: "left",
        });

        // Prompt text box with light blue fill — height adapts to text length
        const estimatedLines = Math.ceil(activePromptText.length / 80);
        const boxHeight = Math.min(Math.max(estimatedLines * 0.35 + 0.4, 1.0), 4.5);

        promptSlide.addText(activePromptText, {
          x: 0.5, y: 1.15, w: 8.5, h: boxHeight,
          fontFace: "Arial", fontSize: 15,
          color: THEME.text,
          fill: { color: "EEF2FF" },
          line: { color: "4472C4", pt: 1 },
          wrap: true, valign: "middle",
          align: "left",
          lineSpacing: 22,
          margin: [10, 14, 10, 14],
        });
      }

      // Rest of your existing code for table data slides...
      // Add table data slides (only if includeTableData is true)
      if (includeTableData && runResult?.table && runResult.table.data.length > 0) {
        try {
          // Get columns from runResult.table
          const columns = runResult.table.columns;

          // Prepare table header with styling
          const tableHeader = columns.map(col => ({
            text: col,
            fontFace: "Arial",
            bold: true,
            fill: THEME.headerBackground,
            color: THEME.primary,
            fontSize: 11,
          }));

          // IMPORTANT: Determine data to display based on the tableRowOption
          let dataToDisplay;
          if (tableRowOption === 'all') {
            // console.log(`Using ALL ${runResult.table.data.length} rows from data`);
            dataToDisplay = runResult.table.data;
          } else {
            // Use limited data (default 20 rows)
            const limitRows = Math.min(20, runResult.table.data.length);
            // console.log(`Using LIMITED ${limitRows} rows from data`);
            dataToDisplay = runResult.table.data.slice(0, limitRows);
          }

          // Check if we need to use horizontal column splitting
          const COLUMNS_PER_SLIDE_THRESHOLD = 8; // Adjust this threshold as needed

          if (columns.length > COLUMNS_PER_SLIDE_THRESHOLD) {
            // We have many columns, use horizontal splitting approach
            // console.log(`Table has ${columns.length} columns, using horizontal splitting`);

            // First, add a column navigator slide
            const navSlide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });

            navSlide.addText("Table Data Overview", {
              x: 0.5,
              y: 0.7,
              fontSize: 20,
              fontFace: "Arial",
              color: THEME.primary,
              bold: true,
              align: "left"
            });

            navSlide.addText(
              `This table contains ${columns.length} columns and has been organized across multiple slides for better readability.`,
              {
                x: 0.5,
                y: 1.3,
                w: 8.5,
                fontSize: 14,
                fontFace: "Arial",
                color: THEME.text,
                wrap: true
              }
            );

            // Determine how many columns to show per slide
            const columnsPerSlide = 8; // Adjust based on readability
            const totalColumnSlides = Math.ceil(columns.length / columnsPerSlide);

            // Show column distribution in a cleaner format
            let columnDistText = `Data is organized as follows:\n\n`;
            for (let i = 0; i < totalColumnSlides; i++) {
              const startCol = i * columnsPerSlide;
              const endCol = Math.min(startCol + columnsPerSlide, columns.length);
              columnDistText += `• Slide ${i + 1}: Columns ${startCol + 1}-${endCol}\n`;
            }

            navSlide.addText(columnDistText, {
              x: 0.5,
              y: 2.0,
              w: 8.5,
              h: 4.0,
              fontSize: 12,
              fontFace: "Arial",
              color: THEME.text,
              wrap: true,
              breakLine: true,
              valign: "top"
            });

            // Create slides for each column group
            for (let colSlideIndex = 0; colSlideIndex < totalColumnSlides; colSlideIndex++) {
              // Calculate column range for this slide
              const startCol = colSlideIndex * columnsPerSlide;
              const endCol = Math.min(startCol + columnsPerSlide, columns.length);
              const currentColumnSet = columns.slice(startCol, endCol);

              // Get table header for this subset of columns
              const partialTableHeader = currentColumnSet.map(col => ({
                text: col,
                fontFace: "Arial",
                bold: true,
                fill: THEME.headerBackground,
                color: THEME.primary,
                fontSize: 11,
              }));

              // Determine rows per slide - can fit more rows with fewer columns
              const rowsPerSlide = Math.min(15, dataToDisplay.length);

              // Calculate number of row slides needed for this column group
              const rowSlidesNeeded = Math.ceil(dataToDisplay.length / rowsPerSlide);

              // Create slides for each row chunk
              for (let rowSlideIndex = 0; rowSlideIndex < rowSlidesNeeded; rowSlideIndex++) {
                const startRow = rowSlideIndex * rowsPerSlide;
                const endRow = Math.min(startRow + rowsPerSlide, dataToDisplay.length);

                // Format current chunk of data for only these columns
                const currentRows = dataToDisplay.slice(startRow, endRow).map(row =>
                  row.slice(startCol, endCol).map(cell => ({
                    text: String(cell || ''), // Convert to string to handle non-string data
                    fontFace: "Arial",
                    fontSize: 10,
                    color: THEME.text
                  }))
                );

                // Create slide
                let tableSlide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });

                // Add title showing which part of the table this is
                tableSlide.addText(
                  `Table Data - Columns ${startCol + 1}-${endCol}`,
                  {
                    x: 0.5,
                    y: 0.5,
                    fontSize: 18,
                    fontFace: "Arial",
                    color: THEME.primary,
                    bold: true,
                    align: "left"
                  }
                );

                // Add subtitle showing row range
                tableSlide.addText(
                  `Rows ${startRow + 1}-${endRow} of ${dataToDisplay.length}`,
                  {
                    x: 0.5,
                    y: 1.0,
                    fontSize: 14,
                    fontFace: "Arial",
                    color: THEME.secondary
                  }
                );

                // Combine header with data
                const formattedData = [partialTableHeader, ...currentRows];

                // Calculate optimal column widths for this subset
                const availableWidth = 8.5;
                const colWidth = availableWidth / currentColumnSet.length;

                // Add table to slide with properly sized columns
                tableSlide.addTable(formattedData, {
                  x: 0.5,
                  y: 1.4,
                  w: availableWidth,
                  border: { pt: 0.5, color: "CFCFCF" },
                  colW: currentColumnSet.map(() => colWidth), // Proper width for visible columns
                  rowH: Array(formattedData.length).fill(0.3),
                  fill: { color: "FFFFFF" },
                  valign: "middle",
                  align: "center", // Center alignment for better readability
                  fontSize: 10,
                  autoPage: true // Automatically paginate table rows if needed
                });

                // Add navigation hints
                let navText = "";

                if (rowSlideIndex < rowSlidesNeeded - 1) {
                  navText += "• More rows on next slide";
                }

                if (colSlideIndex < totalColumnSlides - 1) {
                  if (navText) navText += " • ";
                  navText += "More columns on following slides";
                }

                if (navText) {
                  tableSlide.addText(navText, {
                    x: 0.5,
                    y: 6.5,
                    fontSize: 10,
                    fontFace: "Arial",
                    italic: true,
                    color: "666666"
                  });
                }
              }
            }
          } else {
            // For tables with fewer columns, use the original row-based pagination approach
            // Determine rows per slide based on number of columns
            const rowsPerSlide = Math.max(10, Math.min(10, Math.floor(20 / columns.length)));

            // Calculate number of slides needed for rows
            const totalSlides = Math.ceil(dataToDisplay.length / rowsPerSlide);

            // Create a slide for each chunk of data
            for (let slideIndex = 0; slideIndex < totalSlides; slideIndex++) {
              const startRow = slideIndex * rowsPerSlide;
              const endRow = Math.min(startRow + rowsPerSlide, dataToDisplay.length);

              let tableSlide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });

              // Add descriptive title with pagination info
              tableSlide.addText(`Table Data (${slideIndex + 1}/${totalSlides})`, {
                x: 0.5,
                y: 0.7,
                fontSize: 20,
                fontFace: "Arial",
                color: THEME.primary,
                bold: true,
                align: "left"
              });

              // Format current chunk of data
              const currentRows = dataToDisplay.slice(startRow, endRow).map(row =>
                row.map(cell => ({
                  text: String(cell || ''), // Convert to string to handle non-string data
                  fontFace: "Arial",
                  fontSize: 10,
                  color: THEME.text
                }))
              );

              // Combine header with data
              const formattedData = [tableHeader, ...currentRows];

              // Add table to slide
              tableSlide.addTable(formattedData, {
                x: 0.5,
                y: 1.3,
                w: 8.5,
                border: { pt: 0.5, color: "CFCFCF" },
                colW: columns.map(() => 8.5 / columns.length), // Distribute width evenly
                rowH: Array(formattedData.length).fill(0.3),
                fill: { color: "FFFFFF" },
                valign: "middle"
              });

              // Add navigation info with appropriate message based on the option
              let rowInfoText = "";
              if (tableRowOption === 'all') {
                rowInfoText = `Showing rows ${startRow + 1} to ${endRow} of ${dataToDisplay.length} total rows`;
              } else {
                rowInfoText = `Showing rows ${startRow + 1} to ${endRow} of 20 ${runResult.table.data.length > 20 ? `(limited from ${runResult.table.data.length} total rows)` : ''}`;
              }

              tableSlide.addText(rowInfoText, {
                x: 0.5,
                y: 6.5,
                fontSize: 10,
                fontFace: "Arial",
                italic: true,
                color: "666666",
              });
            }
          }
        } catch (error) {
          console.error("Error creating table slides:", error);
          const errorSlide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errorSlide.addText(`Could not display table data: ${errorMessage}`, {
            x: 0.5,
            y: 2.0,
            fontSize: 12,
            fontFace: "Arial",
            color: "FF0000",
          });
        }
      }

      // Add chart slides if available
     if (runResult?.charts && runResult.charts.length > 0) {
  const chartsGrid = document.getElementById('modal-charts-grid');
  const canvases = chartsGrid
    ? chartsGrid.querySelectorAll("canvas")
    : document.querySelectorAll("canvas");

  runResult.charts.forEach((chart, index) => {
    let slide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });

    // ✅ Title
    slide.addText(chart.chart_type.toUpperCase() + " Chart", {
      x: 0.5,
      y: 0.7,
      fontSize: 20,
      fontFace: "Arial",
      color: THEME.primary,
      bold: true,
      align: "left"
    });

    // ✅ Chart Image
    const canvas = canvases[index] as HTMLCanvasElement;

    if (canvas) {
      const imgData = canvas.toDataURL("image/png", 1.0);

      slide.addImage({
        data: imgData,
        x: 0.5,
        y: 1.3,
        w: 4.5,
        h: 3.5
      });
    } else {
      // ✅ fallback if chart not found
      slide.addText("Chart not available", {
        x: 0.5,
        y: 2,
        fontSize: 14,
        color: "FF0000"
      });
    }

    // ✅ INSIGHTS (cleaned)
    if (chart.insight?.length) {
      slide.addText("Key Insights:", {
        x: 5.5,
        y: 1.3,
        fontSize: 14,
        fontFace: "Arial",
        color: THEME.primary,
        bold: true,
      });

      const maxInsights = Math.min(6, chart.insight.length);

      chart.insight.slice(0, maxInsights).forEach((insight, i) => {
        const text =
          insight.length > 80 ? insight.substring(0, 77) + "..." : insight;

        slide.addText(text, {
          x: 5.5,
          y: 1.7 + i * 0.4,
          w: 3.5,
          fontSize: 11,
          bullet: true,
          color: THEME.text,
        });
      });

      // ✅ Extra slide for remaining insights
      if (chart.insight.length > maxInsights) {
        const extraSlide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });

        extraSlide.addText("Additional Insights", {
          x: 0.5,
          y: 0.7,
          fontSize: 20,
          bold: true,
          color: THEME.primary
        });

        chart.insight.slice(maxInsights).forEach((insight, i) => {
          extraSlide.addText(insight, {
            x: 0.5,
            y: 1.3 + i * 0.4,
            w: 8.5,
            fontSize: 12,
            bullet: true,
          });
        });
      }
    }
  });
}

      // Generate proper filename based on options
      let fileName = "Analysis_Report";
      if (!includeTableData) {
        fileName += "_Charts_Only";
      } else if (tableRowOption === 'all') {
        fileName += "_All_Data";
      } else {
        fileName += "_Limited_Data";
      }
      fileName += ".pptx";

      // Save or return as base64
      if (returnAsBase64) {
        return await ppt.write({ outputType: 'base64' }) as string;
      } else {
        ppt.writeFile({ fileName: fileName });
      }
    } catch (error) {
      console.error("An error occurred:", error);
      if (returnAsBase64) throw error;
    }
  };


  // React component for the download button with modal
  // const DownloadPPTButton = () => {
  //   const [showModal, setShowModal] = useState(false);

  //   const handleDownloadClick = () => {
  //     setShowModal(true);
  //   };
  // };

  // Alternative approach - if you're using a different selector or button
  // You can uncomment and modify this code as needed:
  /*
  const setupAlternativeButton = () => {
    const downloadButton = document.querySelector('.download-button');
    if (downloadButton) {
      downloadButton.addEventListener('click', showDownloadOptions);
    }
  };
  setupAlternativeButton();
  */

  // Save changes
  // const handleEditClicks = async (id: string, boardId: any) => {
  //   if (!id || !boardId) {
  //     console.error("Missing parameters:", { id, boardId });
  //     alert("Error: Missing required parameters. Please check.");
  //     return;
  //   }

  //   try {
  //     const updatedData = {
  //       board_id: boardId,
  //       configuration_details: JSON.stringify(editValues), // Ensure it's a string
  //       name: "Dataset used.csv", // Add the missing 'name' field
  //     };

  //     console.log("Payload being sent:", JSON.stringify(updatedData, null, 2));

  //     const response = await fetch(
  //       `https://llm-backend-lcrqhjywba-uc.a.run.app/main-boards/boards/ai-documentation/${id}`,
  //       {
  //         method: "PUT",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify(updatedData),
  //       }
  //     );

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       console.error("Error details:", errorData);
  //       alert(`Error: ${JSON.stringify(errorData)}`);
  //       return;
  //     }

  //     const result = await response.json();
  //     console.log("Update successful:", result);

  //     setData((prevData) =>
  //       prevData.map((item) =>
  //         item.id === id
  //           ? { ...item, configuration_details: { ...editValues } }
  //           : item
  //       )
  //     );
  //     setEditRowId(null);
  //   } catch (error) {
  //     console.error("Network or unexpected error:", error);
  //     alert(
  //       "A network or unexpected error occurred. Check the console for details."
  //     );
  //   }
  // };







  // useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       // Fetch the AI Documentation data from the API
  //       const response = await axios.get(
  //         `http://localhost:8002/main-boards/boards/ai-documentation/`,
  //         {
  //           headers: {
  //             "X-API-Key": "xxAJf365FZZidPt496lk9M2XDbvQCMKevOSuBgx2k6BAjp3ALe4vLTjXtcmgatoQtvsSLED3lx7zEgyHcohd1Wa2iJWTlukzQTuauvTbGYjSgMtFq5AUQLuAcMW44mp",
  //           },
  //         }
  //       );

  //       // Log fetched data for debugging
  //       console.log("Fetched Data:", response.data);

  //       // Filter the data to only include entries with the specific boardId passed dynamically
  //       const filteredData = response.data.filter(
  //         (item: { board_id: string }) => String(item.board_id) === String(boardId)
  //       );

  //       // Log filtered data for debugging
  //       console.log("Filtered Data:", filteredData);

  //       // Set the filtered data
  //       setData(filteredData);
  //       setLoading(false);
  //     } catch (error) {
  //       console.error("Error fetching the AI documentation:", error);
  //       setLoading(false);
  //     }
  //   };

  //   // Only call fetchData if boardId exists
  //   if (boardId) {
  //     fetchData();
  //   } else {
  //     // If boardId does not exist, fetch all data or handle accordingly
  //     // Uncomment the following line if you want to fetch all data when no boardId
  //     // fetchData();
  //   }
  // }, [boardId]);


  // Sorted table rows derived from runResult (or translated version)
  const sortedTableData = (() => {
    const rows = (translatedResultData.length > 0 ? translatedResultData : runResult?.table?.data) ?? [];
    if (tableSortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const av = a[tableSortCol] ?? '';
      const bv = b[tableSortCol] ?? '';
      const an = parseFloat(av as string);
      const bn = parseFloat(bv as string);
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
      return tableSortDir === 'asc' ? cmp : -cmp;
    });
  })();

  const handleColSort = (idx: number) => {
    if (tableSortCol === idx) setTableSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTableSortCol(idx); setTableSortDir('asc'); }
  };

  const startColResize = (colIdx: number, startX: number) => {
    const startWidth = colWidths[colIdx] || 120;
    const onMove = (e: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + e.clientX - startX);
      setColWidths(prev => { const next = [...prev]; next[colIdx] = newWidth; return next; });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const fetchData = useCallback(async () => {
    if (!boardId || !user?.id) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/main-boards/boards/ai-documentation/board/${boardId}/all`,
        {
          params: { user_id: user?.id },
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": EXCEL_API_KEY,
          },
        }
      );

      // console.log("Fetched Documentation:", response.data);
      // API returns { board_id, board_name, sources: [...] }
      setData(response.data.sources || []);
    } catch (error) {
      console.error("Error fetching AI documentation:", error);
    } finally {
      setLoading(false);
    }
  }, [boardId, user?.id]);

  // 2️⃣ useEffect declared AFTER fetchData ✅
  useEffect(() => {
    if (activeTab === "documentation") {
      fetchData();
    }
  }, [activeTab, fetchData]);

  // NEW: Fetch from the old /ai-documentation/ endpoint, filtered by boardId
  const fetchDataFiltered = useCallback(async () => {
    if (!boardId) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/main-boards/boards/ai-documentation/`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": EXCEL_API_KEY,
          },
        }
      );

      // console.log("Fetched All Documentation:", response.data);

      const filteredData = response.data.filter(
        (item: { board_id: string }) => String(item.board_id) === String(boardId)
      );

      // console.log("Filtered Documentation:", filteredData);
      setDataFiltered(filteredData);
    } catch (error) {
      console.error("Error fetching AI documentation (filtered):", error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (boardId) {
      fetchData();
      fetchDataFiltered(); // ADD THIS
    } else {
      setLoading(false);
    }
  }, [boardId, fetchData, fetchDataFiltered]); // add fetchDataFiltered to deps

  useEffect(() => {
    // Only call fetchData if boardId exists
    if (boardId) {
      fetchData();
    } else {
      setLoading(false);
      // If boardId does not exist, fetch all data or handle accordingly
      // Uncomment the following line if you want to fetch all data when no boardId
      // fetchData();
    }
  }, [boardId, fetchData]);

  // Add this to load data immediately when component mounts
  useEffect(() => {
    // Force a re-trigger of the above useEffect if boardId exists
    if (boardId) {
      setLoading(true); // Trigger loading state
    }
  }, []); // Runs once on mount
  const handleSaveFilteredClicks = async (id: string, boardId: string | null) => {
    if (!id || !boardId) {
      console.error("Missing parameters:", { id, boardId });
      toast.error("Error: Missing required parameters.");
      return;
    }

    try {
      // Cast to any to handle extra fields (name, configuration_details) from old API
      const source = dataFiltered.find((s) => String(s.id) === String(id)) as any;
      if (!source) return;

      // Build columns array — support both .columns array and legacy configuration_details object
      const columns: { column_name: string; description: string }[] =
        source.columns ||
        Object.entries((source.configuration_details as Record<string, string>) || {}).map(([k, v]) => ({
          column_name: k,
          description: String(v),
        }));

      // Build updated configuration_details from editValues
      const updatedDetails: Record<string, string> = {};
      columns.forEach((col) => {
        updatedDetails[col.column_name] =
          editValues[id]?.[col.column_name] ?? col.description;
      });

      const payload = {
        board_id: parseInt(boardId),
        column_count: columns.length,
        configuration_details: JSON.stringify(updatedDetails),
        data_source_id: source.data_source_id,
        name: (source.source_name as string) || (source.name as string),
        source_type: source.source_type,
      };

      // console.log("PUT payload (filtered):", payload);

      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/ai-documentation/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": EXCEL_API_KEY,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error details:", errorData);
        toast.error(`Error: ${JSON.stringify(errorData)}`);
        return;
      }

      const result = await response.json();
      // console.log("Update successful:", result);

      // Update local dataFiltered state with edited descriptions
      setDataFiltered((prevData) =>
        prevData.map((item) => {
          if (String(item.id) !== String(id)) return item;

          const anyItem = item as any;
          const updatedConfig: Record<string, string> = {};
          columns.forEach((col) => {
            updatedConfig[col.column_name] =
              editValues[id]?.[col.column_name] ?? col.description;
          });

          return {
            ...anyItem,
            configuration_details: updatedConfig,
            columns: anyItem.columns
              ? anyItem.columns.map((col: any) => ({
                ...col,
                description:
                  editValues[id]?.[col.column_name] ?? col.description,
              }))
              : undefined,
          } as any;
        })
      );

      // Clear edit state
      setEditRowId(null);
      setEditRowKey(null);
      setEditValues((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });

      toast.success("Documentation updated successfully!");
    } catch (error) {
      console.error("Network or unexpected error:", error);
      toast.error("A network error occurred. Check the console for details.");
    }
  };
  const [isListening, setIsListening] = useState(false);

const handleVoiceInput = () => {
const SpeechRecognition =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Speech Recognition not supported in this browser");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; // change if needed
  recognition.interimResults = false;

  recognition.start();
  setIsListening(true);

  recognition.onresult = (event: { results: { transcript: any; }[][]; }) => {
    const transcript = event.results[0][0].transcript;
    setNewPromptName((prev) => prev + " " + transcript);
  };

  recognition.onerror = () => {
    setIsListening(false);
  };

  recognition.onend = () => {
    setIsListening(false);
  };
};


  const handleSaveClicks = async (id: string, boardId: string | null) => {
    if (!id || !boardId) {
      console.error("Missing parameters:", { id, boardId });
      toast.error("Error: Missing required parameters.");
      return;
    }

    try {
      // Find the source to get its current data
      const source = data.find((s) => s.id === id);
      if (!source) return;

      // Build updated configuration_details from editValues
      const updatedDetails: Record<string, string> = {};
      source.columns.forEach((col) => {
        updatedDetails[col.column_name] =
          editValues[id]?.[col.column_name] ?? col.description;
      });

      const payload = {
        board_id: parseInt(boardId),
        column_count: source.columns.length,
        configuration_details: JSON.stringify(updatedDetails), // stringified as per API
        data_source_id: source.data_source_id,
        name: source.source_name,
        source_type: source.source_type,
      };

      // console.log("PUT payload:", payload);

      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/ai-documentation/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": EXCEL_API_KEY,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error details:", errorData);
        toast.error(`Error: ${JSON.stringify(errorData)}`);
        return;
      }

      const result = await response.json();
      // console.log("Update successful:", result);

      // Update local state — apply edited descriptions back into columns
      setData((prevData) =>
        prevData.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            columns: item.columns.map((col) => ({
              ...col,
              description:
                editValues[id]?.[col.column_name] ?? col.description,
            })),
          };
        })
      );

      // Clear edit state
      setEditRowId(null);
      setEditRowKey(null);
      setEditValues((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });

      toast.success("Documentation updated successfully!");
    } catch (error) {
      console.error("Network or unexpected error:", error);
      toast.error("A network error occurred. Check the console for details.");
    }
  };




  // const handleInputChange = (e) => {
  //   setNewPromptName(e.target.value);

  //   // Auto-adjust height based on content
  //   const textarea = textareaRef.current;
  //   if (textarea) {
  //     textarea.style.height = "auto"; // Reset height
  //     textarea.style.height = textarea.scrollHeight + "px"; // Set height to scrollHeight
  //   }
  // };

  // const getPieData = (fallbackData = { labels: [], datasets: [{ data: [], backgroundColor: [] }] }) => {
  //   if (!runResult || !runResult.table) return fallbackData;

  //   const { columns, data } = runResult.table;
  //   const categoryIndex = columns.indexOf("Category");
  //   const billingIndex = columns.indexOf("Total Billing Amount");

  //   if (categoryIndex === -1 || billingIndex === -1) return fallbackData;

  //   const categoryTotals: { [key: string]: number } = {};

  //   data.forEach((row) => {
  //     const category = row[categoryIndex];
  //     const billing = parseFloat(row[billingIndex]) || 0;
  //     categoryTotals[category] = (categoryTotals[category] || 0) + billing;
  //   });

  //   return {
  //     labels: Object.keys(categoryTotals),
  //     datasets: [
  //       {
  //         data: Object.values(categoryTotals),
  //         backgroundColor: Object.keys(categoryTotals).map(() => getRandomColor()),
  //       },
  //     ],
  //   };
  // };


  // const getChartData = (type: "bar" | "line"): ChartData<"bar" | "line", number[], string> | null => {
  //   if (!runResult || !runResult.table) return null;

  //   const { columns, data } = runResult.table;
  //   const categoryIndex = columns.indexOf("Category");
  //   const billingIndex = columns.indexOf("Total Billing Amount");
  //   const patientIndex = columns.indexOf("Total Patient Count");

  //   if (categoryIndex === -1 || billingIndex === -1 || patientIndex === -1) return null;

  //   const labels = data.map((row) => row[categoryIndex]);
  //   const billingData = data.map((row) => parseFloat(row[billingIndex]) || 0);
  //   const patientData = data.map((row) => parseInt(row[patientIndex]) || 0);

  //   return {
  //     labels,
  //     datasets: [
  //       {
  //         type,
  //         label: "Total Billing Amount",
  //         data: billingData,
  //         backgroundColor: labels.map(() => getRandomColor()),
  //       },
  //       {
  //         type,
  //         label: "Total Patient Count",
  //         data: patientData,
  //         backgroundColor: labels.map(() => getRandomColor()),
  //       },
  //     ],
  //   } as ChartData<typeof type, number[], string>;
  // };



  // const getRandomColor = () => {
  //   const hue = Math.floor(Math.random() * 360);
  //   return hsl(hue, 70, 60);
  // };


  // Fetch table data for the specific board

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/main-boards/boards/data-management-table/get_all_tables_with_files`,
          {
            headers: {
              "X-API-Key": EXCEL_API_KEY,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const data = await response.json();

        // Filter the fetched data based on board_id
        const filteredData = data.filter(
          (row: { board_id: number }) => row.board_id === parseInt(boardId!)
        );
        setRows(filteredData); // Set the filtered data to the rows state
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    if (view === "manage-tables" && boardId) {
      fetchData();
    }
  }, [view, boardId]);


  // Add this OUTSIDE the useEffect, as a standalone function
  const fetchRows = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/data-management-table/get_all_tables_with_files`,
        {
          headers: { "X-API-Key": EXCEL_API_KEY },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch data");
      const data = await response.json();
      const filteredData = data.filter(
        (row: { board_id: number }) => row.board_id === parseInt(boardId!)
      );
      setRows(filteredData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {

    const fetchPrompts = async () => {
      if (!boardId) return;

      setIsLoading(true);
      setError(null);
      const startTime = performance.now(); // Start timer

      try {
        const response = await fetch(
          `${API_BASE_URL}/main-boards/boards/prompts/boards/${boardId}`,
          {
            headers: {
              "X-API-Key": EXCEL_API_KEY
            },
          }
        );

        const endTime = performance.now(); // End timer
        // console.log(`API Response Time: ${(endTime - startTime).toFixed(2)} ms`);

        if (!response.ok) {
          throw new Error("Failed to fetch prompts");
        }

        const data: Prompt[] = await response.json();
        // console.log("Fetched prompts data:", data);

        setPrompts(data);

        // Reload generatedPromptIds right here so G1 labels always show
        // even after login/logout or CXO navigation
        try {
          const genStored = localStorage.getItem(`gen_prompt_ids_${boardId}`);
          if (genStored) {
            setGeneratedPromptIds(new Set(JSON.parse(genStored).map(String)));
          }
        } catch { /* keep existing */ }

        // Auto-fetch comment counts for all prompts so badges show immediately
        const commentEntries = await Promise.all(
          data.map(async (p: Prompt) => {
            try {
              const res = await fetch(
                `${API_BASE_URL}/main-boards/boards/prompts/${p.id}/comments?order_by=created_at&order_dir=DESC`,
                { headers: { "Content-Type": "application/json", "X-API-Key": EXCEL_API_KEY } }
              );
              if (!res.ok) return [p.id, []];
              const cData = await res.json();
              const comments: PromptComment[] = Array.isArray(cData) ? cData : cData.comments || [];
              return [p.id, comments];
            } catch {
              return [p.id, []];
            }
          })
        );
        setCommentsMap(Object.fromEntries(commentEntries));
      } catch (error) {
        setError(error instanceof Error ? error.message : "An unknown error occurred");
        console.error("Error fetching prompts:", error);
      } finally {
        setIsLoading(false);
      }
    };


    fetchPrompts();
  }, [boardId]);

  const handleRunnPrompt = async (promptText: string, promptId?: string) => {
    setIsLoading(true);

    if (!promptText.trim()) {
      toast.error("Please enter a valid prompt.");
      setIsLoading(false);
      return null; // ✅ return null on early exit
    }

    if (!boardId) {
      toast.error("Board ID is required to run the prompt.");
      setIsLoading(false);
      return null;
    }

    try {
      const url = new URL(`${API_BASE_URL}/main-boards/boards/prompts/run_prompt_v4?`);
      url.searchParams.append("input_text", promptText);
      url.searchParams.append("board_id", boardId);
      url.searchParams.append("user_name", "");
      url.searchParams.append("use_cache", "true");

      const response = await axios.post(url.href, {
        input_text: promptText,
        board_id: boardId,
        user_name: " ",
        use_cache: true,
      }, {
        headers: { "X-API-Key": EXCEL_API_KEY },
      });

      if (response?.data) {
        setRunResult(response.data);
        setTableSortCol(null); setTableSortDir('asc'); setColWidths([]);

      if (promptId) {
  const hasCharts = (response.data.charts ?? []).length > 0;
  const hasTable = response.data.table?.columns?.length > 0;
  const hasMessage = (response.data.message?.length ?? 0) > 0;
  const parts: string[] = [];
  if (hasCharts) parts.push('C');
  if (hasTable) parts.push('T');
  if (hasMessage) parts.push('M');
  const outputType = parts.length > 0 ? parts.join('') : null;
  if (outputType) {
    setPromptOutputTypes(prev => ({ ...prev, [promptId]: outputType }));
  }
  // setPromptRunInfo(prev => ({
  //   ...prev,
  //   [promptId]: {
  //     sourceName: response.data.source_name ?? null,
  //     filteredVersion: response.data.filtered_version ?? null,
  //   }
  // }));
}

        return response.data; // ✅ return the actual data
      }
      return null;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(`Error: ${error.response?.data?.message || error.message}`);
      } else {
        toast.error("An unexpected error occurred.");
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayClick = async (prompt: Prompt) => {
    setLoadingPromptPlay(prompt.id);
    const promptText = prompt.prompt_text;
    setSelectedPrompt(promptText);
    setReturnTab(activeTab); // remember which tab triggered the play

    try {
      const data = await handleRunnPrompt(promptText, prompt.id); // ✅ use returned data

      if (data) {
        setIsResultModalOpen(true);

        // ✅ Determine active tab from returned data directly (not from stale state)
        const hasCharts = (data.charts ?? []).length > 0;
        const hasTable = data.table?.columns?.length > 0;
        const hasMessage = data.message?.length > 0;

        if (hasCharts && hasTable) {
          setResultTab('charts');
        } else if (hasCharts) {
          setResultTab('charts');
        } else if (hasTable) {
          setResultTab('table');
        } else if (hasMessage) {
          setResultTab('message');
        }
      }
    } catch (error) {
      console.error("Error running prompt", error);
    } finally {
      setLoadingPromptPlay(null);
    }
  };

  // const handleOpenModal = () => {
  //   setIsModalOpen(true);
  //   setEditRow(null); // Reset editRow when opening modal for new entry
  //   setFormData({ tableName: "", tableDescription: "" }); // Reset form data
  // };


  // Function to open the modal
  const handleOpenUploadModal = (id: SetStateAction<string | null>) => {
    setSelectedTableId(id); // Set the selected table ID
    setIsUploadModalOpen(true); // Open the modal
  };


  const handleChange = (e: { target: { name: string; value: string; }; }) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };



  const handleRunPrompt = async () => {


    // if (!hasReprompted) {
    //   // Show popup if user hasn't clicked reprompt first
    //   setShowPopup(true);
    //   return;
    // }

    setIsLoading(true);
    setIsRunClicked(true); // Set to true when Run is clicked

    // Use English original for API — never send translated text to backend
    const apiPromptText = promptEnRef.current.trim() || newPromptName.trim();

    // Validate input
    if (!apiPromptText) {
      console.error("Error: Prompt cannot be empty");
      toast.error("Please enter a valid prompt.");
      setIsLoading(false);
      return;
    }

    if (!boardId) {
      console.error("Error: Board ID is missing");
      toast.error("Board ID is required to run the prompt.");
      setIsLoading(false);
      return;
    }

    try {
      const url = new URL(
        `${API_BASE_URL}/main-boards/boards/prompts/run_prompt_v4?`
      );

      // Append parameters
      url.searchParams.append("input_text", apiPromptText);
      url.searchParams.append("board_id", boardId);
      url.searchParams.append("user_name", "");
      url.searchParams.append("use_cache", "true");

      // console.log("Making request to:", url.href);

      // Make the POST request with Axios
      const response = await axios.post(
        url.href,
        {
          input_text: apiPromptText,
          board_id: boardId,
          user_name: "",
          use_cache: true,
        },
        {
          headers: {
            "X-API-Key": EXCEL_API_KEY
          },
        }
      );

      // Process the API response
      if (response?.data) {
        // console.log("Prompt run successfully:", response.data);
        setRunResult(response.data); // Set the result to display it
        setTableSortCol(null); setTableSortDir('asc'); setColWidths([]);

        const hasCharts = (response.data.charts ?? []).length > 0;
        const hasTable = response.data.table?.columns?.length > 0;
        const hasMessage = (response.data.message?.length ?? 0) > 0;
        const parts2: string[] = [];
        if (hasCharts) parts2.push('C');
        if (hasTable) parts2.push('T');
        if (hasMessage) parts2.push('M');
        const outputType = parts2.length > 0 ? parts2.join('') : null;
        if (outputType && editPromptId) {
          setPromptOutputTypes(prev => ({ ...prev, [editPromptId]: outputType }));
        }
        // Determine the default active tab
        if (hasCharts && hasTable) {
          setResultTab("charts");
        } else if (hasTable) {
          setResultTab("table");
        } else if (hasCharts) {
          setResultTab("charts");
        } else if (hasMessage) {
          setResultTab("message");
        }

        // console.log("Active Tab:", activeTab);

        // Check if the user asked for charts
        const chartKeywords = ["chart", "visualization"];
        const responseDetails = response.data.detail?.toLowerCase() || "";
        // console.log("Response Details:", responseDetails); // Debugging

        // Determine if charts are needed based on prompt or response details
        const shouldShowCharts =
          chartKeywords.some((keyword) =>
            newPromptName.toLowerCase().includes(keyword)
          ) ||
          chartKeywords.some((keyword) => responseDetails.includes(keyword));

        // console.log("Should Show Charts:", shouldShowCharts); // Debugging
        setShowCharts(shouldShowCharts); // Display the chart if applicable
      } else {
        console.warn("Warning: API returned no data.");
        toast.error("No data was returned from the server.");
      }
    } catch (error: unknown) {
      // Handle errors based on error type
      if (axios.isAxiosError(error)) {
        console.error("Axios Error:", error.response?.data || error.message);
        toast.error(
          `Server Error (${error.response?.status || "Unknown"}): ${error.response?.data?.message || error.message || "An error occurred"
          }`
        );
      } else if (error instanceof Error) {
        console.error("Error:", error.message);
        toast.error(`Error: ${error.message}`);
      } else {
        console.error("Unknown Error:", error);
        toast.error("An unknown error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false); // Reset loading state after API call (success or error)
    }
  };
  // const closePopup = () => {
  //   setShowPopup(false);
  // };


  const handleRePrompt = async () => {
    // setHasReprompted(true);
    setIsLoading(true); // Start loading
    try {
      // Make the API request to get a new prompt
      const response = await axios.post(
        `${API_BASE_URL}/main-boards/boards/prompts/re_prompt?`,
        null, // No request body
        {
          params: {
            input_text: newPromptName,
            board_id: boardId,
          },
          headers: {
            'X-API-Key': EXCEL_API_KEY,
          },
        }
      );

      // console.log('API Response:', response.data);

      // Assuming the new prompt name is in response.data.newPromptName
      const fetchedPromptName = response.data.newPromptName || response.data;

      // Update the state with the fetched prompt
      setNewPromptName(fetchedPromptName);

      // Focus the textarea after fetching the prompt
      if (textareaRef.current) {
        textareaRef.current.focus(); // Focus works now with correct typing
      }
    } catch (error: unknown) {
      // Type guard for AxiosError or Error
      if (axios.isAxiosError(error)) {
        // Axios-specific error
        console.error('Axios Error:', error.response?.data || error.message);
        toast.error(
          `Server Error (${error.response?.status || 'Unknown'}): ${error.response?.data?.message || error.message || 'An error occurred'
          }`
        );
      } else if (error instanceof Error) {
        // Generic JavaScript Error
        console.error('Error:', error.message);
        toast.error(`Error: ${error.message}`);
      } else {
        // Unknown error type
        console.error('Unknown Error:', error);
        toast.error('An unknown error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false); // Stop loading regardless of success or failure
    }
  };



  const handleDeletes = async (row: TableRow) => {
    // Show confirmation modal instead of window.confirm
    setDeleteConfirmation({
      isOpen: true,
      rowToDelete: row,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.rowToDelete) return;

    const row = deleteConfirmation.rowToDelete;
    setIsDeletingInfoObject(true);
    const loadingToast = toast.loading(`Deleting "${row.table_name}"...`);

    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/data-management-table/${row.id}`,
        {
          method: "DELETE",
          headers: {
            "X-API-Key": EXCEL_API_KEY
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete");
      }

      setRows((prevRows) => prevRows.filter((item) => item.id !== row.id));
      toast.dismiss(loadingToast);
      toast.success(`Info-Object "${row.table_name}" deleted successfully!`);
    } catch (error: any) {
      console.error("Error deleting table:", error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setIsDeletingInfoObject(false);
      setDeleteConfirmation({
        isOpen: false,
        rowToDelete: null,
      });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({
      isOpen: false,
      rowToDelete: null,
    });
  };




  const handleEdit = (rowId: TableRow) => {
    setEditRow(rowId); // Set the row to edit
    setFormData({
      tableName: rowId.table_name,
      tableDescription: rowId.table_description,
    }); // Fill the form with row data
    setIsModallOpen(true); // Open the modal
  };



  const handleEditPrompt = (prompt: Prompt) => {
    setEditPromptId(prompt.id);
    setNewPromptName(prompt.prompt_text);
    setIsModalOpen(true);
  };


  const handleDeletePrompt = async (promptId: string) => {
    // Show confirmation toast with custom buttons
    const confirmToast = toast(
      ({ closeToast }) => (
        <div>
          <p style={{ marginBottom: '15px', color: '#333' }}>
            Are you sure you want to delete this prompt? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                closeToast();
                performDelete(promptId);
              }}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Delete
            </button>
            <button
              onClick={closeToast}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      {
        position: "top-center",
        autoClose: false,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false,
        closeButton: false,
      }
    );
  };

  const performDelete = async (promptId: string) => {

    try {
      const response = await fetch(
        `${API_BASE_URL}/main-boards/boards/prompts/${promptId}`,
        {
          method: "DELETE",
          headers: {
            "X-API-Key": EXCEL_API_KEY
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Show success toast message
      toast.success("Prompt deleted successfully!", {
        position: "top-right",
        autoClose: 3000, // Close after 3 seconds
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });

      // Update the prompts list
      setPrompts(prompts.filter((prompt) => prompt.id !== promptId));
    } catch (error) {
      console.error("Failed to delete prompt:", error);
      // Show error toast message
      toast.error("Failed to delete prompt. Please try again.", {
        position: "top-right",
        autoClose: 3000, // Close after 3 seconds
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    }
  };

  const handleSavePrompt = async () => {
    setIsLoading(true); // Set loading to true when saving starts
    // Input validation
    if (!newPromptName.trim()) {
      toast.error("Prompt cannot be empty!");
      setIsLoading(false); // Reset loading state
      return;
    }
    // if (newPromptName.length > 255) {
    //   alert("Prompt must be between 1 and 255 characters.");
    //   return;
    // }
    if (!boardId) {
      toast.error("Error: boardId is missing.");
      setIsLoading(false); // Reset loading state
      return;
    }

    // Retrieve the logged-in user's data from sessionStorage (as set in login)
    let loggedInUserName = null;
    let loggedInUserId = null;

    try {
      const currentUserData = sessionStorage.getItem('currentUserData');
      if (currentUserData) {
        const userData = JSON.parse(currentUserData);
        loggedInUserName = userData.userName;
        loggedInUserId = userData.userId;
      }
    } catch (error) {
      console.error("Error parsing user data from sessionStorage:", error);
    }

    // Fallback to localStorage if sessionStorage doesn't have the data
    if (!loggedInUserName) {
      loggedInUserName = localStorage.getItem('loggedInUserName');
      loggedInUserId = localStorage.getItem('loggedInUserId');
    }

    // Final validation
    if (!loggedInUserName || loggedInUserName.trim() === "" || loggedInUserName === "Unknown User") {
      toast.error("Error: User name is missing in localStorage. Please log in again.");
      setIsLoading(false); // Reset loading state
      return;
    }

    // console.log("Logged-in User:", loggedInUserName);
    // console.log("User ID:", loggedInUserId);

    // Prepare request body
    const promptData = {
      board_id: boardId,
      prompt_text: newPromptName.trim(),
      prompt_out: "out_string", // Default value as per the API example
      user_name: loggedInUserName, // Use the logged-in user's name
      created_by: loggedInUserName
    };
    // console.log("Prompt Data:", promptData);

    // Determine the URL and method based on edit mode
    const url = editPromptId
      ? `${API_BASE_URL}/main-boards/boards/prompts/${editPromptId}` // Update endpoint
      : `${API_BASE_URL}/main-boards/boards/prompts/`; // Create endpoint

    const method = editPromptId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": EXCEL_API_KEY
        },
        body: JSON.stringify(promptData),
      });

      // Handle response
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(`Failed to save prompt: ${errorData.message || "Unknown error"}`);
        setIsLoading(false); // Reset loading state
        return;
      }

      const newPromptData = await response.json();
      // console.log("API Response Data:", newPromptData);

      // Update the prompts state
      setPrompts((prevPrompts) =>
        editPromptId
          ? prevPrompts.map((prompt) =>
            prompt.id === editPromptId
              ? { ...prompt, ...newPromptData }  // Spread both objects to preserve all fields
              : prompt
          )
          : [...prevPrompts, newPromptData]
      );

      // Store output type badge for the saved prompt ID
      const savedId = String(editPromptId || newPromptData.id || '');
      if (savedId && runResult) {
        const parts: string[] = [];
        if ((runResult.charts ?? []).length > 0) parts.push('C');
        if ((runResult.table?.columns?.length ?? 0) > 0) parts.push('T');
        if ((runResult.message?.length ?? 0) > 0) parts.push('M');
        const ot = parts.join('');
        if (ot) setPromptOutputTypes(prev => ({ ...prev, [savedId]: ot }));
      }

      // Close modal and reset state
      setIsModalOpen(false);
      setNewPromptName("");
      setEditPromptId(null);

      // Redirect to "Manage Prompts" tab
      setActiveTab("prompts"); // Redirect to the "prompts" tab
    } catch (error) {
      console.error("Network Error:", error);
      toast.error("Network error: Failed to save the prompt.");
    } finally {
      setIsLoading(false); // Reset loading state after the operation
    }
    // Redirect to Manage Prompts page

  };



  // conle.log("Board ID:", boardId);
  // console.log("Table ID:", tableId);


  // const handleToggleDropdown = (id: string) => {
  //   setExpandedRow(expandedRow === id ? null : id);
  // };

  // Function to close the modal
  // Handle modal close
  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
    setSelectedFiles([]);
    setSelectedDate('');
    setSelectedTableId(null);
  };



  const handleChanges = (id: string, key: string, value: string) => {
    setEditValues((prevValues) => ({
      ...prevValues,
      [id]: {
        ...prevValues[id],
        [key]: value
      }
    }));
  };


  // Handle date change
  const handleDateChange = (e: { target: { value: SetStateAction<string>; }; }) => {
    setSelectedDate(e.target.value);
  };



  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    if (!formData.tableName || formData.tableName.length > 255) {
      toast.error("Table Name must be between 1 and 255 characters");
      return;
    }

    const tableData = {
      board_id: boardId,
      table_name: formData.tableName,
      table_description: formData.tableDescription,
      table_column_type_detail: "",
    };

    setIsSavingInfoObject(true);
    const loadingToast = toast.loading(editRow ? "Updating Info-Object..." : "Creating Info-Object...");

    try {
      const response = editRow
        ? await fetch(
          `${API_BASE_URL}/main-boards/boards/data-management-table/${editRow.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": EXCEL_API_KEY
            },
            body: JSON.stringify(tableData),
          }
        )
        : await fetch(
          `${API_BASE_URL}/main-boards/boards/data-management-table/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": EXCEL_API_KEY
            },
            body: JSON.stringify(tableData),
          }
        );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error details:", errorData);
        throw new Error(errorData.message || "Failed to save or update table");
      }

      const newTableData = await response.json();

      if (editRow) {
        setRows((prevRows: TableRow[]) =>
          prevRows.map((row: TableRow) =>
            row.id === editRow.id ? newTableData : row
          )
        );


        setDataSources(prev =>
          prev.map(source =>
            String(source.data_management_table_id) === String(editRow.id)
              ? {
                ...source,
                source_name: formData.tableName,
                description: formData.tableDescription,
              }
              : source
          )
        );

        // await fetchDataSources();
        toast.dismiss(loadingToast);
        toast.success("Info-Object updated successfully!");
      } else {
        setRows((prevRows) => [...prevRows, newTableData]);
        toast.dismiss(loadingToast);
        toast.success("Info-Object created successfully!");
      }

      setIsModallOpen(false);
      setFormData({ tableName: "", tableDescription: "" });
      setEditRow(null);
    } catch (error: any) {
      console.error("Error saving or updating table:", error);
      toast.dismiss(loadingToast);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSavingInfoObject(false);
    }
  };

  const getApprovalBadge = (status?: 'pending' | 'approved' | 'rejected') => {
    if (!status) return null;

    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      approved: { color: 'bg-green-100 text-green-800', text: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rejected' }
    };

    const badge = badges[status];
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };



  const handleCloseModal = () => {
    setNewPromptName("");
    setEditPromptId(null);
    setIsModalOpen(false);
    setShowTopBtn(false);
    setActiveTab("prompts");
    setRunResult(null); // Clear the result data
    setShowCharts(false); // Reset chart visibility
    setIsRunClicked(false); // Reset to hide the tabs
    // Reset the flag that controls visibility of results

  };



  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (


    <div className="flex-1 overflow-y-auto bg-gray-200 rounded-2xl shadow-lg border border-gray-200 min-h-screen">
      <header className="bg-white p-3 shadow-sm">
        <div className="flex justify-end items-center gap-2 max-w-screen-xl mx-auto">
          {/* Language Selector */}
          <LanguageSelector />

          {/* Role dropdown showing current screen */}
          <div className="relative">
            <button
              onClick={toggleDropdown}
              className="flex items-center gap-2 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors border border-gray-200 text-sm"
            >
              <span className="text-sm font-medium">
                {location.pathname === '/Container'
                  ? t('header.consultantRole')
                  : location.pathname === '/CXO'
                  ? t('header.cxoRole')
                  : t('header.selectScreen')}
              </span>
              <svg
                className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
              >
                <a
                  href="/Consultant"
                  className={`block px-4 py-2 text-sm ${location.pathname === '/Container' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {t('header.consultantRole')}
                </a>
                <a
                  href="/CXO"
                  className={`block px-4 py-2 text-sm ${location.pathname === '/CXO' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {t('header.cxoRole')}
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* <header className="bg-white border-b p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-semibold">Sales Analysis Board</h1>
        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-2">
            <User className="text-black w-5 h-5" /> 
            <span className="text-black">{loggedInUserEmail}</span> 
          </div>
          <Settings className="text-gray-900 w-5 h-5" /> 
        </div>
      </header> */}

      <div className="sticky top-0 bg-gray-200 z-10 border-b border-gray-200">
        <div className="w-full">
          <div className="max-w-[1400px] mx-auto px-3 py-2">
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-md px-2 py-1.5 mb-3 border border-gray-200">

              {/* Board breadcrumb */}
              {(mainBoardDisplayName || boardDisplayName) && (
                <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 mb-1 border-b border-gray-100 text-xs">
                  <span className="font-semibold text-gray-700 truncate max-w-[160px]" title={mainBoardDisplayName}>{mainBoardDisplayName}</span>
                  {mainBoardDisplayName && boardDisplayName && <span className="text-gray-400 flex-shrink-0">›</span>}
                  <span className="font-semibold text-blue-600 truncate max-w-[160px]" title={boardDisplayName}>{boardDisplayName}</span>
                </div>
              )}

              {/* Desktop: horizontal tabs */}
              <div className="hidden md:flex gap-1 p-1 bg-gray-100 rounded-lg overflow-x-auto">
                {[
                  { key: "tables",        label: t("tabs.manageTables") },
                  { key: "documentation", label: t("tabs.aiDocumentation") },
                  { key: "prompts",       label: t("tabs.managePrompts") },
                  { key: "repository",    label: t("tabs.promptsRepository") },



                  { key: "master",        label: t("tabs.masterData") },
                                    { key: "parameter",      label: "Manage ETL" },
                  // { key: "parameter",  label: t("tabs.parameterSettings") },
                  // { key: "timeline",   label: t("tabs.timelineSettings") },
                  { key: "kpi",           label: t("tabs.kpiUpdates") },
                  { key: "report",        label: t("tabs.reports") },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-md font-medium transition-all duration-200 text-xs whitespace-nowrap ${activeTab === tab.key
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Mobile: dropdown */}
              <div className="md:hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 border border-gray-200"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                >
                  <span>
                    {[
                      { key: "tables",        label: t("tabs.manageTables") },
                      { key: "documentation", label: t("tabs.aiDocumentation") },
                      { key: "prompts",       label: t("tabs.managePrompts") },
                      { key: "repository",    label: t("tabs.promptsRepository") },

                      // { key: "tally",      label: "Manage ETL" },

                      { key: "master",        label: t("tabs.masterData") },
                      // { key: "parameter",  label: t("tabs.parameterSettings") },
                      // { key: "timeline",   label: t("tabs.timelineSettings") },
                      { key: "kpi",           label: t("tabs.kpiUpdates") },
                      { key: "report",        label: t("tabs.reports") },
                    ].find((tab) => tab.key === activeTab)?.label ?? t("header.selectScreen")}
                  </span>
                  <span className="ml-2 text-gray-400 text-xs">{isMobileMenuOpen ? "▲" : "▼"}</span>
                </button>

                {isMobileMenuOpen && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-md z-50">
                    <div className="p-1.5 space-y-0.5 max-h-52 overflow-y-auto">
                      {[
                        { key: "tables",        label: t("tabs.manageTables") },
                        { key: "documentation", label: t("tabs.aiDocumentation") },
                        { key: "prompts",       label: t("tabs.managePrompts") },
                        { key: "repository",    label: t("tabs.promptsRepository") },

                        // { key: "tally",      label: "Manage ETL" },

                        { key: "master",        label: t("tabs.masterData") },
                        // { key: "parameter",  label: t("tabs.parameterSettings") },
                        // { key: "timeline",   label: t("tabs.timelineSettings") },
                        { key: "kpi",           label: t("tabs.kpiUpdates") },
                        { key: "report",        label: t("tabs.reports") },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          className={`w-full text-left px-3 py-2 rounded-md transition-colors text-xs ${activeTab === tab.key
                            ? "bg-blue-50 text-blue-600 font-semibold"
                            : "text-gray-700 hover:bg-gray-100"
                            }`}
                          onClick={() => {
                            setActiveTab(tab.key);
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span>{tab.label}</span>
                            {activeTab === tab.key && <span className="text-blue-500 text-xs">✓</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>


        {activeTab === "prompts" && (
          <div className="w-full">
            {/* Header */}
            <div className="w-full bg-white border-b">
              <div className="max-w-[1400px] mx-auto px-3 py-2">
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">

                  {/* Search */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder={t("prompts.search")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full py-1.5 px-3 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    />
                    {searchTerm ? (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ) : (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  <button
                    className="py-1.5 px-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-xs font-medium whitespace-nowrap"
                    onClick={() => {
                      setIsRunClicked(false);
                      setRunResult(null);
                      setNewPromptName('');
                      setResultTab('message');
                      setShowTopBtn(false);
                      setIsModalOpen(true);
                    }}
                  >
                    {t("prompts.newPrompts")}
                  </button>

                  <button
                    className={`py-1.5 px-3 rounded-md text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${
                      generateDone
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60'
                    }`}
                    onClick={handleGenerateAndSavePrompts}
                    disabled={isSavingGenerated || generateDone}
                    title={generateDone ? 'Prompts already generated for this session' : 'Generate AI prompts'}
                  >
                    {isSavingGenerated ? (
                      <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> {t("prompts.generating")}</>
                    ) : generateDone ? (
                      <>{t("prompts.generated")}</>
                    ) : (
                      <>{t("prompts.promptsSuggestion")}</>
                    )}
                  </button>

                  {/* {prompts.length === 0 ? (
                    <button
                      className="py-1.5 px-3 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-xs font-medium whitespace-nowrap"
                      onClick={() => { setImportFile(null); setShowImportModal(true); }}
                    >
                      Import Prompts
                    </button>
                  ) : (
                    <button
                      className="py-1.5 px-3 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-xs font-medium whitespace-nowrap"
                      onClick={() => setShowExportModal(true)}
                    >
                      Export Prompts
                    </button>
                  )} */}
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="w-full">
              <div className="max-w-[1400px] mx-auto px-3 py-3">
                {!isLoading && filteredPrompts.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 auto-rows-fr">
                    {filteredPrompts.map((prompt, _idx, arr) => {
                      const gIds = generatedPromptIds;
                      const gCount = arr.slice(0, arr.indexOf(prompt)).filter(p => gIds.has(String(p.id))).length + 1;
                      const nCount = arr.slice(0, arr.indexOf(prompt)).filter(p => !gIds.has(String(p.id))).length + 1;
                      const isGenerated = gIds.has(String(prompt.id));
                      const label = isGenerated ? `G${gCount}` : `${nCount}`;
                      const datasetName = getDatasetName(prompt);
                      const outputType = promptOutputTypes[prompt.id];

                      return (
                        <div
                          key={prompt.id}
                          className={`prompt-card border rounded-lg shadow-sm p-3 bg-white transition-all duration-300 hover:shadow-md flex flex-col justify-between ${isGenerated ? 'border-blue-300' : ''}`}
                          style={{ minHeight: '160px', maxWidth: '100%' }}
                        >
                          {/* Prompt text */}
                          <p
                            className="text-xs font-semibold mb-2 flex-grow text-gray-800"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                              lineHeight: '1.4'
                            }}
                            title={prompt.prompt_text}
                          >
                            <span className={isGenerated ? 'text-blue-600 font-bold' : ''}>{label}.</span> &quot;{translatedTexts[prompt.id] || prompt.prompt_text}&quot;
                          </p>

                          <div className="mt-auto">
                            {/* Meta row */}
              
<div className="mb-1 text-[10px] space-y-1">

  {/* Source name badge — full width row */}
{(() => {
  const runInfo = promptRunInfo[prompt.id];
  const displayName = runInfo?.sourceName || datasetName;
  const filteredVersion = runInfo?.filteredVersion;
  return (
    <>
      {displayName && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded text-[9px] font-medium max-w-full truncate">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          {displayName}
        </span>
      )}
      {runInfo && (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
          filteredVersion
            ? 'bg-violet-50 text-violet-700 border-violet-300'
            : 'bg-amber-50 text-amber-700 border-amber-300'
        }`}>
          {filteredVersion ? `🔀 ${filteredVersion.toUpperCase()}` : '📊 Actual Data'}
        </span>
      )}
    </>
  );
})()}

  {/* Meta + badges row */}
  <div className="flex items-center justify-between gap-1">
    <div>
      <p className="text-gray-600 truncate">
        {t('prompts.createdBy')}: {prompt.user_name && prompt.user_name !== "undefined" ? prompt.user_name : ""}
      </p>
      <p className="text-gray-600">
        {t('prompts.updated')}: {new Date(prompt.updated_at || prompt.created_at).toLocaleDateString()}
      </p>
    </div>
    <div className="flex flex-col items-end gap-1">
      {outputType && (
        <div className="flex gap-0.5 shrink-0">
          {outputType.includes('C') && (
            <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold flex items-center justify-center border border-purple-300" title="Chart">C</span>
          )}
          {outputType.includes('T') && (
            <span className="w-4 h-4 rounded-full bg-green-100 text-green-700 text-[9px] font-bold flex items-center justify-center border border-green-300" title="Table">T</span>
          )}
          {outputType.includes('M') && (
            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center border border-blue-300" title="Message">M</span>
          )}
        </div>
      )}
      {prompt.data_source_id && filterStatusMap[prompt.data_source_id] !== undefined && (
        <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${
          filterStatusMap[prompt.data_source_id]
            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
            : "bg-gray-100 text-gray-500 border-gray-300"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${filterStatusMap[prompt.data_source_id] ? "bg-emerald-500" : "bg-gray-400"}`} />
          {filterStatusMap[prompt.data_source_id] ? t('prompts.filterOn') : t('prompts.filterOff')}
        </span>
      )}
    </div>
  </div>
</div>

                            {anyFilterEnabled !== null && (
  <div className="mb-1.5 flex justify-end">
    <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${
      anyFilterEnabled
        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
        : "bg-gray-100 text-gray-400 border-gray-200"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        anyFilterEnabled ? "bg-emerald-500" : "bg-gray-400"
      }`} />
      {anyFilterEnabled ? "Filter ON" : "Filter OFF"}
    </span>
  </div>
)}

<hr className="my-1.5 border-t border-gray-100" />

{/* Action buttons */}
<div className="flex justify-center items-center gap-2 mt-1">
                              <button
                                className="text-gray-500 hover:text-blue-600 transition-colors p-0.5"
                                onClick={() => handlePlayClick(prompt)}
                                title="Play"
                              >
                                <FaPlay size={11} />
                              </button>
                              <button
                                className="text-gray-500 hover:text-blue-600 transition-colors p-0.5"
                                onClick={() => handleEditPrompt(prompt)}
                                title="Edit"
                              >
                                <FaPen size={11} />
                              </button>
                              <button
                                className="text-gray-500 hover:text-red-600 transition-colors p-0.5"
                                onClick={() => handleDeletePrompt(prompt.id)}
                                title="Delete"
                              >
                                <FaTrash size={11} />
                              </button>
                              <button
                                className="text-gray-500 hover:text-blue-600 transition-colors p-0.5 relative"
                                onClick={() => handleCommentClick(prompt.id)}
                                title="Comments"
                              >
                                <FaComment size={11} />
                                {getCommentCount(prompt.id) > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] rounded-full h-3 w-3 flex items-center justify-center leading-none">
                                    {getCommentCount(prompt.id)}
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Empty state */}
                {!isLoading && filteredPrompts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-xs">
                      {searchTerm ? t("prompts.noPromptsFound", { term: searchTerm }) : t("prompts.noPromptsAvailable")}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="mt-3 text-blue-500 hover:text-blue-700 text-xs"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {/* {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-800">Import Prompts</h3>
                <button onClick={() => { setShowImportModal(false); setImportFile(null); }} className="text-gray-400 hover:text-gray-600">
                  <FaTimes size={16} />
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-4">Select a <strong>.csv</strong> or <strong>.txt</strong> file exported from this app to import prompts into the current board.</p>

              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-4">
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) setImportFile(e.target.files[0]);
                  }}
                />
                {importFile ? (
                  <div className="text-center px-3">
                    <p className="text-sm font-medium text-green-600 break-all">{importFile.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{(importFile.size / 1024).toFixed(1)} KB — click to change</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-xs text-gray-500">Click to select a <span className="font-semibold">.csv</span> or <span className="font-semibold">.txt</span> file</p>
                  </div>
                )}
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImportModal(false); setImportFile(null); }}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleImportPrompts(importFile ?? undefined)}
                  disabled={!importFile || isImporting}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )} */}

        {/* Export Modal */}
        {/* {showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Export Prompts</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FaTimes size={20} />
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                Choose the format to export {searchTerm ? filteredPrompts.length : prompts.length} prompt{(searchTerm ? filteredPrompts.length : prompts.length) > 1 ? 's' : ''}:
              </p>

              <div className="space-y-3">
                <button
                  onClick={downloadPromptsAsTXT}
                  className="w-full py-3 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
                >
                  Export as TXT
                </button>

                <button
                  onClick={downloadPromptsAsCSV}
                  className="w-full py-3 px-4 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-medium"
                >
                  Export as CSV
                </button>

                <button
                  onClick={() => setShowExportModal(false)}
                  className="w-full py-3 px-4 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )} */}

        {activeTab === "repository" && (
          <div className="w-full">
            {/* Search bar */}
            <div className="w-full bg-white border-b">
              <div className="max-w-[1400px] mx-auto px-3 py-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search prompts..."
                    value={searchTermRepository}
                    onChange={(e) => setSearchTermRepository(e.target.value)}
                    className="w-full py-1.5 px-3 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                  {searchTermRepository ? (
                    <button
                      onClick={() => setSearchTermRepository("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  ) : (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="w-full">
              <div className="max-w-[1400px] mx-auto px-3 py-3">
                {!isLoading && filteredRepositoryPrompts.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 auto-rows-fr">
                    {filteredRepositoryPrompts.map((prompt, index) => {
                      const isGenerated = generatedPromptIds.has(String(prompt.id));
                      const gCount = filteredRepositoryPrompts.slice(0, index).filter(p => generatedPromptIds.has(String(p.id))).length + 1;
                      const nCount = filteredRepositoryPrompts.slice(0, index).filter(p => !generatedPromptIds.has(String(p.id))).length + 1;
                      const label = isGenerated ? `G${gCount}` : `${nCount}`;
                      return (
                      <div
                        key={prompt.id}
                        className={`prompt-card border rounded-lg shadow-sm p-3 bg-white transition-all duration-300 hover:shadow-md flex flex-col justify-between cursor-pointer ${isGenerated ? 'border-blue-300 hover:border-blue-500' : 'hover:border-blue-200'}`}
                        style={{ minHeight: '150px', maxWidth: '100%' }}
                        onClick={() => handlePlayClick(prompt)}
                      >
                        {/* Prompt text */}
                        <p
                          className="text-xs font-semibold mb-2 flex-grow text-gray-800"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: '1.4'
                          }}
                          title={prompt.prompt_text}
                        >
                          <span className={isGenerated ? 'text-blue-600 font-bold' : ''}>{label}.</span> &quot;{translatedTexts[prompt.id] || prompt.prompt_text}&quot;
                        </p>

                        <div className="mt-auto">
                          <hr className="my-1.5 border-t border-gray-100" />
                          <div className="mt-2 text-xs space-y-1">
                            <p className="opacity-90 truncate">
                              {t('prompts.createdBy')}: {prompt.user_name && prompt.user_name !== "undefined" ? prompt.user_name : ""}
                            </p>
                            <div className="flex items-center justify-between gap-1">
                              <p className="opacity-80">{t('prompts.updated')}: {new Date(prompt.updated_at).toLocaleDateString()}</p>
                              {(() => {
                                const ot = promptOutputTypes[prompt.id];
                                if (!ot) return null;
                                return (
                                  <div className="flex gap-0.5 shrink-0">
                                    {ot.includes('C') && <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold flex items-center justify-center border border-purple-300" title="Chart">C</span>}
                                    {ot.includes('T') && <span className="w-4 h-4 rounded-full bg-green-100 text-green-700 text-[9px] font-bold flex items-center justify-center border border-green-300" title="Table">T</span>}
                                    {ot.includes('M') && <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center border border-blue-300" title="Message">M</span>}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : !isLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-xs">
                      {searchTermRepository
                        ? `No prompts found for "${searchTermRepository}"`
                        : "No repository prompts available"}
                    </p>
                    {searchTermRepository && (
                      <button
                        onClick={() => setSearchTermRepository("")}
                        className="mt-3 text-blue-500 hover:text-blue-700 text-xs"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {isCommentOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleCloseComment} />
            <div className="bg-white w-96 max-w-md rounded-lg shadow-lg z-10 relative">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-sm font-medium">
                  {editingCommentId !== null ? 'Edit Comment' : 'Comments'}
                </h3>
                <button onClick={handleCloseComment} className="text-gray-500 hover:text-gray-700">
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Comments List */}
              {commentsLoading ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">Loading comments...</div>
              ) : getCurrentPromptComments().length > 0 && !editingCommentId ? (
                <div className="px-4 py-2 max-h-60 overflow-y-auto">
                  {getCurrentPromptComments().map((comment) => (
                    <div key={comment.id} className="border-b pb-2 mb-2 last:border-0">
                      <div className="flex justify-between items-start">
                        <p className="text-sm text-gray-800">{comment.comment_text}</p>
                        <div className="flex gap-2 ml-2 shrink-0">
                          <button
                            onClick={() => handleEditComment(comment.id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit"
                            disabled={deletingCommentId === comment.id}
                          >
                            <FaEdit size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-red-600 hover:text-red-800 disabled:opacity-40"
                            title="Delete"
                            disabled={deletingCommentId === comment.id}
                          >
                            {deletingCommentId === comment.id ? (
                              <span className="text-[10px]">...</span>
                            ) : (
                              <FaTrash size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {comment.is_edited  /* ✅ use is_edited flag from API */
                          ? `Edited: ${formatDate(comment.updated_at)}`
                          : `Added: ${formatDate(comment.created_at)}`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : !editingCommentId ? (
                <div className="px-4 py-4 text-center text-sm text-gray-400">No comments yet.</div>
              ) : null}

              {/* Add / Edit Form */}
              <form onSubmit={handleSaveComment} className="p-3">
                <textarea
                  className="w-full p-2 border rounded-md mb-3 h-24 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your comment here..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={commentSaving}
                  required
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingCommentId !== null) {
                        setEditingCommentId(null);
                        setCommentText('');
                      } else {
                        handleCloseComment();
                      }
                    }}
                    disabled={commentSaving}
                    className="px-3 py-1 text-xs border rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={commentSaving || commentText.trim() === ''}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed min-w-[60px]"
                  >
                    {commentSaving
                      ? (editingCommentId !== null ? 'Updating...' : 'Saving...')
                      : (editingCommentId !== null ? 'Update' : 'Save')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* {comments.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Comments:</h4>
            <ul className="space-y-2">
              {comments.map(comment => (
                <li key={comment.id} className="text-sm bg-gray-50 p-2 rounded">
                  <p>{comment.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )} */}

        {isResultModalOpen && runResult && (
          <div
            id="result-modal-scroll"
            className="fixed inset-0 z-50 bg-white overflow-y-auto"
            style={{scrollbarWidth:'auto', scrollbarColor:'#93c5fd #f1f1f1'}}
            onScroll={(e) => setShowTopBtn((e.currentTarget.scrollTop > 200))}
          >
            <div className="w-full p-4 relative">
              <div className="result-modal">
                <div className="result-modal-content">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold">Prompt</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setIsResultModalOpen(false); setShowTopBtn(false); setActiveTab(returnTab); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-400 rounded-md hover:bg-blue-50 transition-colors"
                      >
                        ← Back
                      </button>
                      {/* <button
                        onClick={() => { setRunResult(null); setSelectedPrompt(""); setActiveTab("message"); }}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-200"
                      >
                        Clear
                      </button> */}
                      <span
                        className="close-btn cursor-pointer text-xl text-gray-500 hover:text-gray-800 leading-none"
                        onClick={() => { setIsResultModalOpen(false); setShowTopBtn(false); setActiveTab(returnTab); }}
                      >
                        &times;
                      </span>
                    </div>
                  </div>

                  <textarea
                    value={translatedPromptDisplay || selectedPrompt || ""}
                    readOnly
                    rows={3}
                    className="w-full p-2 border-2 border-blue-400 rounded text-sm resize-none bg-blue-50 text-gray-800 focus:outline-none"
                  />
<br></br>
<br></br>
                  {/* <h3 className="text-base font-semibold mt-4 mb-2">Run Result</h3> */}
                  <div className="run-results">
                    {/* Tab buttons + Download Excel in one row */}
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="tabs flex space-x-2">
                        {['message', 'table', 'charts'].map((tab) => {
                          const hasData =
                            tab === 'message' ? (runResult?.message?.length ?? 0) > 0 :
                            tab === 'table'   ? (runResult?.table?.columns?.length ?? 0) > 0 :
                                                (runResult?.charts?.length ?? 0) > 0;
                          return (
                            <button
                              key={tab}
                              onClick={() => hasData && setResultTab(tab)}
                              disabled={!hasData}
                              className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                                !hasData
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                  : resultTab === tab
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        {resultTab === 'table' && runResult?.table && runResult.table.columns?.length > 0 && (
                          <button
                            onClick={downloadExcel}
                            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Download as Excel
                          </button>
                        )}
                        {resultTab === 'charts' && (runResult?.charts ?? []).length > 0 && (
                          <button
                            onClick={() => setShowDownloadModal(true)}
                            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Download as PPT
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tab Content */}
                    <div className="tab-content">
                      {resultTab === 'message' && (
                        <div>
                          {runResult?.message?.length > 0 ? (
                            <p className="text-sm text-black-700 whitespace-pre-wrap p-4">{translatedResultMessages.length > 0 ? translatedResultMessages : runResult.message}</p>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-black-400">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-black-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <p className="text-sm font-medium text-black-500">No message found</p>
                              <p className="text-xs mt-1 text-black-400">This prompt did not return any message.</p>
                            </div>
                          )}
                        </div>
                      )}

                     {resultTab === 'table' && (
                        <div className="table-tab">
                          {runResult?.table && runResult.table.columns?.length > 0 ? (
                            <div className="max-h-[520px] overflow-auto border border-gray-300 rounded" style={{scrollbarWidth:'auto', scrollbarColor:'#93c5fd #f1f1f1'}}>
                              <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                  <tr>
                                    {runResult.table.columns.map((col, idx) => (
                                      <th
                                        key={`col-header-${idx}-${col}`}
                                        style={{ width: colWidths[idx] || 200, minWidth: 100, position: 'relative', userSelect: 'none', boxSizing: 'border-box' }}
                                        className="border-b border-r border-gray-300 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                                        onClick={() => handleColSort(idx)}
                                      >
                                        <span className="flex items-center gap-1 px-2 py-2 overflow-hidden">
                                          <span className="truncate">{translatedResultColumns[idx] || col}</span>
                                          {tableSortCol === idx && (
                                            <span className="flex-shrink-0 text-blue-500 text-xs">
                                              {tableSortDir === 'asc' ? '▲' : '▼'}
                                            </span>
                                          )}
                                        </span>
                                        <span
                                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startColResize(idx, e.clientX); }}
                                          onClick={e => e.stopPropagation()}
                                          style={{ position: 'absolute', right: 0, top: '15%', bottom: '15%', width: 4, cursor: 'col-resize', borderRight: '2px solid #9ca3af' }}
                                        />
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedTableData.length > 0 ? (
                                    sortedTableData.map((row, rowIdx) => (
                                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                                        {row.map((cell, cellIdx) => (
                                          <td key={cellIdx} style={{ width: colWidths[cellIdx] || 200, maxWidth: colWidths[cellIdx] || 200, overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box', whiteSpace: 'nowrap' }} className="px-2 py-2 border-b border-r border-gray-100 text-sm text-gray-700">
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={runResult.table.columns.length} className="text-center p-2 text-gray-400">No data available.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-black-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-black-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 4v16M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
                              </svg>
                              <p className="text-sm font-medium text-black-500">No table found</p>
                              <p className="text-xs mt-1 text-black-500">This prompt did not return any tabular data.</p>
                            </div>
                          )}
                        </div>
                      )}

                     {resultTab === 'charts' && (
                        <div className="charts-tab">
                          {(runResult?.charts ?? []).length > 0 ? (
                            <>

                              <div className="flex justify-end">
                                {/* <button
                                  onClick={() => setShowDownloadModal(true)}
                                  className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-md"
                                >
                                  Download as PPTee
                                </button> */}
                                {showDownloadModal && (
                                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                                      <h3 className="text-xl font-bold text-blue-700 mb-4">Download Report Options</h3>
                                      <p className="font-bold mb-2">Charts Only:</p>
                                      <p className="mb-4">Please select the type of report you would like to download:</p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            setShowDownloadModal(false);
                                            downloadPPT(false, 'limited');
                                          }}
                                          className="flex-1 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
                                        >
                                          Download
                                        </button>
                                        <button
                                          onClick={() => {
                                            const selectedOptionElement = document.querySelector('input[name="tableRows"]:checked');
                                            const selectedOption = selectedOptionElement ? (selectedOptionElement as HTMLInputElement).value : 'limited';
                                            setEmailData(prev => ({
                                              ...prev,
                                              reportType: 'complete',
                                              tableOption: selectedOption
                                            }));
                                            setShowEmailModal(true);
                                          }}
                                          className="flex-1 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors"
                                        >
                                          Send via Email
                                        </button>
                                      </div>

                                      <div className="border-t border-gray-200 pt-4 mb-4">
                                        <p className="font-bold mb-2">Include table data in report:</p>

                                        <div className="space-y-2 mb-4">
                                          <div className="flex items-center">
                                            <input
                                              type="radio"
                                              id="limitedRows"
                                              name="tableRows"
                                              value="limited"
                                              defaultChecked
                                              className="mr-2"
                                            />
                                            <label htmlFor="limitedRows">First 20 rows only</label>
                                          </div>

                                          <div className="flex items-center">
                                            <input
                                              type="radio"
                                              id="allRows"
                                              name="tableRows"
                                              value="all"
                                              className="mr-2"
                                            />
                                            <label htmlFor="allRows">All table rows</label>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => {
                                              const selectedOptionElement = document.querySelector('input[name="tableRows"]:checked');
                                              const selectedOption = selectedOptionElement ? (selectedOptionElement as HTMLInputElement).value : 'limited';
                                              setShowDownloadModal(false);
                                              downloadPPT(true, selectedOption);
                                            }}
                                            className="flex-1 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
                                          >
                                            Download
                                          </button>
                                          <button
                                            onClick={() => {
                                              const selectedOptionElement = document.querySelector('input[name="tableRows"]:checked');
                                              const selectedOption = selectedOptionElement ? (selectedOptionElement as HTMLInputElement).value : 'limited';
                                              setEmailData(prev => ({
                                                ...prev,
                                                reportType: 'complete',
                                                tableOption: selectedOption
                                              }));
                                              setShowEmailModal(true);
                                            }}
                                            className="flex-1 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors"
                                          >
                                            Send via Email
                                          </button>
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => setShowDownloadModal(false)}
                                        className="w-full py-2 bg-gray-200 text-gray-800 rounded border border-gray-300"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Email Modal */}
                                {showEmailModal && (
                                  <div
                                    className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center"
                                    style={{ zIndex: 9999 }}
                                  >
                                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full mx-4">
                                      <h3 className="text-xl font-bold text-green-700 mb-4">Send Report via Email</h3>

                                      <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                        <p className="text-sm text-blue-800">
                                          <strong>Report Type:</strong> {emailData.reportType === 'charts-only' ? 'Charts Only' : 'Complete Report'}
                                          {emailData.reportType === 'complete' && (
                                            <><br /><strong>Table Data:</strong> {emailData.tableOption === 'all' ? 'All rows' : 'First 20 rows only'}</>
                                          )}
                                        </p>
                                      </div>

                                      <form className="space-y-4">
                                        <div>
                                          <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                                            Recipient Email Address *
                                          </label>
                                          <input
                                            type="email"
                                            id="recipientEmail"
                                            value={emailData.email}
                                            onChange={(e) => setEmailData(prev => ({ ...prev, email: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            placeholder="recipient@example.com"
                                            required
                                          />
                                        </div>

                                        <div>
                                          <label htmlFor="emailSubject" className="block text-sm font-medium text-gray-700 mb-1">
                                            Subject
                                          </label>
                                          <input
                                            type="text"
                                            id="emailSubject"
                                            value={emailData.subject}
                                            onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            placeholder="Data Analysis Report"
                                          />
                                        </div>

                                        <div>
                                          <label htmlFor="emailMessage" className="block text-sm font-medium text-gray-700 mb-1">
                                            Additional Message (Optional)
                                          </label>
                                          <textarea
                                            id="emailMessage"
                                            value={emailData.message}
                                            onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            placeholder="Enter any additional message..."
                                          />
                                        </div>

                                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                                          <div className="flex">
                                            <div className="flex-shrink-0">
                                              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                              </svg>
                                            </div>
                                            <div className="ml-3">
                                              <p className="text-sm text-yellow-700">
                                                This will open your default email client. The report file will need to be manually attached.
                                              </p>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!emailData.email) {
                                                toast.error('Please enter a recipient email address');
                                                return;
                                              }
                                              const includeTable = emailData.reportType === 'complete';
                                              const tableOption = emailData.tableOption || 'limited';
                                              sendViaEmail(includeTable, tableOption);
                                            }}
                                            className="flex-1 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors"
                                          >
                                            Send Email
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setShowEmailModal(false);
                                              setEmailData({ email: '', subject: '', message: '', tableOption: 'limited', reportType: '' });
                                            }}
                                            className="flex-1 py-2 bg-gray-200 text-gray-800 rounded border border-gray-300 hover:bg-gray-300 transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </form>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* <p className="text-center">Charts will be displayed here.</p> */}

                              {/* Flex container for charts */}
                              <div className="my-4 flex flex-wrap justify-center gap-6">
                                {runResult.charts && runResult.charts.map((chart: ChartData, index: number) => {
                                  switch (chart.chart_type) {
                                    case 'pie':
                                      return (
                                        <div key={`pie-chart-${index}`} className="w-full max-w-[400px] flex-1 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
                                          <h5 className="text-sm font-semibold text-center text-gray-800 mb-3">Pie Chart</h5>
                                          <div style={{ height: '300px', position: 'relative' }}>
                                            <Pie data={getPieData(chart)}
                                              options={{
                                                maintainAspectRatio: false,
                                                plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } }
                                              }}
                                            />
                                          </div>
                                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                            <p className="text-xs font-semibold text-gray-700 mb-1">Insights:</p>
                                            <ul className="list-disc list-inside">
                                              {chart.insight && chart.insight.map((insight, insightIndex) => (
                                                <li key={`pie-insight-${index}-${insightIndex}`} className="text-xs text-gray-600">{insight}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        </div>
                                      );
                                    case 'bar':
                                      return (
                                        <div key={`bar-chart-${index}`} className="w-full max-w-[500px] flex-1 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
                                          <h5 className="text-sm font-semibold text-center text-gray-800 mb-3">Bar Chart</h5>
                                          <div style={{ height: '350px', position: 'relative' }}>
                                            <Bar
                                              data={getChartData(chart, 'bar')}
                                              options={{
                                                maintainAspectRatio: false,
                                                plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } },
                                                scales: {
                                                  y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: '#f0f0f0' } },
                                                  x: { ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true }, grid: { display: false } }
                                                }
                                              }}
                                            />
                                          </div>
                                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                            <p className="text-xs font-semibold text-gray-700 mb-1">Insights:</p>
                                            <ul className="list-disc list-inside">
                                              {chart.insight && chart.insight.map((insight, insightIndex) => (
                                                <li key={`bar-insight-${index}-${insightIndex}`} className="text-xs text-gray-600">{insight}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        </div>
                                      );
                                    case 'line':
                                      return (
                                        <div key={`line-chart-${index}`} className="w-full max-w-[500px] flex-1 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
                                          <h5 className="text-sm font-semibold text-center text-gray-800 mb-3">Line Chart</h5>
                                          <div style={{ height: '350px', position: 'relative' }}>
                                            <Line
                                              data={getChartData(chart, 'line')}
                                              options={{
                                                maintainAspectRatio: false,
                                                plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } },
                                                scales: {
                                                  y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: '#f0f0f0' } },
                                                  x: { ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true }, grid: { display: false } }
                                                }
                                              }}
                                            />
                                          </div>
                                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                            <p className="text-xs font-semibold text-gray-700 mb-1">Insights:</p>
                                            <ul className="list-disc list-inside">
                                              {chart.insight && chart.insight.map((insight, insightIndex) => (
                                                <li key={`line-insight-${index}-${insightIndex}`} className="text-xs text-gray-600">{insight}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        </div>
                                      );
                                    default:
                                      return null;
                                  }
                                })}
                              </div>
                            </>
                          ) : (
                            // ✅ Empty state
                            <div className="flex flex-col items-center justify-center py-16 text-black-400">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-black-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <p className="text-sm font-medium text-black-500">No charts found</p>
                              <p className="text-xs mt-1 text-black-400">This prompt did not return any chart data.</p>
                            </div>
                          )}
                        </div>

                      )}



                      {/* Modal */}

                    </div>
                  </div>
                </div>
              </div>

              {/* Scroll to Top button — only after scrolling 200px */}
              {showTopBtn && (
                <button
                  onClick={() => {
                    const el = document.getElementById('result-modal-scroll');
                    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg z-[60] transition-all"
                >
                  ↑ Top
                </button>
              )}
            </div>
          </div>

        )}

        {isLoading && <Spinner />}

        {activeTab === "tables" && (
          <div className="p-2 sm:p-4">
            {/* Header */}
            <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:justify-between sm:items-center sm:mb-4">
              {/* Title + slot indicators */}
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-700">Data Sources</h2>
                {dataSources.length > 0 && (
                  <>
                    <span className="text-xs text-gray-400">
                      ({dataSources.length}/{dataSources[0]?.total_slots || 4} slots)
                    </span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: dataSources[0]?.total_slots || 4 }, (_, i) => {
                        const filled = dataSources.find(s => s.slot_number === i + 1);
                        return (
                          <div
                            key={i}
                            className={`w-5 h-1.5 rounded-full ${filled ? "bg-blue-500" : "bg-gray-200"}`}
                            title={filled ? `Slot ${i + 1}: ${filled.source_name}` : `Slot ${i + 1}: Empty`}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={fetchDataSources}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-md hover:text-blue-800 whitespace-nowrap"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <button
                  className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs whitespace-nowrap"
                  onClick={handleViewTables}
                >
                  + PG Table
                </button>
                <button
                  className="px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs whitespace-nowrap"
                  onClick={handleeOpenModal}
                >
                  + Info-Object
                </button>
              </div>
            </div>

            {/* Table container */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {dataSourcesLoading ? (
                <div className="flex justify-center items-center py-10">
                  <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="min-w-[560px] w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase w-10">Slot</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase hidden sm:table-cell">Description</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Type</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase w-16">Status</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">

                      {/* Approved data sources */}
                      {dataSources.map((source) => {
                        const matchedRow = source.source_type === "csv"
                          ? rows.find(r => String(r.id) === String(source.data_management_table_id))
                          : null;
                        const isExpanded = isDropdownOpenn === String(source.id);

                        return (
                          <React.Fragment key={`source-${source.id}`}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-2 py-2">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                  {source.slot_number}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-xs font-medium text-gray-800 max-w-[100px] truncate" title={source.source_name}>
                                {source.source_name}
                              </td>
                              <td className="px-2 py-2 text-xs text-gray-600 max-w-[120px] truncate hidden sm:table-cell" title={source.description}>
                                {source.description || "—"}
                              </td>
                              <td className="px-2 py-2">
                                <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${source.source_type === "table_data"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-green-100 text-green-700"
                                  }`}>
                                  {source.source_type_display}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                  Active
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex justify-center items-center gap-1.5">
                                  {source.source_type === "csv" && matchedRow && (
                                    <>
                                      <button
                                        onClick={() => handleEdit(matchedRow)}
                                        className="text-blue-600 hover:text-blue-800 p-1"
                                        title="Edit"
                                      >
                                        <FaPen size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleOpenUploadModal(matchedRow.id)}
                                        className="text-green-600 hover:text-green-800 p-1"
                                        title="Upload File"
                                      >
                                        <FaFileUpload size={12} />
                                      </button>
                                      <button
                                        onClick={() => toggleDropdowns(String(source.id))}
                                        className="text-gray-600 hover:text-gray-800 p-1"
                                        title={isExpanded ? "Collapse" : "View Files"}
                                      >
                                        {isExpanded ? <FaCaretUp size={12} /> : <FaCaretDown size={12} />}
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => setDeleteDataSourceConfirm({ isOpen: true, source })}
                                    className="text-red-600 hover:text-red-800 p-1"
                                    title="Delete"
                                  >
                                    <FaTrash size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded files for approved source */}
                            {isExpanded && matchedRow && (
                              <tr>
                                <td colSpan={6} className="px-0 py-0 bg-gray-50">
                                  <div className="px-4 py-3">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Uploaded Files</p>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">File Name</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Created On</th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {matchedRow.files && matchedRow.files.length > 0 ? (
                                            matchedRow.files.map((file) => (
                                              <tr key={file.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate">{file.filename}</td>
                                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(file.created_at).toLocaleDateString()}</td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr>
                                              <td colSpan={2} className="px-3 py-3 text-center text-gray-400 text-xs">
                                                No files uploaded yet
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Pending / unapproved info-objects */}
                      {rows
                        .filter(row => {
                          if (row.approval_status && row.approval_status !== 'pending') return false;
                          const alreadyLinked = dataSources.some(
                            s => String(s.data_management_table_id) === String(row.id)
                          );
                          return !alreadyLinked;
                        })
                        .map((row) => {
                          const isExpanded = isDropdownOpenn === String(row.id);
                          return (
                            <React.Fragment key={`pending-${row.id}`}>
                              <tr className="hover:bg-yellow-50 bg-yellow-25">
                                <td className="px-2 py-2">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                                    —
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-xs font-medium text-gray-800 max-w-[100px] truncate" title={row.table_name}>
                                  {row.table_name}
                                </td>
                                <td className="px-2 py-2 text-xs text-gray-600 max-w-[120px] truncate hidden sm:table-cell" title={row.table_description}>
                                  {row.table_description}
                                </td>
                                <td className="px-2 py-2">
                                  <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                    CSV
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
                                    Pending
                                  </span>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex justify-center items-center gap-1 flex-wrap">
                                    <button
                                      onClick={() => handleDirectApprove('table', row.id)}
                                      className="flex items-center gap-0.5 px-1.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded"
                                      title="Approve & Add to Data Sources"
                                    >
                                      <FaCheck size={9} />
                                      <span className="hidden sm:inline">Approve</span>
                                    </button>
                                    <button
                                      onClick={() => handleEdit(row)}
                                      className="text-blue-600 hover:text-blue-800 p-1"
                                      title="Edit"
                                    >
                                      <FaPen size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenUploadModal(row.id)}
                                      className="text-green-600 hover:text-green-800 p-1"
                                      title="Upload File"
                                    >
                                      <FaFileUpload size={12} />
                                    </button>
                                    <button
                                      onClick={() => toggleDropdowns(String(row.id))}
                                      className="text-gray-600 hover:text-gray-800 p-1"
                                      title={isExpanded ? "Collapse" : "View Files"}
                                    >
                                      {isExpanded ? <FaCaretUp size={12} /> : <FaCaretDown size={12} />}
                                    </button>
                                    <button
                                      onClick={() => handleDeletes(row)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                      title="Delete"
                                    >
                                      <FaTrash size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded files for pending */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={6} className="px-0 py-0 bg-gray-50">
                                    <div className="px-4 py-3">
                                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Uploaded Files</p>
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                                          <thead className="bg-gray-100">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">File Name</th>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Created On</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-gray-200">
                                            {row.files && row.files.length > 0 ? (
                                              row.files.map((file) => (
                                                <tr key={file.id} className="hover:bg-gray-50">
                                                  <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate">{file.filename}</td>
                                                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(file.created_at).toLocaleDateString()}</td>
                                                </tr>
                                              ))
                                            ) : (
                                              <tr>
                                                <td colSpan={2} className="px-3 py-3 text-center text-gray-400 text-xs">
                                                  No files uploaded yet. Click Upload above.
                                                </td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}

                      {/* Empty state */}
                      {dataSources.length === 0 && rows.filter(r => !r.approval_status || r.approval_status === 'pending').length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-500">
                            No data sources or info-objects yet. Use "+ PG Table" or "+ Info-Object" to add.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Delete Data Source Modal ── */}
            {deleteDataSourceConfirm.isOpen && deleteDataSourceConfirm.source && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-gray-800">Delete Data Source</h3>
                    <button
                      onClick={() => setDeleteDataSourceConfirm({ isOpen: false, source: null })}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes />
                    </button>
                  </div>
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md">
                    <p className="text-sm text-gray-700 mb-1">You are about to delete:</p>
                    <p className="font-semibold text-gray-900 text-sm">{deleteDataSourceConfirm.source.source_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Slot {deleteDataSourceConfirm.source.slot_number} · {deleteDataSourceConfirm.source.source_type_display}
                      {deleteDataSourceConfirm.source.pg_table_name && ` · ${deleteDataSourceConfirm.source.pg_table_name}`}
                    </p>
                  </div>
                  <p className="text-xs text-red-600 mb-5">
                    ⚠️ This also deletes associated AI documentation. This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setDeleteDataSourceConfirm({ isOpen: false, source: null })}
                      className="px-3 py-2 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
                      disabled={isDeletingDataSource}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteDataSource}
                      disabled={isDeletingDataSource}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium flex items-center gap-2"
                    >
                      {isDeletingDataSource ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Deleting...
                        </>
                      ) : (
                        <><FaTrash size={11} /> Delete</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Delete Info-Object Confirmation Modal ── */}
            {deleteConfirmation.isOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold">Confirm Deletion</h3>
                    <button
                      onClick={cancelDelete}
                      className="text-gray-500 hover:text-gray-700"
                      disabled={isDeletingInfoObject}
                    >
                      <FaTimes />
                    </button>
                  </div>
                  <p className="text-sm mb-6">
                    Are you sure you want to delete the Info-Object "
                    <span className="font-semibold">{deleteConfirmation.rowToDelete?.table_name}</span>"?
                    This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={cancelDelete}
                      disabled={isDeletingInfoObject}
                      className="px-3 py-2 border border-gray-300 rounded-md text-xs hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={isDeletingInfoObject}
                      className="px-3 py-2 bg-red-600 text-white rounded-md text-xs hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isDeletingInfoObject ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Deleting...
                        </>
                      ) : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── View PG Tables Modal ── */}
            {isViewTablesModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-3">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="flex justify-between items-start px-4 py-3 border-b flex-shrink-0">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">PostgreSQL Tables</h3>
                      {pgDbInfo && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          DB: <span className="font-medium">{pgDbInfo.database_name}</span>
                          &nbsp;·&nbsp;
                          <span className="font-medium">{pgDbInfo.table_count}</span> tables
                          &nbsp;·&nbsp;
                          <span className="text-blue-600 font-medium">Click +Add to Insert</span>
                        </p>
                      )}
                    </div>
                    <button onClick={() => setIsViewTablesModalOpen(false)} className="text-gray-400 hover:text-gray-600 ml-2">
                      <FaTimes size={16} />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-3 overflow-y-auto flex-1">
                    {pgTablesLoading ? (
                      <div className="flex justify-center items-center py-10">
                        <svg className="animate-spin h-7 w-7 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : pgTables.length === 0 ? (
                      <p className="text-center text-gray-500 text-sm py-8">No tables found in this database.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-[520px] w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">#</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Table Name</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Rows</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase hidden sm:table-cell">Cols</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase hidden sm:table-cell">Size</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase hidden sm:table-cell">Created</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 uppercase">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pgTables.map((table, index) => (
                              <tr key={table.table_name} className="hover:bg-blue-50 transition-colors">
                                <td className="px-3 py-2 text-gray-400">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-gray-800 max-w-[120px] truncate">{table.table_name}</td>
                                <td className="px-3 py-2 text-gray-600">{table.row_count.toLocaleString()}</td>
                                <td className="px-3 py-2 text-gray-600 hidden sm:table-cell">{table.column_count}</td>
                                <td className="px-3 py-2 text-gray-600 hidden sm:table-cell">{table.size}</td>
                                <td className="px-3 py-2 text-gray-600 hidden sm:table-cell">
                                  {table.created_at ? new Date(table.created_at).toLocaleDateString() : "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedPgTable(table);
                                      setAddDataSourceForm({
                                        source_name: table.table_name,
                                        description: "",
                                        row_limit: 500000,
                                      });
                                      setShowAddDataSourceModal(true);
                                    }}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                                  >
                                    + Add
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end px-4 py-3 border-t flex-shrink-0">
                    <button
                      onClick={() => setIsViewTablesModalOpen(false)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Add as Data Source Modal ── */}
            {showAddDataSourceModal && selectedPgTable && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] px-3">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
                  {/* Header */}
                  <div className="flex justify-between items-center px-4 py-3 border-b">
                    <h3 className="text-base font-semibold text-gray-800">Add as Data Source</h3>
                    <button
                      onClick={() => {
                        setShowAddDataSourceModal(false);
                        setSelectedPgTable(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes size={16} />
                    </button>
                  </div>

                  {/* Form */}
                  <div className="px-4 py-4 space-y-3">
                    {/* Selected Table (read-only) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Selected Table <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md flex-wrap">
                        <span className="text-blue-700 font-medium text-xs">{selectedPgTable.table_name}</span>
                        <span className="text-xs text-gray-500">
                          ({selectedPgTable.row_count.toLocaleString()} rows · {selectedPgTable.column_count} cols · {selectedPgTable.size})
                        </span>
                      </div>
                    </div>

                    {/* Source Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Source Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addDataSourceForm.source_name}
                        onChange={(e) => setAddDataSourceForm(prev => ({ ...prev, source_name: e.target.value }))}
                        placeholder="e.g. ledger_data"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={addDataSourceForm.description}
                        onChange={(e) => setAddDataSourceForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="e.g. Ledger transactions for financial analysis"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end gap-2 px-4 py-3 border-t">
                    <button
                      onClick={() => {
                        setShowAddDataSourceModal(false);
                        setSelectedPgTable(null);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPgTableAsDataSource}
                      disabled={isAddingDataSource || !addDataSourceForm.source_name || !addDataSourceForm.description}
                      className={`px-3 py-2 rounded-md text-xs text-white font-medium transition-colors ${isAddingDataSource || !addDataSourceForm.source_name || !addDataSourceForm.description
                        ? "bg-blue-300 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                        }`}
                    >
                      {isAddingDataSource ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Adding...
                        </span>
                      ) : "Add Data Source"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Upload Files Modal ── */}
            {isUploadModalOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 px-3">
                <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold">Upload Files</h3>
                    <button onClick={handleCloseUploadModal} className="text-gray-400 hover:text-gray-500">
                      <FaTimes />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitMultipleFiles} className="space-y-4">
                    <div>
                      <label className="block text-gray-700 text-xs font-bold mb-1.5" htmlFor="datePicker">
                        Select Date:
                      </label>
                      <input
                        type="date"
                        id="datePicker"
                        name="date"
                        value={selectedDate}
                        onChange={handleDateChange}
                        className="border rounded w-full py-2 px-3 text-gray-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 text-xs font-bold mb-1.5">
                        Select Files (Multiple):
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors">
                        <input
                          id="fileInput"
                          name="files"
                          type="file"
                          multiple
                          onChange={handleMultipleFileSelect}
                          className="hidden"
                          accept=".csv,.xlsx,.xls"
                        />
                        <label htmlFor="fileInput" className="cursor-pointer">
                          <FaUpload className="text-gray-500 mx-auto mb-2" size={20} />
                          <p className="text-xs text-gray-600 mb-1">
                            {selectedFiles.length > 0
                              ? `${selectedFiles.length} file(s) selected`
                              : 'Click or drag files to upload'}
                          </p>
                          {selectedFiles.length > 0 && (
                            <div className="mt-2 text-xs text-left max-h-24 overflow-y-auto">
                              {selectedFiles.map((file, index) => (
                                <div key={index} className="text-blue-600 truncate">• {file.name}</div>
                              ))}
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCloseUploadModal}
                        className="px-3 py-2 border border-gray-300 rounded-md text-xs hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploading || selectedFiles.length === 0}
                        className={`px-3 py-2 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600 focus:outline-none ${isUploading || selectedFiles.length === 0 ? 'opacity-75 cursor-not-allowed' : ''
                          }`}
                      >
                        {isUploading ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Uploading...
                          </span>
                        ) : `Upload${selectedFiles.length > 0 ? ` (${selectedFiles.length})` : ''}`}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── Create / Edit Info-Object Modal ── */}
            {isModallOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 px-3">
                <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-4">
                  <h3 className="text-base font-semibold mb-4">
                    {editRow ? 'Edit Info-Object' : 'Create New Info-Object'}
                  </h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-gray-700 text-xs font-bold mb-1.5">
                        Info-Object Name
                      </label>
                      <input
                        type="text"
                        name="tableName"
                        value={formData.tableName}
                        onChange={handleChange}
                        required
                        disabled={isSavingInfoObject}
                        className="border rounded w-full py-2 px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-xs font-bold mb-1.5">
                        Info-Object Description
                      </label>
                      <input
                        type="text"
                        name="tableDescription"
                        value={formData.tableDescription}
                        onChange={handleChange}
                        required
                        disabled={isSavingInfoObject}
                        className="border rounded w-full py-2 px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSavingInfoObject}
                        className={`flex-1 text-white text-xs font-bold py-2 px-4 rounded focus:outline-none flex items-center justify-center gap-2 ${isSavingInfoObject ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-700'
                          }`}
                      >
                        {isSavingInfoObject ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {editRow ? 'Updating...' : 'Creating...'}
                          </>
                        ) : (
                          editRow ? 'Update' : 'Save'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleeCloseModal}
                        disabled={isSavingInfoObject}
                        className="flex-1 bg-gray-500 hover:bg-gray-700 text-white text-xs font-bold py-2 px-4 rounded focus:outline-none disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Close
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}


        {activeTab === "documentation" && (
          <div className="w-full">
            <div className="max-w-[1400px] mx-auto px-3 py-3">

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Total Sources</p>
                  <p className="text-2xl font-bold text-blue-600 mt-0.5">{data.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Total Columns</p>
                  <p className="text-2xl font-bold text-green-600 mt-0.5">
                    {data.reduce((acc, src) => acc + (src.columns?.length || 0), 0)}
                  </p>
                </div>
              </div>

              {/* AI Documentation Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 mb-4">

                {/* Table Header */}
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-800">AI Documentation</h3>
                  <button
                    onClick={fetchData}
                    className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">Source Name</th>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">Type</th>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-600 uppercase tracking-wider">Columns</th>
                        <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
                            <p className="text-gray-400 text-xs">No data available for this board.</p>
                          </td>
                        </tr>
                      ) : (
                        data.map((source) => {
                          const isExpanded = expandedRow === source.id;
                          return (
                            <React.Fragment key={source.id}>
                              <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? "bg-blue-50" : ""}`}>
                                {/* Status dot */}
                                <td className="px-3 py-2 text-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 mx-auto"></div>
                                </td>

                                {/* Source name */}
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4" />
                                      </svg>
                                    </div>
                                    <p className="text-xs font-semibold text-gray-800">{source.source_name}</p>
                                  </div>
                                </td>

                                {/* Type badge */}
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${source.source_type === "table_data"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-green-100 text-green-700"
                                    }`}>
                                    {source.source_type === "table_data" ? "Table" : source.source_type}
                                  </span>
                                </td>

                                {/* Column count */}
                                <td className="px-3 py-2">
                                  <span className="text-xs text-gray-600">
                                    <span className="font-medium text-blue-600">{source.columns?.length || 0}</span> cols
                                  </span>
                                </td>

                                {/* Expand button */}
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => setExpandedRow(isExpanded ? null : source.id)}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${isExpanded
                                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                  >
                                    {isExpanded
                                      ? <><MdArrowDropUp size={14} /> Collapse</>
                                      : <><MdArrowDropDown size={14} /> View Columns</>}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded columns */}
                              {isExpanded && (
                                <tr className="bg-blue-50">
                                  <td colSpan={5} className="px-0 py-0">
                                    <div className="px-5 py-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-semibold text-gray-700">
                                          Column Documentation — {source.source_name}
                                        </h4>
                                        <span className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                                          {source.columns?.length || 0} columns
                                        </span>
                                      </div>

                                      <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                        <table className="min-w-full bg-white">
                                          <thead>
                                            <tr className="bg-gray-100">
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase w-6">#</th>
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase w-48">Column Name</th>
                                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Description</th>
                                              <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase w-16">Edit</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {source.columns && source.columns.length > 0 ? (
                                              source.columns.map((col: DocumentationColumn, colIdx: number) => {
                                                const isEditingCol =
                                                  editRowId === source.id &&
                                                  editRowKey === col.column_name;
                                                return (
                                                  <tr key={colIdx} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 text-[10px] text-gray-400">{colIdx + 1}</td>
                                                    <td className="px-3 py-2">
                                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-mono text-gray-700 border border-gray-200">
                                                        {col.column_name}
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                      {isEditingCol ? (
                                                        <input
                                                          type="text"
                                                          value={
                                                            editValues[source.id]?.[col.column_name] ??
                                                            col.description
                                                          }
                                                          onChange={(e) =>
                                                            handleChanges(source.id, col.column_name, e.target.value)
                                                          }
                                                          className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                          autoFocus
                                                        />
                                                      ) : (
                                                        <span className="text-xs text-gray-600">
                                                          {col.description || (
                                                            <span className="text-gray-300 italic text-[10px]">No description</span>
                                                          )}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                      {isEditingCol ? (
                                                        <button
                                                          onClick={() => handleSaveClicks(source.id, boardId)}
                                                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] rounded"
                                                        >
                                                          <FiSave size={10} /> Save
                                                        </button>
                                                      ) : (
                                                        <button
                                                          onClick={() => {
                                                            setEditRowId(source.id);
                                                            setEditRowKey(col.column_name);
                                                            setEditValues((prev) => ({
                                                              ...prev,
                                                              [source.id]: {
                                                                ...(prev[source.id] || {}),
                                                                [col.column_name]: col.description,
                                                              },
                                                            }));
                                                          }}
                                                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] rounded"
                                                        >
                                                          <FaPen size={9} /> Edit
                                                        </button>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })
                                            ) : (
                                              <tr>
                                                <td colSpan={4} className="px-4 py-5 text-center text-xs text-gray-400 italic">
                                                  No columns documented yet.
                                                </td>
                                              </tr>
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Modal for Editing Table Details */}
        {isModalOpen && (
          <div className="modal-overlays" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
            <div className="modals" style={{ backgroundColor: "#fff", margin: "50px auto", padding: "20px", width: "400px", borderRadius: "8px" }}>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Table Name</label>
                  <input
                    type="text"
                    name="tableName"
                    value={formData.tableName}
                    onChange={handleChange}
                    required
                    style={{ padding: "8px", width: "100%", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
                <div className="form-group">
                  <label>Table Description</label>
                  <input
                    type="text"
                    name="tableDescription"
                    value={formData.tableDescription}
                    onChange={handleChange}
                    required
                    style={{ padding: "8px", width: "100%", borderRadius: "4px", border: "1px solid #ccc" }}
                  />
                </div>
                <div className="modal-actionss" style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
                  <button type="submit" className="save-btns" style={{ padding: "8px 16px", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "4px" }}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="close-btns"
                    onClick={handleCloseModal}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#6c757d",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isModalOpen && showTopBtn && (
          <button
            onClick={() => {
              const el = document.getElementById('run-prompt-scroll');
              if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="fixed bottom-6 right-6 z-[100] bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-colors"
          >
            ↑ Top
          </button>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-white flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-gray-800">{t('runPrompt.title')}</h2>
                {anyFilterEnabled !== null && (
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                    anyFilterEnabled
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      anyFilterEnabled ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                    }`} />
                    {t('runPrompt.parameterFilter')}: {anyFilterEnabled ? t('runPrompt.on') : t('runPrompt.off')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseModal}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-400 rounded-md hover:bg-blue-50 transition-colors"
                >
                  {t('runPrompt.back')}
                </button>
                <button
                  onClick={() => { setNewPromptName(""); setRunResult(null); setIsRunClicked(false); }}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-200"
                >
                  {t('runPrompt.clear')}
                </button>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ✖
                </button>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div id="run-prompt-scroll" className="flex-1 overflow-y-auto px-4 py-3" style={{scrollbarWidth:'thin', scrollbarColor:'#93c5fd #f1f1f1'}} onScroll={(e) => setShowTopBtn(e.currentTarget.scrollTop > 200)}>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  className="w-full p-2 pb-8 border-2 border-blue-400 rounded text-xs bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder={t('runPrompt.placeholder')}
                  value={translatedPromptInput || newPromptName}
                  rows={4}
                  ref={textareaRef}
                  onChange={(e) => {
                    const text = e.target.value;
                    promptEnRef.current = text;
                    setNewPromptName(text);
                    setTranslatedPromptInput('');
                  }}
                />
                {/* <button
                  onClick={handleGeneratePrompt}
                  className="absolute bottom-2 right-2 px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[11px] font-medium whitespace-nowrap shadow-sm"
                >
                  Generate Prompts
                </button> */}
              </div>

              {/* Action Buttons */}
              <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                 <button
  onClick={handleVoiceInput}
  title="Click to speak"
  className={`px-3 py-1.5 text-white rounded text-xs font-medium whitespace-nowrap transition-colors ${isListening ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
>
  <FiMic className="text-white text-lg" />
</button>
                <button
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium whitespace-nowrap"
                  onClick={handleViewPromptsClick}
                >
                  {t('runPrompt.viewPrompts')}
                </button>
                <button
                  onClick={handleRePrompt}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium whitespace-nowrap disabled:opacity-50"
                  disabled={isLoading}
                >
                  {t('runPrompt.reprompt')}
                </button>
                <button
                  onClick={handleRunPrompt}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium whitespace-nowrap disabled:opacity-50"
                  disabled={!(promptEnRef.current.trim() || newPromptName.trim()) || isLoading}
                >
                  {t('runPrompt.run')}
                </button>
                <button
                  onClick={handleSavePrompt}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium whitespace-nowrap disabled:opacity-50"
                  disabled={isLoading}
                >
                  {t('runPrompt.save')}
                </button>
              </div>

              {/* Loading spinner */}
              {isLoading && (
                <div className="flex justify-end mt-2">
                  <Spinner />
                </div>
              )}

              {/* ── Run Results ── */}
              {isRunClicked && runResult && (
                <div className="mt-3">

                  {/* All buttons in one single row */}
                  <div className="flex items-center gap-2 mb-2 w-full">
                    {['message', 'table', 'charts'].map((tab) => {
                      const hasData =
                        tab === 'message' ? (runResult?.message?.length ?? 0) > 0 :
                        tab === 'table'   ? (runResult?.table?.columns?.length ?? 0) > 0 :
                                            (runResult?.charts?.length ?? 0) > 0;
                      return (
                        <button
                          key={tab}
                          onClick={() => hasData && setResultTab(tab)}
                          disabled={!hasData}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                            !hasData
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                              : resultTab === tab
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      );
                    })}
                    <div className="ml-auto flex gap-2">
                      {resultTab === 'table' && runResult?.table && runResult.table.columns?.length > 0 && (
                        <button
                          onClick={downloadExcel}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-medium whitespace-nowrap"
                        >
                          Download as Excel
                        </button>
                      )}
                      {resultTab === 'charts' && (runResult?.charts ?? []).length > 0 && (
                        <button
                          onClick={() => setShowDownloadModal(true)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs font-medium whitespace-nowrap"
                        >
                          Download as PPT
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="tab-content">

                    {/* Message Tab */}
                  {resultTab === 'message' && (
                        <div>
                          {runResult?.message?.length > 0 ? (
                            <p className="text-sm text-black-700 whitespace-pre-wrap p-4">{translatedResultMessages.length > 0 ? translatedResultMessages : runResult.message}</p>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-black-400">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-black-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <p className="text-sm font-medium text-black-500">No message found</p>
                              <p className="text-xs mt-1 text-black-400">This prompt did not return any message.</p>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Table Tab */}
                 {resultTab === 'table' && (
                        <div className="table-tab">
                          {runResult?.table && runResult.table.columns?.length > 0 ? (
                            <div className="overflow-auto max-h-96 border border-gray-300 rounded" style={{scrollbarWidth:'auto', scrollbarColor:'#93c5fd #f1f1f1'}}>
                              <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                  <tr>
                                    {runResult.table.columns.map((col, idx) => (
                                      <th
                                        key={`col-header-${idx}-${col}`}
                                        style={{ width: colWidths[idx] || 150, minWidth: 60, position: 'relative', userSelect: 'none', boxSizing: 'border-box' }}
                                        className="border-b border-r border-gray-300 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-200"
                                        onClick={() => handleColSort(idx)}
                                      >
                                        <span className="flex items-center gap-1 px-2 py-2 overflow-hidden">
                                          <span className="truncate">{translatedResultColumns[idx] || col}</span>
                                          {tableSortCol === idx && (
                                            <span className="flex-shrink-0 text-blue-500 text-xs">
                                              {tableSortDir === 'asc' ? '▲' : '▼'}
                                            </span>
                                          )}
                                        </span>
                                        <span
                                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startColResize(idx, e.clientX); }}
                                          onClick={e => e.stopPropagation()}
                                          style={{ position: 'absolute', right: 0, top: '15%', bottom: '15%', width: 4, cursor: 'col-resize', borderRight: '2px solid #9ca3af' }}
                                        />
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedTableData.length > 0 ? (
                                    sortedTableData.map((row, rowIdx) => (
                                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                                        {row.map((cell, cellIdx) => (
                                          <td key={cellIdx} style={{ width: colWidths[cellIdx] || 200, maxWidth: colWidths[cellIdx] || 200, overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box', whiteSpace: 'nowrap' }} className="px-2 py-2 border-b border-r border-gray-100 text-sm text-gray-700">
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={runResult.table.columns.length} className="text-center p-2 text-gray-400">No data available.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-black-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-black-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 4v16M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
                              </svg>
                              <p className="text-sm font-medium text-black-500">No table found</p>
                              <p className="text-xs mt-1 text-black-500">This prompt did not return any tabular data.</p>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Charts Tab */}
                 {resultTab === 'charts' && (
                        <div className="charts-tab">
                          {(runResult?.charts ?? []).length > 0 ? (
                            <>
                              <div>
                                {showDownloadModal && (
                                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                                      <h3 className="text-xl font-bold text-blue-700 mb-4">Download Report Options</h3>
                                      <p className="font-bold mb-2">Charts Only:</p>
                                      <p className="mb-4">Please select the type of report you would like to download:</p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            setShowDownloadModal(false);
                                            downloadPPT(false, 'limited');
                                          }}
                                          className="flex-1 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
                                        >
                                          Download
                                        </button>
                                        <button
                                          onClick={() => {
                                            const selectedOptionElement = document.querySelector('input[name="tableRows"]:checked');
                                            const selectedOption = selectedOptionElement ? (selectedOptionElement as HTMLInputElement).value : 'limited';
                                            setEmailData(prev => ({
                                              ...prev,
                                              reportType: 'complete',
                                              tableOption: selectedOption
                                            }));
                                            setShowEmailModal(true);
                                          }}
                                          className="flex-1 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors"
                                        >
                                          Send via Email
                                        </button>
                                      </div>

                                      <div className="border-t border-gray-200 pt-4 mb-4">
                                        <p className="font-bold mb-2">Include table data in report:</p>

                                        <div className="space-y-2 mb-4">
                                          <div className="flex items-center">
                                            <input
                                              type="radio"
                                              id="limitedRows"
                                              name="tableRows"
                                              value="limited"
                                              defaultChecked
                                              className="mr-2"
                                            />
                                            <label htmlFor="limitedRows">First 20 rows only</label>
                                          </div>

                                          <div className="flex items-center">
                                            <input
                                              type="radio"
                                              id="allRows"
                                              name="tableRows"
                                              value="all"
                                              className="mr-2"
                                            />
                                            <label htmlFor="allRows">All table rows</label>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => {
                                              const selectedOptionElement = document.querySelector('input[name="tableRows"]:checked');
                                              const selectedOption = selectedOptionElement ? (selectedOptionElement as HTMLInputElement).value : 'limited';
                                              setShowDownloadModal(false);
                                              downloadPPT(true, selectedOption);
                                            }}
                                            className="flex-1 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
                                          >
                                            Download
                                          </button>
                                          <button
                                            onClick={() => {
                                              const selectedOptionElement = document.querySelector('input[name="tableRows"]:checked');
                                              const selectedOption = selectedOptionElement ? (selectedOptionElement as HTMLInputElement).value : 'limited';
                                              setEmailData(prev => ({
                                                ...prev,
                                                reportType: 'complete',
                                                tableOption: selectedOption
                                              }));
                                              setShowEmailModal(true);
                                            }}
                                            className="flex-1 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors"
                                          >
                                            Send via Email
                                          </button>
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => setShowDownloadModal(false)}
                                        className="w-full py-2 bg-gray-200 text-gray-800 rounded border border-gray-300"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Email Modal */}
                                {showEmailModal && (
                                  <div
                                    className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center"
                                    style={{ zIndex: 9999 }}
                                  >
                                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full mx-4">
                                      <h3 className="text-xl font-bold text-green-700 mb-4">Send Report via Email</h3>

                                      <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                                        <p className="text-sm text-blue-800">
                                          <strong>Report Type:</strong> {emailData.reportType === 'charts-only' ? 'Charts Only' : 'Complete Report'}
                                          {emailData.reportType === 'complete' && (
                                            <><br /><strong>Table Data:</strong> {emailData.tableOption === 'all' ? 'All rows' : 'First 20 rows only'}</>
                                          )}
                                        </p>
                                      </div>

                                      <form className="space-y-4">
                                        <div>
                                          <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                                            Recipient Email Address *
                                          </label>
                                          <input
                                            type="email"
                                            id="recipientEmail"
                                            value={emailData.email}
                                            onChange={(e) => setEmailData(prev => ({ ...prev, email: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            placeholder="recipient@example.com"
                                            required
                                          />
                                        </div>

                                        <div>
                                          <label htmlFor="emailSubject" className="block text-sm font-medium text-gray-700 mb-1">
                                            Subject
                                          </label>
                                          <input
                                            type="text"
                                            id="emailSubject"
                                            value={emailData.subject}
                                            onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            placeholder="Data Analysis Report"
                                          />
                                        </div>

                                        <div>
                                          <label htmlFor="emailMessage" className="block text-sm font-medium text-gray-700 mb-1">
                                            Additional Message (Optional)
                                          </label>
                                          <textarea
                                            id="emailMessage"
                                            value={emailData.message}
                                            onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            placeholder="Enter any additional message..."
                                          />
                                        </div>

                                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                                          <div className="flex">
                                            <div className="flex-shrink-0">
                                              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                              </svg>
                                            </div>
                                            <div className="ml-3">
                                              <p className="text-sm text-yellow-700">
                                                This will open your default email client. The report file will need to be manually attached.
                                              </p>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!emailData.email) {
                                                toast.error('Please enter a recipient email address');
                                                return;
                                              }
                                              const includeTable = emailData.reportType === 'complete';
                                              const tableOption = emailData.tableOption || 'limited';
                                              sendViaEmail(includeTable, tableOption);
                                            }}
                                            className="flex-1 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors"
                                          >
                                            Send Email
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setShowEmailModal(false);
                                              setEmailData({ email: '', subject: '', message: '', tableOption: 'limited', reportType: '' });
                                            }}
                                            className="flex-1 py-2 bg-gray-200 text-gray-800 rounded border border-gray-300 hover:bg-gray-300 transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </form>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {/* Charts grid compact */}
                              <div id="modal-charts-grid" className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {runResult.charts && runResult.charts.map((chart: ChartData, index: number) => {
                                  switch (chart.chart_type) {
                                    case 'pie':
                                      return (
                                        <div key={`pie-${index}`} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
                                          <h5 className="text-sm font-semibold text-center text-gray-800 mb-3">Pie Chart</h5>
                                          <div style={{ height: '350px', position: 'relative' }}>
                                            <Pie data={getPieData(chart)} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } } }} />
                                          </div>
                                          {chart.insight && chart.insight.length > 0 && (<div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-gray-600 border-l-4 border-blue-400"><p className="font-semibold mb-1">Insights:</p><ul className="list-disc list-inside">{chart.insight.map((ins, i) => <li key={i}>{ins}</li>)}</ul></div>)}
                                        </div>
                                      );
                                    case 'bar':
                                      return (
                                        <div key={`bar-${index}`} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
                                          <h5 className="text-sm font-semibold text-center text-gray-800 mb-3">Bar Chart</h5>
                                          <div style={{ height: '350px', position: 'relative' }}>
                                            <Bar data={getChartData(chart, 'bar')} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } }, scales: { y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: '#f0f0f0' } }, x: { ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true }, grid: { display: false } } } }} />
                                          </div>
                                          {chart.insight && chart.insight.length > 0 && (<div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-gray-600 border-l-4 border-blue-400"><p className="font-semibold mb-1">Insights:</p><ul className="list-disc list-inside">{chart.insight.map((ins, i) => <li key={i}>{ins}</li>)}</ul></div>)}
                                        </div>
                                      );
                                    case 'line':
                                      return (
                                        <div key={`line-${index}`} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
                                          <h5 className="text-sm font-semibold text-center text-gray-800 mb-3">Line Chart</h5>
                                          <div style={{ height: '350px', position: 'relative' }}>
                                            <Line data={getChartData(chart, 'line')} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } }, scales: { y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: '#f0f0f0' } }, x: { ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true }, grid: { display: false } } } }} />
                                          </div>
                                          {chart.insight && chart.insight.length > 0 && (<div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-gray-600 border-l-4 border-blue-400"><p className="font-semibold mb-1">Insights:</p><ul className="list-disc list-inside">{chart.insight.map((ins, i) => <li key={i}>{ins}</li>)}</ul></div>)}
                                        </div>
                                      );
                                    default:
                                      return null;
                                  }
                                })}
                              </div>
                            </>
                          ) : (
                            // ✅ Empty state
                            <div className="flex flex-col items-center justify-center py-16 text-black-400">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-black-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              <p className="text-sm font-medium text-black-500">No charts found</p>
                              <p className="text-xs mt-1 text-black-400">This prompt did not return any chart data.</p>
                            </div>
                          )}
                        </div>

                      )}

                  </div>
                </div>
              )}

            </div>
          </div>
        )}


        {activeTab === "master" && (
          <ExcelTableComponent boardId={boardId} />
        )}




        {/* {isUploadModalOpenMaster && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium mb-4">Upload Dataset</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Table Name
                </label>
                <input
                  type="text"
                  name="tableNameMaster"
                  value={tableNameMaster}
                  onChange={(e) => setTableNameMaster(e.target.value)}
                  required
                  className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedFileMaster(e.target.files[0]);
                    } else {
                      setSelectedFileMaster(null);
                    }
                  }}
                  className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setUploadModalOpenMaster(false);
                    setTableNameMaster(''); 
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFileMaster || !tableNameMaster}
                  className={`px-4 py-2 rounded-md text-sm font-medium text-white ${!selectedFileMaster || !tableNameMaster ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        )} */}



        {/* Prompts Modal (Second Modal) */}
        {showPromptsModal && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-30 z-[70]"
              onClick={handleClosePromptsModal}
            />
            {/* Right-side drawer */}
            <div className="fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-[80] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="font-semibold text-sm text-gray-800">{t('runPrompt.viewPrompts')}</span>
                <button
                  onClick={handleClosePromptsModal}
                  className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Search */}
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t('prompts.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-3 pr-7 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Prompt list */}
              <div className="flex-1 overflow-y-auto px-3 py-2" style={{scrollbarWidth:'thin', scrollbarColor:'#93c5fd #f1f1f1'}}>
                {promptsLoading ? (
                  <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : error ? (
                  <p className="text-xs text-red-500 p-2">{error}</p>
                ) : filteredPrompts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-500">
                    {searchTerm ? t('prompts.noPromptsFound', { term: searchTerm }) : t('prompts.noPromptsBoard')}
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="block mx-auto mt-2 text-blue-500 underline">{t('runPrompt.clearSearch')}</button>}
                  </div>
                ) : (
                  <>
                    {searchTerm && (
                      <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
                        <span>Found {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''}</span>
                        <button onClick={() => setSearchTerm('')} className="text-blue-500 underline">{t('runPrompt.clear')}</button>
                      </div>
                    )}
                    {filteredPrompts.map((prompt, index) => {
                      const gIds = generatedPromptIds;
                      const arr = filteredPrompts;
                      const isGenerated = gIds.has(String(prompt.id));
                      const gCount = arr.slice(0, index).filter(p => gIds.has(String(p.id))).length + 1;
                      const nCount = arr.slice(0, index).filter(p => !gIds.has(String(p.id))).length + 1;
                      const label = isGenerated ? `G${gCount}` : `${nCount}`;
                      const outputType = promptOutputTypes[prompt.id];
                      return (
                        <div
                          key={prompt.id || index}
                          onClick={() => handlePromptClick(prompt)}
                          className={`mb-2 p-3 bg-white border rounded-lg cursor-pointer hover:shadow-sm transition-all ${isGenerated ? 'border-blue-300 hover:border-blue-500' : 'border-gray-200 hover:border-blue-400'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-blue-600">{label}.</span>
                            {outputType && (
                              <div className="flex gap-1">
                                {outputType.includes('C') && (
                                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center border border-purple-300" title="Charts">C</span>
                                )}
                                {outputType.includes('T') && (
                                  <span className="w-5 h-5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold flex items-center justify-center border border-green-300" title="Table">T</span>
                                )}
                                {outputType.includes('M') && (
                                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center border border-blue-300" title="Message">M</span>
                                )}
                              </div>
                            )}
                          </div>
                          {prompt.prompt_title && <p className="text-xs font-medium text-gray-700 mb-0.5">{translatedTitles[prompt.id] || prompt.prompt_title}</p>}
                          <p className="text-xs text-gray-500 line-clamp-2">{translatedTexts[prompt.id] || prompt.prompt_text}</p>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Generate Prompt Modal */}
        {showGeneratePromptModal && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-30 z-[70]"
              onClick={() => { setShowGeneratePromptModal(false); setGenerateSearchTerm(''); }}
            />
            <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-[80] flex flex-col" style={{ width: '420px' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-800">Generate Prompt</span>
                  {generateSourceName && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full">
                      {generateSourceName}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setShowGeneratePromptModal(false); setGenerateSearchTerm(''); }}
                  className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Search */}
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search suggestions..."
                    value={generateSearchTerm}
                    onChange={(e) => setGenerateSearchTerm(e.target.value)}
                    className="w-full pl-3 pr-7 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {generateSearchTerm && (
                    <button
                      onClick={() => setGenerateSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Suggestions list */}
              <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'auto', scrollbarColor: '#93c5fd #f1f1f1' }}>
                {generateLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-gray-500">Generating prompt suggestions...</p>
                  </div>
                ) : generateError ? (
                  <p className="text-xs text-red-500 p-2">{generateError}</p>
                ) : filteredGeneratedSuggestions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-500">
                    {generateSearchTerm
                      ? `No suggestions found for "${generateSearchTerm}"`
                      : generatedSuggestions.length === 0
                      ? 'No suggestions generated.'
                      : 'No results.'}
                    {generateSearchTerm && (
                      <button onClick={() => setGenerateSearchTerm('')} className="block mx-auto mt-2 text-blue-500 underline">Clear search</button>
                    )}
                  </div>
                ) : (
                  <>
                    {generateSearchTerm && (
                      <div className="flex justify-between items-center mb-2 text-xs text-gray-500">
                        <span>Found {filteredGeneratedSuggestions.length} suggestion{filteredGeneratedSuggestions.length !== 1 ? 's' : ''}</span>
                        <button onClick={() => setGenerateSearchTerm('')} className="text-blue-500 underline">Clear</button>
                      </div>
                    )}
                    {filteredGeneratedSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setNewPromptName(suggestion.prompt_text);
                          setShowGeneratePromptModal(false);
                          setGenerateSearchTerm('');
                        }}
                        className="mb-2 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold text-blue-600">{index + 1}.</span>
                        </div>
                        <p className="text-xs text-gray-800 leading-relaxed">{suggestion.prompt_text}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer hint */}
              {!generateLoading && filteredGeneratedSuggestions.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                  <p className="text-[10px] text-gray-400 text-center">Click a suggestion to use it as your prompt</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "timeline" && (
          <TimelineSettings boardId={boardId ?? ""} />
        )}

        {/* {activeTab === "parameters" && (
          <ParameterSettings boardId={boardId ?? ""} />
        )} */}

   

       {activeTab === "parameter" && (
  <ManageParameterSetting 
    boardId={boardId ?? ""} 
    dataSources={dataSources}  
    onFilterToggle={fetchParamFilterStatuses}  // ← add this
  />
)}
        

        {activeTab === "tally" && (
          <TallySetting />
        )}

        {activeTab === "kpi" && (
          <KpiUpdates />
        )}

        {activeTab === "report" && (
          <ReportComponent />
        )}

      </div>
    </div >
  );

}




