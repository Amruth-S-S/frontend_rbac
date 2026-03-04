

// container with data sources and info object




'use client';

import { useState, useEffect, SetStateAction, useRef, ReactNode, useCallback } from "react";
import PptxGenJS from "pptxgenjs";
import { useSearchParams } from "next/navigation";
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
import { FiSave } from "react-icons/fi";
import { toast } from "react-toastify";
import styles from "../CXO/CXO.module.css";
import ExcelTableComponent from "../components/ExcelTableComponent";
import TimelineSettings from "../components/TimelineSettings";
import ParameterSettings from "../components/ParameterSettings";
import { usePathname } from 'next/navigation';
import TallySetting from "../components/TallySetting";

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
  chart_type: string;
  data_format: ChartDataFormat;
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const boardId = searchParams.get("board_id");
  // type Prompt = {
  //   id: string;
  //   prompt_text: string;
  //   user_name: string;
  // };
  const [promptOutputTypes, setPromptOutputTypes] = useState<Record<string, 'C' | 'T' | 'CT'>>({});
  const [isDropdownOpenn, setIsDropdownOpenn] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
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
  const [isLoading, setIsLoading] = useState(false);
  const [view,] = useState("manage-tables");
  const [isRunClicked, setIsRunClicked] = useState(false);
  const [hasReprompted, setHasReprompted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);


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

  


const handleDeleteDataSource = async () => {
  if (!deleteDataSourceConfirm.source) return;
  if (typeof window === 'undefined') return;
  let userId: string | null = null;
  const currentUserData = sessionStorage.getItem("currentUserData");
  if (currentUserData) {
    try {
      const parsed = JSON.parse(currentUserData);
      userId = String(parsed.userId);
    } catch (e) { }
  }
  if (!userId) { alert("User session not found."); return; }

  setIsDeletingDataSource(true);
  try {
    const response = await fetch(
      `${API_BASE_URL}/main-boards/boards/data-sources/${deleteDataSourceConfirm.source.id}?user_id=${parseInt(userId, 10)}`,
      {
        method: "DELETE",
        headers: { accept: "application/json", "X-API-Key": EXCEL_API_KEY },
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to delete");

    toast.success(`Data source deleted! ${data.remaining_sources} remaining.`);
    fetchDataSources();
    setDeleteDataSourceConfirm({ isOpen: false, source: null });
  } catch (error: any) {
    toast.error(`Failed: ${error.message}`);
  } finally {
    setIsDeletingDataSource(false);
  }
};


 const handleAddPgTableAsDataSource = async () => {
  if (!selectedPgTable) return;
  if (typeof window === 'undefined') return;
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
      alert("User session not found. Please log in again.");
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
  if (typeof window === 'undefined') return;
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
      alert('Please select both date and files');
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
      console.log('Upload success:', result);

      // Handle success
      alert('Files uploaded successfully!');
      handleCloseUploadModal();

      // Optionally refresh your data table
      // fetchTableData();

    } catch (error) {
      console.error('Upload error:', error);
      alert('An unknown error occurred. Please try again later.');
    } finally {
      setIsUploading(false);
    }
  };

const handleViewTables = async () => {
  if (typeof window === 'undefined') return;
  let userId: string | null = null;
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
      alert("User session not found. Please log in again.");
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
      console.log("PG Tables API response:", data);
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

  const handleImportPrompts = async () => {
    if (!importFile) {
      toast.error("Please select a file to import");
      return;
    }

    if (!boardId) {
      toast.error("Board ID is missing");
      return;
    }

    setIsImporting(true);

    try {
      const fileContent = await importFile.text();
      let promptsToImport: { prompt_text: string; prompt_title?: string }[] = [];

      // Parse based on file type
      if (importFile.name.endsWith('.csv')) {
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
 const handleDirectApprove = async (type: 'table' | 'file', id: string, tableId?: string) => {
  if (typeof window === 'undefined') return;
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
        alert("User session not found. Please log in again.");
        return;
      }

      if (type === 'table') {
        // ══════════════════════════════════════════════════════════════
        // STEP 1: Add CSV as Data Source FIRST (for info-objects)
        // ══════════════════════════════════════════════════════════════
        const tableRow = rows.find(r => r.id === id);
        if (!tableRow) {
          toast.error("Table not found");
          return;
        }

        // Show loading toast
        const loadingToast = toast.loading("Adding CSV as data source...");

        try {
          // Call add-csv endpoint
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
          console.log("CSV added successfully:", csvResult);

          // Update loading toast
          toast.update(loadingToast, {
            render: "CSV added! Now approving...",
            type: "info",
            isLoading: true
          });

          // ══════════════════════════════════════════════════════════════
          // STEP 2: Approve the table
          // ══════════════════════════════════════════════════════════════
          endpoint = `${API_BASE_URL}/main-boards/boards/data-management-table/status/approve/${id}?new_approval_status=true`;

          const approveResponse = await fetch(endpoint, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": EXCEL_API_KEY
            }
          });

          if (!approveResponse.ok) {
            const errorData = await approveResponse.json();
            toast.dismiss(loadingToast);
            toast.error(`Failed to approve: ${errorData.message || "Unknown error"}`);
            return;
          }

          // ══════════════════════════════════════════════════════════════
          // STEP 3: Update UI
          // ══════════════════════════════════════════════════════════════
          setRows((prevRows) =>
            prevRows.map((row) =>
              row.id === id ? { ...row, approval_status: 'approved' } : row
            )
          );

          // Refresh data sources to show the new CSV
          await fetchDataSources();

          toast.dismiss(loadingToast);
          toast.success(
            `✅ Info-Object approved and added to Slot ${csvResult.slot_number}/${csvResult.total_slots}!`,
            { autoClose: 4000 }
          );

        } catch (error) {
          toast.dismiss(loadingToast);
          console.error("Error in approval process:", error);
          toast.error("An error occurred during approval");
        }

      } else {
        // ══════════════════════════════════════════════════════════════
        // File approval (existing logic - unchanged)
        // ══════════════════════════════════════════════════════════════
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

        // Update file status in UI
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
      }
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("An error occurred while approving");
    }
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
    try {
      const pptBlob = await generatePPTBlob(includeTable, tableOption);

      const formData = new FormData();
      formData.append('file', pptBlob, 'DataAnalysisReport.pptx');
      formData.append('email', emailData.email);
      formData.append('user_id', '0');
      formData.append('report_type', includeTable ? 'complete' : 'standard');
      formData.append('file_name', 'DataAnalysisReport.pptx');
      formData.append('subject', emailData.subject || 'Your GBusiness AI Report');
      formData.append('message', emailData.message || 'Please find your personalized GBusiness AI report attached. Thank you for using our services!');
      formData.append('include_charts', 'true');
      formData.append('include_summary', 'true');

      const response = await fetch('http://localhost:8002/client-users/generate-and-send-ppt', {
        method: 'POST',
        headers: {
          "X-API-Key": "xxAJf365FZZidPt496lk9M2XDbvQCMKevOSuBgx2k6BAjp3ALe4vLTjXtcmgatoQtvsSLED3lx7zEgyHcohd1Wa2iJWTlukzQTuauvTbGYjSgMtFq5AUQLuAcMW44mp",
        },
        body: formData,
      });

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
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

        // Special handling for email quota errors
        if (errorDetails.includes('OverQuota') || errorDetails.includes('out of storage space')) {
          errorDetails = `The recipient's email inbox is full. Please ask them to free up space or use a different email address.`;
        }

        throw new Error(errorDetails);
      }

      alert('Email sent successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      const errorMessage = error instanceof Error ?
        error.message :
        typeof error === 'object' ?
          JSON.stringify(error, null, 2) :
          String(error);

      // User-friendly error messages
      let displayMessage = errorMessage;
      if (errorMessage.includes('out of storage space')) {
        displayMessage = `The recipient's email inbox is full. Please ask them to free up space or use a different email address.`;
      } else if (errorMessage.includes('422')) {
        displayMessage = `Invalid request parameters: ${errorMessage}`;
      }

      alert(`Failed to send email: ${displayMessage}`);
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
      console.log('Comments API response:', JSON.stringify(data, null, 2));

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
    console.log("Editing dropdown row at index:", index);
    // Example: Enable edit mode for the row or open a modal
  };

  // Mock functions for UI demonstration - these will be replaced with backend calls
  const handleAddItem = () => {
    // This will be replaced with your backend implementation
    setNewItemMode(false);
  };

  const handleEditItem = (id: number) => {
    // This will be replaced with your backend implementation
    console.log(`Edit item with id: ${id}`);
  };

  const handleSaveItem = (id: number) => {
    // This will be replaced with your backend implementation
    console.log(`Save item with id: ${id}`);
  };

  const handleDeleteItem = (id: number) => {
    // This will be replaced with your backend implementation
    console.log(`Delete item with id: ${id}`);
  };





  const getPieData = (chartData: ChartData) => {
    if (!chartData || !chartData.data_format) {
      console.log("No chart data found.");
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [] }],
      };
    }

    const { labels, values } = chartData.data_format;

    return {
      labels,
      datasets: [
        {
          data: values as number[], // Ensure values is treated as an array of numbers
          backgroundColor: labels.map(() => getRandomColor()),
        },
      ],
    };
  };

  const getChartData = (chartData: ChartData, type: "bar" | "line") => {
    if (!chartData || !chartData.data_format) {
      console.log("No chart data found.");
      return {
        labels: [],
        datasets: [],
      };
    }

    const { labels, categories, values } = chartData.data_format;

    return {
      labels,
      datasets: (categories || []).map((category, index) => ({
        label: category,
        data: (values as number[][]).map((value) => value[index]), // Ensure values is treated as a 2D array
        backgroundColor: getRandomColor(),
      })),
    };
  };


  const getRandomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return hsl(hue, 70, 60);
  };

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
      alert("No data to download.");
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
  const downloadPPT = (includeTableData = true, tableRowOption = 'limited') => {
    console.log(`Downloading PPT with includeTableData=${includeTableData}, tableOption=${tableRowOption}`);

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

      // Add ONLY the current prompt that generated this result
      // Option 1: If you have a currentPrompt variable that contains the executed prompt
      if (typeof currentPromptId !== 'undefined' && currentPromptId) {
        const cleanedPrompt = cleanPromptText(currentPromptId);
        if (cleanedPrompt && cleanedPrompt.trim().length > 0) {
          addTextAcrossSlides(cleanedPrompt, "Prompt Text");
        }
      }
      // Option 2: If you need to get it from runResult or another source
      else if (typeof selectedPrompt !== 'undefined' && selectedPrompt) {
        const cleanedPrompt = cleanPromptText(selectedPrompt);
        if (cleanedPrompt && cleanedPrompt.trim().length > 0) {
          addTextAcrossSlides(cleanedPrompt, "Prompt Text");
        }
      }
      // Option 3: If you store the current prompt in a different variable
      else if (typeof selectedPrompt !== 'undefined' && selectedPrompt) {
        const cleanedPrompt = cleanPromptText(selectedPrompt);
        if (cleanedPrompt && cleanedPrompt.trim().length > 0) {
          addTextAcrossSlides(cleanedPrompt, "Prompt Text");
        }
      }
      // Option 4: Get the most recent prompt from the prompts array (if it's ordered by execution time)
      else if (typeof prompts !== 'undefined' && prompts.length > 0) {
        // Get the last prompt (most recently executed)
        const mostRecentPrompt = prompts[prompts.length - 1];
        const cleanedPrompt = cleanPromptText(mostRecentPrompt.prompt_text);
        if (cleanedPrompt && cleanedPrompt.trim().length > 0) {
          addTextAcrossSlides(cleanedPrompt, "Prompt Text");
        }
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
            console.log(`Using ALL ${runResult.table.data.length} rows from data`);
            dataToDisplay = runResult.table.data;
          } else {
            // Use limited data (default 20 rows)
            const limitRows = Math.min(20, runResult.table.data.length);
            console.log(`Using LIMITED ${limitRows} rows from data`);
            dataToDisplay = runResult.table.data.slice(0, limitRows);
          }

          // Check if we need to use horizontal column splitting
          const COLUMNS_PER_SLIDE_THRESHOLD = 8; // Adjust this threshold as needed

          if (columns.length > COLUMNS_PER_SLIDE_THRESHOLD) {
            // We have many columns, use horizontal splitting approach
            console.log(`Table has ${columns.length} columns, using horizontal splitting`);

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
        const chartContainers = document.querySelectorAll('.chart-container');
        runResult.charts.forEach((chart, index) => {
          let slide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });

          // Add chart title
          slide.addText(chart.chart_type.toUpperCase() + " Chart", {
            x: 0.5,
            y: 0.7,
            fontSize: 20,
            fontFace: "Arial",
            color: THEME.primary,
            bold: true,
            align: "left"
          });

          // Make chart image smaller to leave room for insights
          if (chartContainers[index]) {
            const canvas = chartContainers[index].querySelector('canvas');
            if (canvas) {
              let imgData = canvas.toDataURL("image/png", 1.0);
              // Position chart on the left side, reduce width
              slide.addImage({ data: imgData, x: 0.5, y: 1.3, w: 4.5, h: 3.5 });
            }
          }

          // Add insights beside the chart (on the right side)
          if (chart.insight && chart.insight.length) {
            // Add title for insights section
            slide.addText("Key Insights:", {
              x: 5.5, // Position to the right of chart
              y: 1.3,
              fontSize: 14,
              fontFace: "Arial",
              color: THEME.primary,
              bold: true,
            });

            // Calculate maximum insights that can fit
            const maxInsightsOnSlide = Math.min(8, chart.insight.length);

            // Add insights as a group with shorter height
            for (let i = 0; i < maxInsightsOnSlide; i++) {
              // Truncate long insights to prevent overflow
              let insightText = chart.insight[i];
              if (insightText.length > 80) {
                insightText = insightText.substring(0, 77) + '...';
              }

              slide.addText(insightText, {
                x: 5.5,
                y: 1.7 + (i * 0.4), // More compact spacing
                w: 3.5, // Fixed width to prevent overflow
                h: 0.35, // Fixed height
                fontSize: 11, // Smaller font size
                fontFace: "Arial",
                color: THEME.text,
                bullet: { type: "bullet" },
                wrap: true, // Enable text wrapping
                breakLine: true // Break long lines
              });
            }

            // If there are too many insights to fit, add pagination
            if (chart.insight.length > maxInsightsOnSlide) {
              slide.addText(`+ ${chart.insight.length - maxInsightsOnSlide} more insights`, {
                x: 5.5,
                y: 1.7 + (maxInsightsOnSlide * 0.4),
                fontSize: 10,
                fontFace: "Arial",
                italic: true,
                color: THEME.secondary,
              });

              // Create additional slides for remaining insights
              const remainingInsights = chart.insight.slice(maxInsightsOnSlide);
              const insightsPerAdditionalSlide = 12; // More insights on dedicated slides
              const additionalSlidesNeeded = Math.ceil(remainingInsights.length / insightsPerAdditionalSlide);

              for (let slideIdx = 0; slideIdx < additionalSlidesNeeded; slideIdx++) {
                const insightStartIdx = slideIdx * insightsPerAdditionalSlide;
                const insightEndIdx = Math.min(insightStartIdx + insightsPerAdditionalSlide, remainingInsights.length);
                const currentInsights = remainingInsights.slice(insightStartIdx, insightEndIdx);

                const additionalSlide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });

                additionalSlide.addText(`${chart.chart_type.toUpperCase()} Chart - Additional Insights (${slideIdx + 1}/${additionalSlidesNeeded})`, {
                  x: 0.5,
                  y: 0.7,
                  fontSize: 20,
                  fontFace: "Arial",
                  color: THEME.primary,
                  bold: true,
                  align: "left"
                });

                // Add all remaining insights on additional slides
                currentInsights.forEach((insight, idx) => {
                  additionalSlide.addText(insight, {
                    x: 0.5,
                    y: 1.3 + (idx * 0.4),
                    w: 8.5,
                    h: 0.35,
                    fontSize: 12,
                    fontFace: "Arial",
                    color: THEME.text,
                    bullet: { type: "bullet" },
                    wrap: true,
                    breakLine: true
                  });
                });
              }
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

      // Save the file
      ppt.writeFile({ fileName: fileName });
    } catch (error) {
      console.error("An error occurred:", error);
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

      console.log("Fetched Documentation:", response.data);
      // API returns { board_id, board_name, sources: [...] }
      setData(response.data.sources || []);
    } catch (error) {
      console.error("Error fetching AI documentation:", error);
    } finally {
      setLoading(false);
    }
  }, [boardId, user?.id]);

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

      console.log("Fetched All Documentation:", response.data);

      const filteredData = response.data.filter(
        (item: { board_id: string }) => String(item.board_id) === String(boardId)
      );

      console.log("Filtered Documentation:", filteredData);
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
      alert("Error: Missing required parameters.");
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

      console.log("PUT payload (filtered):", payload);

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
        alert(`Error: ${JSON.stringify(errorData)}`);
        return;
      }

      const result = await response.json();
      console.log("Update successful:", result);

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
      alert("A network error occurred. Check the console for details.");
    }
  };

  const handleSaveClicks = async (id: string, boardId: string | null) => {
    if (!id || !boardId) {
      console.error("Missing parameters:", { id, boardId });
      alert("Error: Missing required parameters.");
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

      console.log("PUT payload:", payload);

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
        alert(`Error: ${JSON.stringify(errorData)}`);
        return;
      }

      const result = await response.json();
      console.log("Update successful:", result);

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
      alert("A network error occurred. Check the console for details.");
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
        console.log(`API Response Time: ${(endTime - startTime).toFixed(2)} ms`);

        if (!response.ok) {
          throw new Error("Failed to fetch prompts");
        }

        const data: Prompt[] = await response.json();
        console.log("Fetched prompts data:", data);

        setPrompts(data);
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
      alert("Please enter a valid prompt.");
      setIsLoading(false);
      return;
    }

    if (!boardId) {
      alert("Board ID is required to run the prompt.");
      setIsLoading(false);
      return;
    }

    try {
      const url = new URL(`${API_BASE_URL}/main-boards/boards/prompts/run_prompt_v3?`);
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

        // ✅ NEW: Record output type for badge display
        if (promptId) {
          const hasCharts = (response.data.charts ?? []).length > 0;
          const hasTable = response.data.table?.columns?.length > 0;
          const outputType = hasCharts && hasTable ? 'CT' : hasCharts ? 'C' : hasTable ? 'T' : null;
          if (outputType) {
            setPromptOutputTypes(prev => ({ ...prev, [promptId]: outputType }));
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(`Error: ${error.response?.data?.message || error.message}`);
      } else {
        alert("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };


  const handlePlayClick = async (prompt: Prompt) => {
    setLoadingPromptPlay(prompt.id);
    const promptText = prompt.prompt_text;
    setSelectedPrompt(promptText);

    try {
      await handleRunnPrompt(promptText, prompt.id); // ✅ pass prompt.id
      setIsResultModalOpen(true);

      // ✅ NEW: Record output type for this prompt
      setRunResult(prev => {
        if (prev) {
          const hasCharts = (prev.charts ?? []).length > 0;
          const hasTable = prev.table?.columns?.length > 0;
          const outputType = hasCharts && hasTable ? 'CT' : hasCharts ? 'C' : hasTable ? 'T' : null;
          if (outputType) {
            setPromptOutputTypes(prevTypes => ({ ...prevTypes, [prompt.id]: outputType }));
          }
        }
        return prev;
      });

      if ((runResult?.charts ?? []).length > 0) {
        setActiveTab('charts');
      } else if (runResult?.table && runResult.table.columns?.length > 0) {
        setActiveTab('table');
      } else {
        setActiveTab('message');
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

    // Validate input
    if (!newPromptName?.trim()) {
      console.error("Error: Prompt cannot be empty");
      alert("Please enter a valid prompt.");
      setIsLoading(false);
      return;
    }

    if (!boardId) {
      console.error("Error: Board ID is missing");
      alert("Board ID is required to run the prompt.");
      setIsLoading(false);
      return;
    }

    try {
      const url = new URL(
        `${API_BASE_URL}/main-boards/boards/prompts/run_prompt_v3?`
      );

      // Append parameters
      url.searchParams.append("input_text", newPromptName.trim());
      url.searchParams.append("board_id", boardId);
      url.searchParams.append("user_name", "");
      url.searchParams.append("use_cache", "true");

      console.log("Making request to:", url.href);

      // Make the POST request with Axios
      const response = await axios.post(
        url.href,
        {
          input_text: newPromptName.trim(),
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
        console.log("Prompt run successfully:", response.data);
        setRunResult(response.data); // Set the result to display it

        const hasCharts = (response.data.charts ?? []).length > 0;
        const hasTable = response.data.table?.columns?.length > 0;
        const hasMessage = response.data.message?.length > 0;
        const outputType = hasCharts && hasTable ? 'CT' : hasCharts ? 'C' : hasTable ? 'T' : null;
        // Determine the default active tab
        if (hasCharts && hasTable) {
          setActiveTab("charts"); // If both charts and table exist, default to charts
        } else if (hasTable) {
          setActiveTab("table");
        } else if (hasCharts) {
          setActiveTab("charts");
        } else if (hasMessage) {
          setActiveTab("message"); // If neither charts nor table exist, show message tab
        }

        console.log("Active Tab:", activeTab);

        // Check if the user asked for charts
        const chartKeywords = ["chart", "visualization"];
        const responseDetails = response.data.detail?.toLowerCase() || "";
        console.log("Response Details:", responseDetails); // Debugging

        // Determine if charts are needed based on prompt or response details
        const shouldShowCharts =
          chartKeywords.some((keyword) =>
            newPromptName.toLowerCase().includes(keyword)
          ) ||
          chartKeywords.some((keyword) => responseDetails.includes(keyword));

        console.log("Should Show Charts:", shouldShowCharts); // Debugging
        setShowCharts(shouldShowCharts); // Display the chart if applicable
      } else {
        console.warn("Warning: API returned no data.");
        alert("No data was returned from the server.");
      }
    } catch (error: unknown) {
      // Handle errors based on error type
      if (axios.isAxiosError(error)) {
        console.error("Axios Error:", error.response?.data || error.message);
        alert(
          `Server Error (${error.response?.status || "Unknown"}): ${error.response?.data?.message || error.message || "An error occurred"
          }`
        );
      } else if (error instanceof Error) {
        console.error("Error:", error.message);
        alert(`Error: ${error.message}`);
      } else {
        console.error("Unknown Error:", error);
        alert("An unknown error occurred. Please try again later.");
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

      console.log('API Response:', response.data);

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
        alert(
          `Server Error (${error.response?.status || 'Unknown'}): ${error.response?.data?.message || error.message || 'An error occurred'
          }`
        );
      } else if (error instanceof Error) {
        // Generic JavaScript Error
        console.error('Error:', error.message);
        alert(`Error: ${error.message}`);
      } else {
        // Unknown error type
        console.error('Unknown Error:', error);
        alert('An unknown error occurred. Please try again later.');
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
      alert("Prompt cannot be empty!");
      setIsLoading(false); // Reset loading state
      return;
    }
    // if (newPromptName.length > 255) {
    //   alert("Prompt must be between 1 and 255 characters.");
    //   return;
    // }
    if (!boardId) {
      alert("Error: boardId is missing.");
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
      alert("Error: User name is missing in localStorage. Please log in again.");
      setIsLoading(false); // Reset loading state
      return;
    }

    console.log("Logged-in User:", loggedInUserName);
    console.log("User ID:", loggedInUserId);

    // Prepare request body
    const promptData = {
      board_id: boardId,
      prompt_text: newPromptName.trim(),
      prompt_out: "out_string", // Default value as per the API example
      user_name: loggedInUserName, // Use the logged-in user's name
      created_by: loggedInUserName
    };
    console.log("Prompt Data:", promptData);

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
        alert(`Failed to save prompt: ${errorData.message || "Unknown error"}`);
        setIsLoading(false); // Reset loading state
        return;
      }

      const newPromptData = await response.json();
      console.log("API Response Data:", newPromptData);

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

      // Close modal and reset state
      setIsModalOpen(false);
      setNewPromptName("");
      setEditPromptId(null);

      // Redirect to "Manage Prompts" tab
      setActiveTab("prompts"); // Redirect to the "prompts" tab
    } catch (error) {
      console.error("Network Error:", error);
      alert("Network error: Failed to save the prompt.");
    } finally {
      setIsLoading(false); // Reset loading state after the operation
    }
    // Redirect to Manage Prompts page

  };



  console.log("Board ID:", boardId);
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
    setIsModalOpen(false); // Close the modal
    setActiveTab("prompts"); // Set the active tab to "prompts"
    setRunResult(null); // Clear the result data
    setShowCharts(false); // Reset chart visibility
    setIsRunClicked(false); // Reset to hide the tabs
    // Reset the flag that controls visibility of results

  };



  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (


    <div className="flex-1 overflow-y-auto bg-gray-200 rounded-2xl shadow-lg border border-gray-200 min-h-screen">
      <header className="bg-white p-3 shadow-sm">
        <div className="flex justify-end items-center max-w-screen-xl mx-auto">
          {/* Left-aligned items (empty for now, can add logo or other items later) */}

          {/* Right-aligned dropdown showing current screen */}
          <div className="relative">
            <button
              onClick={toggleDropdown}
              className="flex items-center gap-2 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors border border-gray-200 text-sm"
            >
              <span className="text-sm font-medium">
                {location.pathname === '/Container' ? 'Consultant Role' :
                  location.pathname === '/CXO' ? 'CXO Role' :
                    'Select Screen'}
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
                className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
              >
                <a
                  href="/Dashboard"
                  className={`block px-4 py-2 text-sm ${location.pathname === '/Container' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  Consultant Role
                </a>
                <a
                  href="/CXO"
                  className={`block px-4 py-2 text-sm ${location.pathname === '/CXO' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  CXO Role
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
          <div className="max-w-[1400px] mx-auto px-4 py-4">
            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl shadow-lg p-2 mb-4 border border-gray-200">
              <div className="flex gap-2 p-1 bg-gray-200 rounded-xl overflow-x-auto">
                {[
                  { key: "prompts", label: "Manage Prompts" },
                  { key: "repository", label: "Prompts Repository" },
                  { key: "tables", label: "Manage Tables" },
                  // { key: "tally", label: "Manage ETL" },
                  { key: "documentation", label: "AI Documentation" },
                  // { key: "master", label: "Master Settings" },
                  // { key: "parameters", label: "Parameter Settings" },
                  // { key: "timeline", label: "Timeline Settings" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm whitespace-nowrap ${activeTab === tab.key
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                      }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <b>{tab.label}</b>
                  </button>
                ))}
              </div>

              {/* Mobile dropdown menu */}
              {isMobileMenuOpen && (
                <div className="md:hidden mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                  <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                    {[
                      { key: "prompts", label: "Manage Prompts" },
                      { key: "repository", label: "Prompts Repository" },
                      { key: "tables", label: "Manage Tables" },
                      // { key: "tally", label: "Manage ETL" },
                      { key: "documentation", label: "AI Documentation" },
                      // { key: "master", label: "Master Settings" },
                      // { key: "parameters", label: "Parameter Settings" },
                      // { key: "timeline", label: "Timeline Settings" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        className={`w-full text-left px-4 py-3 rounded-md transition-colors ${activeTab === tab.key
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                          }`}
                        onClick={() => {
                          setActiveTab(tab.key);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{tab.label}</span>
                          {activeTab === tab.key && (
                            <span className="text-blue-500">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>



        {/* Tab Content */}
        {activeTab === "prompts" && (
          <div className="w-full">
            {/* Header with search and button */}
            <div className="w-full bg-white border-b">
              <div className="max-w-[1400px] mx-auto px-4 py-4">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search prompts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full py-2 px-4 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {searchTerm ? (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ) : (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <button
                    className="py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium whitespace-nowrap"
                    onClick={() => setIsModalOpen(true)}
                  >
                    New Prompts +
                  </button>
                  {prompts.length === 0 ? (
                    <label className="py-2 px-4 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer">
                      <input
                        type="file"
                        accept=".txt,.csv"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setImportFile(e.target.files[0]);
                            handleImportPrompts();
                          }
                        }}
                        className="hidden"
                      />
                      {isImporting ? 'Importing...' : 'Import Prompts'}
                    </label>
                  ) : (
                    <button
                      className="py-2 px-4 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm font-medium whitespace-nowrap"
                      onClick={() => setShowExportModal(true)}
                    >
                      Export Prompts
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable content section */}
            <div className="w-full">
              <div className="max-w-[1400px] mx-auto px-4 py-6">
                {!isLoading && filteredPrompts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-fr">
                    {filteredPrompts.map((prompt, index) => {
                      const datasetName = getDatasetName(prompt); // ✅ dataset name
                      const outputType = promptOutputTypes[prompt.id]; // ✅ C/T badge

                      return (
                        <div
                          key={prompt.id}
                          className="prompt-card border rounded-lg shadow-md p-4 bg-white transition-all duration-300 hover:shadow-xl flex flex-col justify-between"
                          style={{ minHeight: '200px', maxWidth: '100%' }}
                        >
                          <p
                            className="text-sm font-semibold mb-3 flex-grow"
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
                            {index + 1}. &quot;{prompt.prompt_text}&quot;
                          </p>

                          <div className="mt-auto">
                            {/* ✅ Dataset name row */}
                            {datasetName && (
                              <div className="mb-2">
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-medium max-w-full"
                                  title={`Dataset: ${datasetName}`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                                    <path d="M3 5v4c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
                                    <path d="M3 9v4c0 1.657 4.03 3 9 3s9-1.343 9-3V9" />
                                    <path d="M3 13v4c0 1.657 4.03 3 9 3s9-1.343 9-3v-4" />
                                  </svg>
                                  <span className="truncate">{datasetName}</span>
                                </span>
                              </div>
                            )}

                            <div className="mb-2 text-xs flex items-center justify-between">
                              <div>
                                <p className="text-gray-600 truncate">
                                  Created By: {prompt.user_name && prompt.user_name !== "undefined" ? prompt.user_name : ""}
                                </p>
                                <p className="text-gray-600">
                                  Updated: {new Date(prompt.updated_at || prompt.created_at).toLocaleDateString()}
                                </p>
                              </div>

                              {/* ✅ C/T output type badge */}
                              {outputType && (
                                <div className="flex gap-1 ml-2 shrink-0">
                                  {(outputType === 'C' || outputType === 'CT') && (
                                    <span
                                      className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center border border-purple-300"
                                      title="This prompt produces Charts"
                                    >
                                      C
                                    </span>
                                  )}
                                  {(outputType === 'T' || outputType === 'CT') && (
                                    <span
                                      className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center border border-green-300"
                                      title="This prompt produces a Table"
                                    >
                                      T
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <hr className="my-2 border-t" />
                            <div className="flex justify-center items-center gap-3 mt-2">
                              <button
                                className="text-gray-700 hover:text-blue-600 transition-colors p-1"
                                onClick={() => handlePlayClick(prompt)}
                                title="Play"
                              >
                                <FaPlay size={14} />
                              </button>
                              <button
                                className="text-gray-700 hover:text-blue-600 transition-colors p-1"
                                onClick={() => handleEditPrompt(prompt)}
                                title="Edit"
                              >
                                <FaPen size={14} />
                              </button>
                              <button
                                className="text-gray-700 hover:text-red-600 transition-colors p-1"
                                onClick={() => handleDeletePrompt(prompt.id)}
                                title="Delete"
                              >
                                <FaTrash size={14} />
                              </button>
                              <button
                                className="text-gray-700 hover:text-blue-600 transition-colors p-1 relative"
                                onClick={() => handleCommentClick(prompt.id)}
                                title="Comments"
                              >
                                <FaComment size={14} />
                                {getCommentCount(prompt.id) > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full h-3.5 w-3.5 flex items-center justify-center leading-none">
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

                {!isLoading && filteredPrompts.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-gray-500 text-base">
                      {searchTerm ? `No prompts found for "${searchTerm}"` : "No prompts available"}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="mt-4 text-blue-500 hover:text-blue-700 text-sm"
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

        {/* Export Modal */}
        {showExportModal && (
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
        )}

        {activeTab === "repository" && (
          <div className="w-full">
            {/* Search bar section */}
            <div className="w-full bg-white border-b">
              <div className="max-w-[1400px] mx-auto px-4 py-4">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search prompts..."
                      value={searchTermRepository}
                      onChange={(e) => setSearchTermRepository(e.target.value)}
                      className="w-full py-2 px-4 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchTermRepository ? (
                      <button
                        onClick={() => setSearchTermRepository("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ) : (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Grid section */}
            <div className="w-full">
              <div className="max-w-[1400px] mx-auto px-4 py-6">
                {!isLoading && filteredRepositoryPrompts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-fr">
                    {filteredRepositoryPrompts.map((prompt, index) => {
                      const datasetName = getDatasetName(prompt); // ✅ resolve dataset name

                      return (
                        <div
                          key={prompt.id}
                          className="prompt-card border rounded-lg shadow-md p-4 bg-white transition-all duration-300 hover:shadow-xl flex flex-col justify-between cursor-pointer"
                          style={{ minHeight: '200px', maxWidth: '100%' }}
                          onClick={() => handlePlayClick(prompt)}
                        >
                          <p
                            className="text-sm font-semibold mb-4 flex-grow"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word'
                            }}
                            title={prompt.prompt_text}
                          >
                            {index + 1}. &quot;{prompt.prompt_text}&quot;
                          </p>

                          {/* Dataset badge */}
                          {/* {datasetName && (
                            <div className="mb-2">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-medium max-w-full"
                                title={`Dataset: ${datasetName}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                                  <path d="M3 5v4c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
                                  <path d="M3 9v4c0 1.657 4.03 3 9 3s9-1.343 9-3V9" />
                                  <path d="M3 13v4c0 1.657 4.03 3 9 3s9-1.343 9-3v-4" />
                                </svg>
                                <span className="truncate">{datasetName}</span>
                              </span>
                            </div>
                          )} */}

                          <hr className="my-2 border-t" />

                          <div className="mt-2 text-xs space-y-1">
                            <p className="opacity-80">
                              Dataset used: {prompt.filename}
                            </p>
                            <p className="opacity-90 truncate">
                              Created By: {prompt.user_name && prompt.user_name !== "undefined" ? prompt.user_name : ""}
                            </p>
                            <p className="opacity-80">
                              Updated: {new Date(prompt.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : !isLoading ? (
                  <div className="text-center py-10">
                    <p className="text-gray-500 text-lg">
                      {searchTermRepository ? `No repository prompts found for "${searchTermRepository}"` : "No repository prompts available"}
                    </p>
                    {searchTermRepository && (
                      <button
                        onClick={() => setSearchTermRepository("")}
                        className="mt-4 text-blue-500 hover:text-blue-700"
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
                    disabled={commentSaving}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 min-w-[60px]"
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
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full h-full max-w-full relative overflow-y-auto">
              <div className="result-modal">
                <div className="result-modal-content">
                  <span
                    className="close-btn absolute top-2 right-2 cursor-pointer text-2xl text-gray-600"
                    onClick={() => {
                      setIsResultModalOpen(false); // Close the modal
                      setActiveTab("prompts"); // Switch back to the "prompts" tab
                    }}


                  >
                    &times;
                  </span>

                  <h3 className="text-xl font-semibold mb-4">Prompt</h3>
                  <textarea
                    value={selectedPrompt || ""} // Display the selected prompt text
                    readOnly
                    rows={7}
                    className="w-full p-2 border border-gray-300 rounded"
                  />

                  <h3 className="text-xl font-semibold mt-6">Run Result</h3>
                  <div className="run-results mt-6">
                    {/* Tab buttons for navigation */}
                    <div className="tabs flex justify-end space-x-2 mb-4">
                      {['message', 'table', 'charts'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => {
                            setActiveTab(tab);
                            setIsResultModalOpen(true); // Open modal only for the active tab
                          }}

                          className={`tab-button px-4 py-2 rounded ${activeTab === tab ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Tab Content */}
                    <div className="tab-content">
                      {activeTab === 'message' && runResult.message && (
                        <div className="message-tab">
                          <p>{runResult.message[0]}</p>
                        </div>
                      )}

                      {activeTab === 'table' && runResult.table?.columns?.length > 0 && (
                        <div className="table-tab">
                          {runResult?.table && runResult.table.columns?.length > 0 ? (
                            <div className="mt-4">

                              {/* Download Excel Button */}
                              <div className="flex justify-end">
                                <button
                                  onClick={downloadExcel}
                                  className="mb-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                  Download as Excel
                                </button>
                              </div>
                              {/* <h4 className="font-medium text-lg">Table Data:</h4> */}
                              <div className="max-h-94 overflow-y-auto border border-gray-300 rounded">
                                <table className="min-w-full table-auto">
                                  <thead>
                                    <tr>
                                      {runResult.table.columns.map((col, idx) => (
                                        <th key={`col-header-${idx}-${col}`} className="p-2 border-b text-left">
                                          {col}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {runResult.table.data.length > 0 ? (
                                      runResult.table.data.map((row, rowIdx) => (
                                        <tr key={rowIdx}>
                                          {row.map((cell, cellIdx) => (
                                            <td key={cellIdx} className="p-2 border-b">
                                              {cell}
                                            </td>
                                          ))}
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan={runResult.table.columns.length}
                                          className="text-center p-2"
                                        >
                                          No data available.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <p>No table data found.</p>
                          )}
                        </div>
                      )}

                      {activeTab === 'charts' && runResult.charts && (
                        <div className="charts-tab">
                          <div className="flex justify-end">
                            <button
                              onClick={() => setShowDownloadModal(true)}
                              className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-md"
                            >
                              Download as PPT
                            </button>
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
                                            alert('Please enter a recipient email address');
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
                                    <div key={`pie-chart-${index}`} className="w-full max-w-[400px] flex-1 chart-container">
                                      <h5 className="text-lg font-semibold text-center">Pie Chart</h5>
                                      <div style={{ height: "400px" }}>
                                        <Pie data={getPieData(chart)}
                                          options={{
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: true, position: "top" } }
                                          }}
                                        />
                                      </div>
                                      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                        <h6 className="text-md font-semibold mb-2">Insights:</h6>
                                        <ul className="list-disc list-inside">
                                          {chart.insight && chart.insight.map((insight, insightIndex) => (
                                            <li key={`pie-insight-${index}-${insightIndex}`} className="text-sm">
                                              {insight}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  );
                                case 'bar':
                                  return (
                                    <div key={`bar-chart-${index}`} className="w-full max-w-[500px] flex-1 chart-container">
                                      <h5 className="text-lg font-semibold text-center">Bar Chart</h5>
                                      <div style={{ height: "400px" }}>
                                        <Bar
                                          data={getChartData(chart, 'bar')}
                                          options={{
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: true, position: "top" } },
                                            scales: { y: { beginAtZero: true } },
                                          }}
                                        />
                                      </div>
                                      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                        <h6 className="text-md font-semibold mb-2">Insights:</h6>
                                        <ul className="list-disc list-inside">
                                          {chart.insight && chart.insight.map((insight, insightIndex) => (
                                            <li key={`bar-insight-${index}-${insightIndex}`} className="text-sm">
                                              {insight}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  );
                                case 'line':
                                  return (
                                    <div key={`line-chart-${index}`} className="w-full max-w-[500px] flex-1 chart-container">
                                      <h5 className="text-lg font-semibold text-center">Line Chart</h5>
                                      <div style={{ height: "400px" }}>
                                        <Line
                                          data={getChartData(chart, 'line')}
                                          options={{
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: true, position: "top" } },
                                            scales: { y: { beginAtZero: true } },
                                          }}
                                        />
                                      </div>
                                      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                        <h6 className="text-md font-semibold mb-2">Insights:</h6>
                                        <ul className="list-disc list-inside">
                                          {chart.insight && chart.insight.map((insight, insightIndex) => (
                                            <li key={`line-insight-${index}-${insightIndex}`} className="text-sm">
                                              {insight}
                                            </li>
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
                        </div>
                      )}



                      {/* Modal */}

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        )}

        {isLoading && <Spinner />}

        {activeTab === "tables" && (
          <div className="p-4">
            {/* Header with buttons */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-700">Data Sources</h2>
                {dataSources.length > 0 && (
                  <>
                    <span className="text-xs text-gray-400 font-normal">
                      ({dataSources.length}/{dataSources[0]?.total_slots || 4} slots used)
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      {Array.from({ length: dataSources[0]?.total_slots || 4 }, (_, i) => {
                        const filled = dataSources.find(s => s.slot_number === i + 1);
                        return (
                          <div
                            key={i}
                            className={`w-6 h-2 rounded-full ${filled ? "bg-blue-500" : "bg-gray-200"}`}
                            title={filled ? `Slot ${i + 1}: ${filled.source_name}` : `Slot ${i + 1}: Empty`}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchDataSources}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-1.5 border border-blue-200 rounded-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                  onClick={handleViewTables}
                >
                  + PG Table
                </button>
                <button
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm"
                  onClick={handleeOpenModal}
                >
                  + New Info-Object
                </button>
              </div>
            </div>

            {/* Unified Table - Shows BOTH approved data sources AND unapproved info-objects */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {dataSourcesLoading ? (
                <div className="flex justify-center items-center py-10">
                  <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Slot</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Source Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Render approved data sources (PG Tables + Approved CSVs) */}
                    {dataSources.map((source) => {
                      const matchedRow = source.source_type === "csv"
                        ? rows.find(r => String(r.id) === String(source.data_management_table_id))
                        : null;
                      const isExpanded = isDropdownOpenn === String(source.id);

                      return (
                        <React.Fragment key={`source-${source.id}`}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                                {source.slot_number}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">{source.source_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate" title={source.description}>
                              {source.description || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${source.source_type === "table_data" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
                                }`}>
                                {source.source_type_display}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                Active
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center items-center gap-2">
                                {source.source_type === "csv" && matchedRow && (
                                  <>
                                    <button
                                      onClick={() => handleEdit(matchedRow)}
                                      className="text-blue-600 hover:text-blue-800 p-1"
                                      title="Edit"
                                    >
                                      <FaPen size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenUploadModal(matchedRow.id)}
                                      className="text-green-600 hover:text-green-800 p-1"
                                      title="Upload File"
                                    >
                                      <FaFileUpload size={14} />
                                    </button>
                                    <button
                                      onClick={() => toggleDropdowns(String(source.id))}
                                      className="text-gray-600 hover:text-gray-800 p-1"
                                      title={isExpanded ? "Collapse" : "View Files"}
                                    >
                                      {isExpanded ? <FaCaretUp size={14} /> : <FaCaretDown size={14} />}
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setDeleteDataSourceConfirm({ isOpen: true, source })}
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Delete"
                                >
                                  <FaTrash size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded files section */}
                          {isExpanded && matchedRow && (
                            <tr>
                              <td colSpan={6} className="px-0 py-0 bg-gray-50">
                                <div className="px-8 py-3">
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Uploaded Files</p>
                                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">File Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Created On</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-600 uppercase">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {matchedRow.files && matchedRow.files.length > 0 ? (
                                        matchedRow.files.map((file) => (
                                          <tr key={file.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-700">{file.filename}</td>
                                            <td className="px-4 py-2 text-gray-500">{new Date(file.created_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-2">{getApprovalBadge(file.approval_status || 'pending')}</td>
                                            <td className="px-4 py-2 text-center">
                                              {(!file.approval_status || file.approval_status === 'pending') && (
                                                <button
                                                  onClick={() => handleDirectApprove('file', file.id, matchedRow.id)}
                                                  className="text-green-600 hover:text-green-800"
                                                  title="Approve File"
                                                >
                                                  <FaCheck size={13} />
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan={4} className="px-4 py-3 text-center text-gray-400 text-xs">
                                            No files uploaded yet
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Render unapproved info-objects */}
                    {rows
                      .filter(row => !row.approval_status || row.approval_status === 'pending')
                      .map((row) => {
                        const isExpanded = isDropdownOpenn === String(row.id);
                        return (
                          <React.Fragment key={`pending-${row.id}`}>
                            <tr className="hover:bg-yellow-50 bg-yellow-25">
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                                  —
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.table_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate" title={row.table_description}>
                                {row.table_description}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                  CSV
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
                                  Pending
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-center items-center gap-2">
                                  <button
                                    onClick={() => handleDirectApprove('table', row.id)}
                                    className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded"
                                    title="Approve & Add to Data Sources"
                                  >
                                    <FaCheck size={11} />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleEdit(row)}
                                    className="text-blue-600 hover:text-blue-800 p-1"
                                    title="Edit"
                                  >
                                    <FaPen size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenUploadModal(row.id)}
                                    className="text-green-600 hover:text-green-800 p-1"
                                    title="Upload File"
                                  >
                                    <FaFileUpload size={14} />
                                  </button>
                                  <button
                                    onClick={() => toggleDropdowns(String(row.id))}
                                    className="text-gray-600 hover:text-gray-800 p-1"
                                    title={isExpanded ? "Collapse" : "View Files"}
                                  >
                                    {isExpanded ? <FaCaretUp size={14} /> : <FaCaretDown size={14} />}
                                  </button>
                                  <button
                                    onClick={() => handleDeletes(row)}
                                    className="text-red-600 hover:text-red-800 p-1"
                                    title="Delete"
                                  >
                                    <FaTrash size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded files section for pending info-objects */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="px-0 py-0 bg-gray-50">
                                  <div className="px-8 py-3">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Uploaded Files</p>
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">File Name</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Created On</th>
                                          {/* <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th> */}
                                          {/* /<th className="px-4 py-2 text-center text-xs font-medium text-gray-600 uppercase">Actions</th> */}
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {row.files && row.files.length > 0 ? (
                                          row.files.map((file) => (
                                            <tr key={file.id} className="hover:bg-gray-50">
                                              <td className="px-4 py-2 text-gray-700">{file.filename}</td>
                                              <td className="px-4 py-2 text-gray-500">{new Date(file.created_at).toLocaleDateString()}</td>
                                              {/* <td className="px-4 py-2">{getApprovalBadge(file.approval_status || 'pending')}</td> */}
                                              {/* <td className="px-4 py-2 text-center">
                                                {(!file.approval_status || file.approval_status === 'pending') && (
                                                  <button
                                                    onClick={() => handleDirectApprove('file', file.id, row.id)}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Approve File"
                                                  >
                                                    <FaCheck size={13} />
                                                  </button>
                                                )}
                                              </td> */}
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={4} className="px-4 py-3 text-center text-gray-400 text-xs">
                                              No files uploaded yet. Click "Upload File" button above.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                    {dataSources.length === 0 && rows.filter(r => !r.approval_status || r.approval_status === 'pending').length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                          No data sources or info-objects yet. Use "+ PG Table" or "+ New Info-Object" to add.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>


            {/* Slots Summary */}
            {/* {dataSources.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  {Array.from({ length: dataSources[0]?.total_slots || 4 }, (_, i) => {
                    const filled = dataSources.find(s => s.slot_number === i + 1);
                    return (
                      <div
                        key={i}
                        className={`flex-1 h-2 rounded-full ${filled ? "bg-blue-500" : "bg-gray-200"}`}
                        title={filled ? `Slot ${i + 1}: ${filled.source_name}` : `Slot ${i + 1}: Empty`}
                      />
                    );
                  })}
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {dataSources[0]?.remaining_slots === 0
                      ? "All slots used"
                      : `${dataSources[0]?.remaining_slots} slot${dataSources[0]?.remaining_slots !== 1 ? "s" : ""} remaining`}
                  </span>
                </div>
              )} */}
            {/* </div> */}


            {/* Delete Data Source Confirmation Modal */}
            {deleteDataSourceConfirm.isOpen && deleteDataSourceConfirm.source && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Delete Data Source</h3>
                    <button
                      onClick={() => setDeleteDataSourceConfirm({ isOpen: false, source: null })}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes />
                    </button>
                  </div>

                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md">
                    <p className="text-sm text-gray-700 mb-1">
                      You are about to delete:
                    </p>
                    <p className="font-semibold text-gray-900">{deleteDataSourceConfirm.source.source_name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Slot {deleteDataSourceConfirm.source.slot_number} · {deleteDataSourceConfirm.source.source_type_display}
                      {deleteDataSourceConfirm.source.pg_table_name && ` · ${deleteDataSourceConfirm.source.pg_table_name}`}
                    </p>
                  </div>

                  <p className="text-sm text-red-600 mb-6">
                    ⚠️ This also deletes associated AI documentation. This action cannot be undone.
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setDeleteDataSourceConfirm({ isOpen: false, source: null })}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                      disabled={isDeletingDataSource}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteDataSource}
                      disabled={isDeletingDataSource}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium flex items-center gap-2"
                    >
                      {isDeletingDataSource ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Deleting...
                        </>
                      ) : (
                        <><FaTrash size={13} /> Delete</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation.isOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Confirm Deletion</h3>
                    <button
                      onClick={cancelDelete}
                      className="text-gray-500 hover:text-gray-700"
                      disabled={isDeletingInfoObject}
                    >
                      <FaTimes />
                    </button>
                  </div>
                  <p className="mb-6">
                    Are you sure you want to delete the Info-Object "
                    <span className="font-semibold">{deleteConfirmation.rowToDelete?.table_name}</span>"?
                    This action cannot be undone.
                  </p>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={cancelDelete}
                      disabled={isDeletingInfoObject}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      disabled={isDeletingInfoObject}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isDeletingInfoObject ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Deleting...
                        </>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}


            {isViewTablesModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4">
                  {/* Header */}
                  <div className="flex justify-between items-center px-6 py-4 border-b">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">PostgreSQL Tables</h3>
                      {pgDbInfo && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          Database: <span className="font-medium">{pgDbInfo.database_name}</span>
                          &nbsp;·&nbsp;
                          <span className="font-medium">{pgDbInfo.table_count}</span> tables found
                          &nbsp;·&nbsp;
                          <span className="text-blue-600 font-medium">Click a row to add as data source</span>
                        </p>
                      )}
                    </div>
                    <button onClick={() => setIsViewTablesModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <FaTimes size={18} />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {pgTablesLoading ? (
                      <div className="flex justify-center items-center py-10">
                        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : pgTables.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No tables found in this database.</p>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">#</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Table Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Rows</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Columns</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Size</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Created At</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pgTables.map((table, index) => (
                            <tr key={table.table_name} className="hover:bg-blue-50 transition-colors">
                              <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                              <td className="px-4 py-3 font-medium text-gray-800">{table.table_name}</td>
                              <td className="px-4 py-3 text-gray-600">{table.row_count.toLocaleString()}</td>
                              <td className="px-4 py-3 text-gray-600">{table.column_count}</td>
                              <td className="px-4 py-3 text-gray-600">{table.size}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {table.created_at ? new Date(table.created_at).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => {
                                    setSelectedPgTable(table);
                                    setAddDataSourceForm({
                                      source_name: table.table_name,
                                      description: "",
                                      row_limit: 100000,
                                    });
                                    setShowAddDataSourceModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                                >
                                  + Add
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end px-6 py-4 border-t">
                    <button
                      onClick={() => setIsViewTablesModalOpen(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add as Data Source Modal */}
            {showAddDataSourceModal && selectedPgTable && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                  {/* Header */}
                  <div className="flex justify-between items-center px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Add as Data Source</h3>
                    <button
                      onClick={() => {
                        setShowAddDataSourceModal(false);
                        setSelectedPgTable(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes size={18} />
                    </button>
                  </div>

                  {/* Form */}
                  <div className="px-6 py-5 space-y-4">
                    {/* Selected Table (read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Selected Table <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                        <span className="text-blue-700 font-medium text-sm">{selectedPgTable.table_name}</span>
                        <span className="text-xs text-gray-500">
                          ({selectedPgTable.row_count.toLocaleString()} rows · {selectedPgTable.column_count} cols · {selectedPgTable.size})
                        </span>
                      </div>
                    </div>

                    {/* Source Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Source Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addDataSourceForm.source_name}
                        onChange={(e) => setAddDataSourceForm(prev => ({ ...prev, source_name: e.target.value }))}
                        placeholder="e.g. ledger_data.csv"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={addDataSourceForm.description}
                        onChange={(e) => setAddDataSourceForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="e.g. Ledger transactions for financial analysis"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Row Limit */}
                    {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Row Limit</label>
                      <input
                        type="number"
                        value={addDataSourceForm.row_limit}
                        onChange={(e) => setAddDataSourceForm(prev => ({ ...prev, row_limit: parseInt(e.target.value) || 100000 }))}
                        min={1}
                        max={1000000}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Maximum rows to load from this table (default: 100,000)</p>
                    </div> */}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end gap-3 px-6 py-4 border-t">
                    <button
                      onClick={() => {
                        setShowAddDataSourceModal(false);
                        setSelectedPgTable(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPgTableAsDataSource}
                      disabled={isAddingDataSource || !addDataSourceForm.source_name || !addDataSourceForm.description}
                      className={`px-4 py-2 rounded-md text-sm text-white font-medium transition-colors ${isAddingDataSource || !addDataSourceForm.source_name || !addDataSourceForm.description
                        ? "bg-blue-300 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                        }`}
                    >
                      {isAddingDataSource ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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


            {/* Approval Modal */}
            {/* {showApprovalModal && selectedApprovalItem && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      {selectedApprovalItem.type === 'table' ? 'Table' : 'File'} Approval
                    </h3>
                    <button
                      onClick={() => {
                        setShowApprovalModal(false);
                        setApprovalComment('');
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <FaTimes />
                    </button>
                  </div>

                  <p className="mb-4 text-gray-600">
                    {selectedApprovalItem.type === 'table' ? 'Table' : 'File'}: <span className="font-semibold">{selectedApprovalItem.name}</span>
                  </p>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comment (Optional for approval, Required for rejection)
                    </label>
                    <textarea
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Enter your comment..."
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        if (selectedApprovalItem.type === 'table') {
                          handleRejectTable(selectedApprovalItem.id, approvalComment);
                        } else {
                          handleRejectFile(
                            selectedApprovalItem.tableId!,
                            selectedApprovalItem.id,
                            approvalComment
                          );
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                    >
                      <FaBan size={16} />
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        if (selectedApprovalItem.type === 'table') {
                          handleApproveTable(selectedApprovalItem.id, approvalComment);
                        } else {
                          handleApproveFile(
                            selectedApprovalItem.tableId!,
                            selectedApprovalItem.id,
                            approvalComment
                          );
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                    >
                      <FaCheck size={16} />
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            )} */}



            {isUploadModalOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Upload Files</h3>
                    <button onClick={handleCloseUploadModal} className="text-gray-400 hover:text-gray-500">
                      <FaTimes />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitMultipleFiles} className="mt-4">
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="datePicker">
                        Select Date:
                      </label>
                      <input
                        type="date"
                        id="datePicker"
                        name="date"
                        value={selectedDate}
                        onChange={handleDateChange}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                      />
                    </div>

                    <div className="mb-6">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Select Files (Multiple):
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
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
                          <FaUpload className="text-gray-500 mx-auto mb-2" size={24} />
                          <p className="text-sm text-gray-600 mb-2">
                            {selectedFiles.length > 0
                              ? `${selectedFiles.length} file(s) selected`
                              : 'Click or drag files to upload'}
                          </p>
                          {selectedFiles.length > 0 && (
                            <div className="mt-2 text-xs text-left max-h-32 overflow-y-auto">
                              {selectedFiles.map((file, index) => (
                                <div key={index} className="text-blue-600 truncate">
                                  • {file.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleCloseUploadModal}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploading || selectedFiles.length === 0}
                        className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:shadow-outline ${isUploading || selectedFiles.length === 0 ? 'opacity-75 cursor-not-allowed' : ''
                          }`}
                      >
                        {isUploading ? (
                          <span className="flex items-center">
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Uploading...
                          </span>
                        ) : (
                          `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}


            {/* Table Edit/Create Modal */}
            {isModallOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <h3 className="text-lg font-semibold mb-4">
                    {editRow ? 'Edit Info-Object' : 'Create New Info-Object'}
                  </h3>
                  <form onSubmit={handleSubmit} className="mt-4">
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Info-Object Name
                      </label>
                      <input
                        type="text"
                        name="tableName"
                        value={formData.tableName}
                        onChange={handleChange}
                        required
                        disabled={isSavingInfoObject}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
                      />
                    </div>
                    <div className="mb-6">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Info-Object Description
                      </label>
                      <input
                        type="text"
                        name="tableDescription"
                        value={formData.tableDescription}
                        onChange={handleChange}
                        required
                        disabled={isSavingInfoObject}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="submit"
                        disabled={isSavingInfoObject}
                        className={`w-full max-w-xs text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center justify-center gap-2 ${isSavingInfoObject
                          ? 'bg-blue-300 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-700'
                          }`}
                      >
                        {isSavingInfoObject ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                        className="w-full max-w-xs bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-300 disabled:cursor-not-allowed"
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
            <div className="max-w-[1400px] mx-auto px-4 py-6">

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Sources (Board API)</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{data.length}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Columns (Board API)</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {data.reduce((acc, src) => acc + (src.columns?.length || 0), 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Sources (All API)</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">{dataFiltered.length}</p>
                </div>
              </div>

              {/* ── SECTION 1: Board-scoped API (/board/{boardId}/all) ── */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 mb-8">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">AI Documentation</h3>
                    {/* <p className="text-xs text-gray-400 mt-0.5">
                      Source: <code className="bg-gray-100 px-1 rounded">/ai-documentation/board/{"{boardId}"}/all</code>
                    </p> */}
                  </div>
                  <button
                    onClick={fetchData}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-10 px-4 py-3"></th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Source Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Columns</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <p className="text-gray-400 text-sm">No data available for this board.</p>
                          </td>
                        </tr>
                      ) : (
                        data.map((source) => {
                          const isExpanded = expandedRow === source.id;
                          return (
                            <React.Fragment key={source.id}>
                              <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? "bg-blue-50" : ""}`}>
                                <td className="px-4 py-4 text-center">
                                  <div className="w-2 h-2 rounded-full bg-green-400 mx-auto"></div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-800">{source.source_name}</p>
                                      <p className="text-xs text-gray-400">ID: {source.data_source_id}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${source.source_type === "table_data"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-green-100 text-green-700"
                                    }`}>
                                    {source.source_type === "table_data" ? "Table" : source.source_type}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm text-gray-600">
                                    <span className="font-medium text-blue-600">{source.columns?.length || 0}</span> columns
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => setExpandedRow(isExpanded ? null : source.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isExpanded
                                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                  >
                                    {isExpanded
                                      ? <><MdArrowDropUp size={16} /> Collapse</>
                                      : <><MdArrowDropDown size={16} /> View Columns</>}
                                  </button>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="bg-blue-50">
                                  <td colSpan={5} className="px-0 py-0">
                                    <div className="px-8 py-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-700">
                                          Column Documentation — {source.source_name}
                                        </h4>
                                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                                          {source.columns?.length || 0} columns
                                        </span>
                                      </div>
                                      <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                        <table className="min-w-full bg-white">
                                          <thead>
                                            <tr className="bg-gray-100">
                                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-6">#</th>
                                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-64">Column Name</th>
                                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-20">Edit</th>
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
                                                    <td className="px-4 py-3 text-xs text-gray-400">{colIdx + 1}</td>
                                                    <td className="px-4 py-3">
                                                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-mono text-gray-700 border border-gray-200">
                                                        {col.column_name}
                                                      </span>
                                                    </td>
                                                    <td className="px-4 py-3">
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
                                                          className="w-full border border-blue-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                          autoFocus
                                                        />
                                                      ) : (
                                                        <span className="text-sm text-gray-600">
                                                          {col.description || (
                                                            <span className="text-gray-300 italic text-xs">No description</span>
                                                          )}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                      {isEditingCol ? (
                                                        <button
                                                          onClick={() => handleSaveClicks(source.id, boardId)}
                                                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md"
                                                        >
                                                          <FiSave size={12} /> Save
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
                                                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-md"
                                                        >
                                                          <FaPen size={10} /> Edit
                                                        </button>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })
                                            ) : (
                                              <tr>
                                                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400 italic">
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

              {/* ── SECTION 2: All docs filtered by boardId ── */}
              {/* <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">All Documentation (Board Filtered)</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Source: <code className="bg-gray-100 px-1 rounded">/ai-documentation/</code> filtered by board_id
                    </p>
                  </div>
                  <button
                    onClick={fetchDataFiltered}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Source Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Columns</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dataFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                            No filtered documentation found for this board.
                          </td>
                        </tr>
                      ) : (
                        dataFiltered.map((source: any, idx: number) => {
                          const expandKey = `filtered-${source.id}`;
                          const isExpanded = expandedRow === expandKey;
                          const columns: { column_name: string; description: string }[] =
                            source.columns ||
                            Object.entries(source.configuration_details || {}).map(([k, v]) => ({
                              column_name: k,
                              description: String(v),
                            }));

                          return (
                            <React.Fragment key={expandKey}>
                              <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? "bg-purple-50" : ""}`}>
                                <td className="px-4 py-4 text-xs text-gray-400">{idx + 1}</td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-800">{source.source_name || source.name}</p>
                                      <p className="text-xs text-gray-400">ID: {source.id}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                                    {source.source_type || "—"}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm text-gray-600">
                                    <span className="font-medium text-purple-600">{columns.length}</span> columns
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => setExpandedRow(isExpanded ? null : expandKey)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isExpanded
                                      ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                  >
                                    {isExpanded
                                      ? <><MdArrowDropUp size={16} /> Collapse</>
                                      : <><MdArrowDropDown size={16} /> View Columns</>}
                                  </button>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr className="bg-purple-50">
                                  <td colSpan={5} className="px-0 py-0">
                                    <div className="px-8 py-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold text-gray-700">
                                          Column Documentation — {source.source_name || source.name}
                                        </h4>
                                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                                          {columns.length} columns
                                        </span>
                                      </div>
                                      <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                        <table className="min-w-full bg-white">
                                          <thead>
                                            <tr className="bg-gray-100">
                                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-6">#</th>
                                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-64">Column Name</th>
                                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-20">Edit</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {columns.length > 0 ? (
                                              columns.map((col, colIdx) => {
                                                const isEditingCol =
                                                  editRowId === String(source.id) &&
                                                  editRowKey === col.column_name;
                                                return (
                                                  <tr key={colIdx} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-xs text-gray-400">{colIdx + 1}</td>
                                                    <td className="px-4 py-3">
                                                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-mono text-gray-700 border border-gray-200">
                                                        {col.column_name}
                                                      </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                      {isEditingCol ? (
                                                        <input
                                                          type="text"
                                                          value={
                                                            editValues[String(source.id)]?.[col.column_name] ??
                                                            col.description
                                                          }
                                                          onChange={(e) =>
                                                            handleChanges(
                                                              String(source.id),
                                                              col.column_name,
                                                              e.target.value
                                                            )
                                                          }
                                                          className="w-full border border-purple-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                                          autoFocus
                                                        />
                                                      ) : (
                                                        <span className="text-sm text-gray-600">
                                                          {col.description || (
                                                            <span className="text-gray-300 italic text-xs">No description</span>
                                                          )}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                      {isEditingCol ? (
                                                        <button
                                                          onClick={() =>
                                                            handleSaveFilteredClicks(String(source.id), boardId)
                                                          }
                                                          className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-md"
                                                        >
                                                          <FiSave size={12} /> Save
                                                        </button>
                                                      ) : (
                                                        <button
                                                          onClick={() => {
                                                            setEditRowId(String(source.id));
                                                            setEditRowKey(col.column_name);
                                                            setEditValues((prev) => ({
                                                              ...prev,
                                                              [String(source.id)]: {
                                                                ...(prev[String(source.id)] || {}),
                                                                [col.column_name]: col.description,
                                                              },
                                                            }));
                                                          }}
                                                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-md"
                                                        >
                                                          <FaPen size={10} /> Edit
                                                        </button>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })
                                            ) : (
                                              <tr>
                                                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400 italic">
                                                  No columns found.
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
              </div> */}

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

        {isModalOpen && (
          <div className="fixed inset-0 flex items-center w-full h-full justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg  w-full h-full overflow-y-auto relative">
              <button
                onClick={handleCloseModal}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl"
              >
                ✖
              </button>
              <h2 className="text-xl font-bold mb-2">Run Your Prompt</h2>

              {/* Input Field */}
              <textarea
                className="w-full p-2 border rounded"
                placeholder="Type your prompt here..."
                value={newPromptName}
                rows={8}
                ref={textareaRef} // Attach the ref to the textarea
                onChange={(e) => setNewPromptName(e.target.value)}
              />

              {/* Action Buttons */}

              <div className="mt-4 flex justify-end space-x-2">

                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  // className={styles.viewPromptsButton}
                  onClick={handleViewPromptsClick}
                >
                  View Prompts
                </button>
                <button onClick={handleRePrompt}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" disabled={isLoading}>
                  Reprompt
                </button>
                {/* {isLoading && <Spinner/>} Display spinner when loading */}
                {/* {isLoading && <Spinner />} */}
                <button
                  onClick={handleRunPrompt}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  disabled={!newPromptName.trim() || isLoading}
                >
                  Run
                </button>
                <button
                  onClick={handleSavePrompt}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  disabled={isLoading}
                >
                  Save
                </button>

              </div>

              {/* Modal Popup - Kept outside the flex container */}
              {/* {showPopup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                  <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-auto">
                    <h3 className="text-xl font-semibold mb-2">Instruction</h3>
                    <p className="mb-4">Please click "Reprompt" first and then "Run" for better insights.</p>
                    <button
                      onClick={closePopup}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )} */}

              {/* Single loading indicator that displays when any action is in progress */}
              {isLoading && (
                <div className="fixed top-4 right-4">
                  <Spinner />
                </div>
              )}

              {/* Only show the tabs if Run button is clicked */}
              {isRunClicked && runResult && (
                <div className="run-results mt-6">
                  {/* Tab buttons for navigation */}
                  <div className="tabs flex justify-end space-x-2 mb-4">
                    {['message', 'table', 'charts'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`tab-button px-4 py-2 rounded ${activeTab === tab ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="tab-content max-h-[60vh] overflow-y-auto">
                    {activeTab === 'message' && (
                      <div className="message-tab">
                        {runResult?.message && runResult.message.length > 0 ? (
                          <div>
                            <h4 className="font-medium text-lg">Message:</h4>
                            <p>{runResult.message[0]}</p>
                          </div>
                        ) : (
                          <p>No message found.</p>
                        )}
                      </div>
                    )}

                    {activeTab === 'table' && runResult.table && (
                      <div className="table-tab">
                        {runResult?.table && runResult.table.columns?.length > 0 ? (
                          <div className="mt-4">
                            <div className="flex justify-end">
                              <button
                                onClick={downloadExcel}
                                className="mb-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                              >
                                Download as excel
                              </button>
                            </div>
                            {/* <h4 className="font-medium text-lg">Table Data:</h4> */}
                            <div className="max-h-94 overflow-y-auto border border-gray-300 rounded">
                              <table className="min-w-full table-auto">
                                <thead>
                                  <tr>
                                    {runResult.table.columns.map((col, index) => (
                                      <th key={`header-${index}`} className="p-2 border-b text-left">
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {runResult.table.data.length > 0 ? (
                                    runResult.table.data.map((row, rowIdx) => (
                                      <tr key={`row-${rowIdx}`}>
                                        {row.map((cell, cellIdx) => (
                                          <td key={`cell-${rowIdx}-${cellIdx}`} className="p-2 border-b">
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))
                                  ) : (
                                    <tr key="no-data-row">
                                      <td
                                        colSpan={runResult.table.columns.length}
                                        className="text-center p-2"
                                      >
                                        No data available.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <p>No table data found.</p>
                        )}
                      </div>
                    )}

                    {activeTab === 'charts' && runResult.charts && (
                      <div className="charts-tab">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setShowDownloadModal(true)}
                            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-md"
                          >
                            Download as PPT
                          </button>


                          {showDownloadModal && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                              <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                                <h3 className="text-xl font-bold text-blue-700 mb-4">Download Report Options</h3>
                                <p className="mb-4">Please select the type of report you would like to download:</p>

                                <button
                                  onClick={() => {
                                    setShowDownloadModal(false);
                                    downloadPPT(false, 'limited');
                                  }}
                                  className="w-full mb-4 py-2 bg-blue-500 text-white rounded font-bold"
                                >
                                  Charts Only
                                </button>

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

                                  <button
                                    onClick={() => {
                                      const selectedOptionElement = document.querySelector('input[name="tableRows"]:checked');
                                      const selectedOption = selectedOptionElement ? (selectedOptionElement as HTMLInputElement).value : null;
                                      setShowDownloadModal(false);
                                      downloadPPT(true, selectedOption ?? 'limited');
                                    }}
                                    className="w-full py-2 bg-blue-700 text-white rounded font-bold"
                                  >
                                    Download Complete Report
                                  </button>
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
                        </div>
                        {/* <p className="text-center">Charts will be displayed here.</p> */}

                        {/* Flex container for charts */}
                        <div className="my-4 flex flex-wrap justify-center gap-6">
                          {runResult.charts && runResult.charts.map((chart: ChartData, index: number) => {
                            switch (chart.chart_type) {
                              case 'pie':
                                return (
                                  <div key={`pie-chart-${index}`} className="w-full max-w-[400px] flex-1 chart-container">
                                    <h5 className="text-lg font-semibold text-center">Pie Chart</h5>
                                    <div style={{ height: "400px" }}>
                                      <Pie data={getPieData(chart)}
                                        options={{
                                          maintainAspectRatio: false,
                                          plugins: { legend: { display: true, position: "top" } }
                                        }}
                                      />
                                    </div>
                                    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                      <h6 className="text-md font-semibold mb-2">Insights:</h6>
                                      <ul className="list-disc list-inside">
                                        {chart.insight && chart.insight.map((insight, insightIndex) => (
                                          <li key={`pie-insight-${index}-${insightIndex}`} className="text-sm">
                                            {insight}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                );
                              case 'bar':
                                return (
                                  <div key={`bar-chart-${index}`} className="w-full max-w-[500px] flex-1 chart-container">
                                    <h5 className="text-lg font-semibold text-center">Bar Chart</h5>
                                    <div style={{ height: "400px" }}>
                                      <Bar
                                        data={getChartData(chart, 'bar')}
                                        options={{
                                          maintainAspectRatio: false,
                                          plugins: { legend: { display: true, position: "top" } },
                                          scales: { y: { beginAtZero: true } },
                                        }}
                                      />
                                    </div>
                                    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                      <h6 className="text-md font-semibold mb-2">Insights:</h6>
                                      <ul className="list-disc list-inside">
                                        {chart.insight && chart.insight.map((insight, insightIndex) => (
                                          <li key={`bar-insight-${index}-${insightIndex}`} className="text-sm">
                                            {insight}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                );
                              case 'line':
                                return (
                                  <div key={`line-chart-${index}`} className="w-full max-w-[500px] flex-1 chart-container">
                                    <h5 className="text-lg font-semibold text-center">Line Chart</h5>
                                    <div style={{ height: "400px" }}>
                                      <Line
                                        data={getChartData(chart, 'line')}
                                        options={{
                                          maintainAspectRatio: false,
                                          plugins: { legend: { display: true, position: "top" } },
                                          scales: { y: { beginAtZero: true } },
                                        }}
                                      />
                                    </div>
                                    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                      <h6 className="text-md font-semibold mb-2">Insights:</h6>
                                      <ul className="list-disc list-inside">
                                        {chart.insight && chart.insight.map((insight, insightIndex) => (
                                          <li key={`line-insight-${index}-${insightIndex}`} className="text-sm">
                                            {insight}
                                          </li>
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
          <div className={styles.modalOverlay}>
            <div className={`${styles.promptsModal} ${styles.slideInLeft}`}>
              <div className={styles.modalHeader}>
                <button
                  className={styles.closeButton}
                  onClick={handleClosePromptsModal}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalContent}>
                <div className={styles.searchContainer}>
                  <input
                    type="text"
                    placeholder="Search prompts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className={styles.clearSearchButton}
                    >
                      ×
                    </button>
                  )}
                </div>

                {promptsLoading ? (
                  <div className={styles.loadingOverlay}>
                    <div className={styles.spinner}></div>
                  </div>
                ) : error ? (
                  <div className={styles.error}>{error}</div>
                ) : filteredPrompt.length === 0 ? (
                  <div className={styles.noResults}>
                    {searchTerm
                      ? `No prompts found for "${searchTerm}"`
                      : 'No prompts found for this board.'}
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className={styles.clearSearchLink}
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={styles.promptContainer}>
                    {searchTerm && (
                      <div className={styles.searchResultsInfo}>
                        <span>
                          Found {filteredPrompt.length} prompt
                          {filteredPrompt.length !== 1 ? 's' : ''} for "{searchTerm}"
                        </span>
                        <button
                          onClick={() => setSearchTerm('')}
                          className={styles.clearSearchLink}
                        >
                          Clear search
                        </button>
                      </div>
                    )}

                    <div className={styles.scrollablePrompts}>
                      {filteredPrompts.map((prompt, index) => {
                        // ✅ FIX: Use promptOutputTypes state (runtime), not prompt.output_type (API field which is empty)
                        const outputType = promptOutputTypes[prompt.id];

                        return (
                          <div
                            key={prompt.id || index}
                            className={styles.promptCard}
                            onClick={() => handlePromptClick(prompt)}
                          >
                            {/* Header row: number + badge */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <div className={styles.promptNumber}>
                                {index + 1}.
                              </div>

                              {/* ✅ C/T badges — same as Manage Prompts tab */}
                              {outputType && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {(outputType === 'C' || outputType === 'CT') && (
                                    <span
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        backgroundColor: '#f3e8ff',
                                        color: '#7e22ce',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid #d8b4fe',
                                        flexShrink: 0,
                                      }}
                                      title="This prompt produces Charts"
                                    >
                                      C
                                    </span>
                                  )}
                                  {(outputType === 'T' || outputType === 'CT') && (
                                    <span
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        backgroundColor: '#f0fdf4',
                                        color: '#15803d',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid #86efac',
                                        flexShrink: 0,
                                      }}
                                      title="This prompt produces a Table"
                                    >
                                      T
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <h4>{prompt.prompt_title}</h4>
                            <p>{prompt.prompt_text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <TimelineSettings boardId={boardId ?? ""} />
        )}

        {activeTab === "parameters" && (
          <ParameterSettings boardId={boardId ?? ""} />
        )}

        {activeTab === "tally" && (
          <TallySetting />
        )}

      </div>
    </div >
  );

}


function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
