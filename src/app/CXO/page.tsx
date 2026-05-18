"use client";

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import Spinner from '../components/Spinner';
import { useRouter } from 'next/navigation';
import { Menu, X, Settings, BarChart2, FileText, PieChart, TrendingUp, Database, Users, LayoutDashboard, BookOpen, Play, ChevronRight } from 'lucide-react';
import KPIDashboard from '../Dashboard/page';
import Image from 'next/image';
import loginImage from '../assets/logo.jpg';
import { FiMic } from "react-icons/fi";
import PptxGenJS from "pptxgenjs";
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

interface Board {
  name: string;
  is_active: boolean;
  path?: string;
}

interface MainBoard {
  main_board_id: string;
  name: string;
  boards: {
    [key: string]: Board;
  };
}

interface DemoMainBoard { id: number; name: string; }
interface DemoBoard { id: number; name: string; main_board_id: number; is_active?: boolean; }

interface Prompt {
  prompt_text: string;
  id: string;
  prompt_title: string;
  prompt_content: string;
  user_name: string;
  created_at: string;
}

interface UserData {
  email: string;
  userId: string;
  userRole: string;
  userName: string;
}

export default function CXO() {
  const [navItems, setNavItems] = useState<MainBoard[]>([]);
  const [selectedMainBoardId, setSelectedMainBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardCheckLoading, setBoardCheckLoading] = useState<string | null>(null);
  const [, setCurrentPromptIndex] = useState(0);
  const [newPromptName, setNewPromptName] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState("prompts");
  const [cxoView, setCxoView] = useState<"home" | "dashboard">("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [, setShowCharts] = useState(false);
  const [isRunClicked, setIsRunClicked] = useState(false);
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [userData, setUserData] = useState<UserData>({
    email: "",
    userId: "",
    userRole: "",
    userName: "",
  });
  const [isMounted, setIsMounted] = useState(false);

  interface ChartData {
    chart_type: string;
    data_format: ChartDataFormat;
    insight?: string[];
  }

  interface ChartDataFormat {
    labels?: string[];
    categories?: string[];
    values?: number[] | number[][];
    isStacked?: boolean;
  }

  type RunResult = {
    message: string[];
    table: { columns: string[]; data: string[][] };
    charts: ChartData[];
  };

  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredPrompt, setFilteredPrompt] = useState<Prompt[]>([]);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'error' | 'info' }[]>([]);

  const showToast = (message: string, type: 'error' | 'info' = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeMainBoardInSidebar, setActiveMainBoardInSidebar] = useState<string | null>(null);
  const [noPromptsBoard, setNoPromptsBoard] = useState<string | null>(null);
  const [demoMainBoards, setDemoMainBoards] = useState<DemoMainBoard[]>([]);
  const [demoBoards, setDemoBoards] = useState<DemoBoard[]>([]);
  const [isDemoRefOpen, setIsDemoRefOpen] = useState(false);
  const [activeDemoMainBoard, setActiveDemoMainBoard] = useState<string | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isDemoBoard, setIsDemoBoard] = useState(false);
  const [selectedDemoBoardId, setSelectedDemoBoardId] = useState<number | null>(null);
  const [demoBoardName, setDemoBoardName] = useState('');
  const [showDownloadModal, setShowDownloadModal] = useState(false);

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
  

  const handleResultsScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollTop(el.scrollTop > 200);
  };

  const handleScrollTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredPrompt(prompts);
    } else {
      const query = searchTerm.toLowerCase();
      setFilteredPrompt(prompts.filter(p =>
        (p.prompt_title && p.prompt_title.toLowerCase().includes(query)) ||
        (p.prompt_text && p.prompt_text.toLowerCase().includes(query))
      ));
    }
  }, [prompts, searchTerm]);

  const filteredPrompts = prompts.filter(p =>
    p.prompt_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.user_name && p.user_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('currentUserData')) {
      router.replace('/Login');
    }
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;
    try {
      const sessionData = sessionStorage.getItem('currentUserData');
      if (sessionData) {
        const p = JSON.parse(sessionData);
        setUserData({ email: p.email || "", userId: p.userId || "", userRole: p.userRole || "", userName: p.userName || "" });
        return;
      }
      const local = {
        email: localStorage.getItem('loggedInUserEmail') || "",
        userId: localStorage.getItem('loggedInUserId') || "",
        userRole: localStorage.getItem('loggedInUserRole') || "",
        userName: localStorage.getItem('loggedInUserName') || "",
      };
      if (local.userId) setUserData(local);
    } catch (e) { console.error('Error loading user data:', e); }
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || !userData.userId) return;
    const fetchNavItems = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/main-boards/get_all_info_tree?user_id=${userData.userId}`, {
          method: 'GET',
          headers: { Accept: 'application/json', "X-API-Key": EXCEL_API_KEY },
        });
        if (res.ok) setNavItems(await res.json());
        else setError(`Failed to fetch data: ${res.statusText}`);
      } catch (e) {
        setError('Failed to load data. Please try again.');
      } finally { setLoading(false); }
    };
    fetchNavItems();
  }, [isMounted, userData.userId]);

  useEffect(() => {
    if (!isMounted) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || !userData.userId) return;
    const fetchOrgLogo = async () => {
      try {
        const cached = localStorage.getItem(`logo_cache_${userData.userId}`);
        if (cached) {
          const d = JSON.parse(cached);
          if (d.userId === userData.userId && d.localUrl) setOrgLogoUrl(d.localUrl);
        }
        const metaRes = await fetch(`${API_BASE_URL}/api/logo/${userData.userId}`, {
          headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
        });
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        if (meta?.success !== true || meta?.logo == null) return;
        const blobRes = await fetch(`${API_BASE_URL}/api/logo/${userData.userId}/view`, {
          headers: { 'X-API-Key': EXCEL_API_KEY },
        });
        if (blobRes.ok) {
          const blob = await blobRes.blob();
          if (blob.size > 0 && blob.type.startsWith('image/')) setOrgLogoUrl(URL.createObjectURL(blob));
        }
      } catch { /* keep cached */ }
    };
    fetchOrgLogo();
  }, [isMounted, userData.userId]);

  const handleRunPrompt = async () => {
    setIsLoading(true);
    setIsRunClicked(true);
    if (!newPromptName?.trim()) { showToast("Please enter a valid prompt.", 'info'); setIsLoading(false); return; }
    try {
      if (isDemoBoard && selectedDemoBoardId !== null) {
        const url = new URL(`${API_BASE_URL}/demo/prompts/${selectedDemoBoardId}/run`);
        url.searchParams.append("input_text", newPromptName.trim());
        url.searchParams.append("use_cache", "true");
        const response = await axios.post(url.href, null, { headers: { "X-API-Key": EXCEL_API_KEY } });
        if (response?.data) {
          setRunResult(response.data);
          if (response.data.message?.length > 0) setActiveTab("message");
          else if (response.data.table?.columns?.length > 0) setActiveTab("table");
          else if (response.data.charts?.length > 0) setActiveTab("charts");
        } else { showToast("No data returned from the server."); }
      } else {
        if (!selectedBoardId) { showToast("Board ID is required.", 'info'); setIsLoading(false); return; }
        const url = new URL(`${API_BASE_URL}/main-boards/boards/prompts/run_prompt_v4?`);
        url.searchParams.append("input_text", newPromptName.trim());
        url.searchParams.append("board_id", selectedBoardId);
        url.searchParams.append("user_name", userData.userName || "Unknown User");
        url.searchParams.append("use_cache", "true");
        const response = await axios.post(url.href,
          { input_text: newPromptName.trim(), board_id: selectedBoardId, user_name: userData.userName || "Unknown User", use_cache: true },
          { headers: { "X-API-Key": EXCEL_API_KEY } }
        );
        if (response?.data) {
          setRunResult(response.data);
          if (response.data.message?.length > 0) setActiveTab("message");
          else if (response.data.table?.columns?.length > 0) setActiveTab("table");
          else if (response.data.charts?.length > 0) setActiveTab("charts");
          setShowCharts(["chart","visualization"].some(k => newPromptName.toLowerCase().includes(k)));
        } else { showToast("No data was returned from the server."); }
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) showToast(`Server Error (${error.response?.status || "Unknown"}): ${error.response?.data?.message || error.message}`);
      else if (error instanceof Error) showToast(`Error: ${error.message}`);
      else showToast("An unknown error occurred.");
    } finally { setIsLoading(false); }
  };

  useEffect(() => {
    const fetchPrompts = async () => {
      if (!selectedBoardId) return;
      setPromptsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/main-boards/boards/prompts/boards/${selectedBoardId}`, { headers: { "X-API-Key": EXCEL_API_KEY } });
        if (!res.ok) throw new Error(`Failed to fetch prompts: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (!Array.isArray(data)) { setPrompts([]); throw new Error("Invalid response format"); }
        setPrompts(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unknown error occurred");
      } finally { setPromptsLoading(false); }
    };
    fetchPrompts();
  }, [selectedBoardId]);

  const handleMainBoardClick = (id: string) => setSelectedMainBoardId(id);
  const handleBackClick = () => { setActiveTab("prompts"); setSelectedMainBoardId(null); };
  const handleBoardClick = async (id: string) => {
    setBoardCheckLoading(id);
    setNoPromptsBoard(null);
    setRunResult(null);
    setNewPromptName('');
    setIsRunClicked(false);
    try {
      const res = await fetch(`${API_BASE_URL}/main-boards/boards/prompts/boards/${id}`, { headers: { "X-API-Key": EXCEL_API_KEY } });
      if (!res.ok) { setNoPromptsBoard(id); return; }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) { setNoPromptsBoard(id); return; }
      setPrompts(data);
      setActiveTab("prompts");
      setSelectedBoardId(id);
      setShowBoardModal(true);
    } catch {
      setNoPromptsBoard(id);
    } finally {
      setBoardCheckLoading(null);
    }
  };
  const handleDemoBoardClick = async (boardId: number, mainBoardId: number, boardName: string) => {
    setBoardCheckLoading(String(boardId));
    setRunResult(null);
    setNewPromptName('');
    setIsRunClicked(false);
    setNoPromptsBoard(null);
    try {
      const res = await fetch(`${API_BASE_URL}/demo/prompts/board/${mainBoardId}/${boardId}`, { headers: { "X-API-Key": EXCEL_API_KEY } });
      if (!res.ok) { showToast("Failed to load demo board prompts."); return; }
      const data = await res.json();
      const promptsList: Prompt[] = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
      if (promptsList.length === 0) { showToast("No prompts available in this board.", 'info'); return; }
      setPrompts(promptsList);
      setActiveTab("prompts");
      setIsDemoBoard(true);
      setSelectedDemoBoardId(boardId);
      setDemoBoardName(boardName);
      setSelectedBoardId(null);
      setShowBoardModal(true);
    } catch { showToast("Error loading demo board."); }
    finally { setBoardCheckLoading(null); }
  };

  const handleCloseBoardModal = () => {
    setShowBoardModal(false); setSelectedBoardId(null); setActiveTab("prompts");
    setSelectedPrompt(null); setNewPromptName(''); setIsRunClicked(false); setRunResult(null);
    setIsDemoBoard(false); setSelectedDemoBoardId(null); setDemoBoardName('');
  };
  const handleViewPromptsClick = () => setShowPromptsModal(true);
  const handleClosePromptsModal = () => { setShowPromptsModal(false); setCurrentPromptIndex(0); setSearchTerm(''); };
  const handlePromptClick = (prompt: Prompt) => { setNewPromptName(prompt.prompt_text); setShowPromptsModal(false); textareaRef.current?.focus(); };

  const selectedMainBoard = navItems.find(i => i.main_board_id === selectedMainBoardId);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('currentUserData');
      ['loggedInUserEmail','loggedInUserId','loggedInUserRole','loggedInUserName','client_user_id'].forEach(k => localStorage.removeItem(k));
    }
    router.replace('/Login');
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const fetchDemoMainBoards = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/demo/main-boards`, { headers: { accept: "application/json", "X-API-Key": EXCEL_API_KEY } });
      if (res.ok) { const json = await res.json(); setDemoMainBoards(Array.isArray(json) ? json : (json.data ?? [])); }
    } catch {}
  };
  const fetchDemoBoards = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/demo/boards`, { headers: { accept: "application/json", "X-API-Key": EXCEL_API_KEY } });
      if (res.ok) { const json = await res.json(); setDemoBoards(Array.isArray(json) ? json : (json.data ?? [])); }
    } catch {}
  };
  const toggleDemoRef = () => {
    const opening = !isDemoRefOpen;
    setIsDemoRefOpen(opening);
    setActiveDemoMainBoard(null);
    if (opening) { setIsDemoLoading(true); Promise.all([fetchDemoMainBoards(), fetchDemoBoards()]).finally(() => setIsDemoLoading(false)); }
  };

  const downloadExcel = () => {
    if (!runResult?.table || runResult.table.data.length === 0) { showToast("No data to download.", 'info'); return; }
    const ws = XLSX.utils.aoa_to_sheet([runResult.table.columns, ...runResult.table.data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Table Data");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "table_data.xlsx");
  };

  const downloadPPT = (includeTableData = true, tableRowOption = 'limited') => {
    try {
      let ppt = new PptxGenJS();
      ppt.author = "Data Analysis Tool";
      ppt.subject = "Data Analysis Results";
      ppt.title = "Insight Analysis Report";

      const THEME = {
        primary: "2B579A", secondary: "4472C4", accent1: "ED7D31",
        accent2: "70AD47", accent3: "5B9BD5", background: "FFFFFF",
        text: "2F3542", headerBackground: "F2F2F2"
      };

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

      // Title slide
      const titleSlide = ppt.addSlide({ masterName: "MASTER_SLIDE" });
      titleSlide.addText("Insights Analysis Report", { x: 0.5, y: 2.0, fontFace: "Arial", fontSize: 36, color: THEME.primary, bold: true, align: "center" });
      titleSlide.addText("Generated on " + new Date().toLocaleDateString(), { x: 0.5, y: 3.0, fontFace: "Arial", fontSize: 18, color: THEME.text, align: "center" });

      // Prompt slide
      if (newPromptName.trim()) {
        const promptSlide = ppt.addSlide({ masterName: "MASTER_SLIDE" });
        promptSlide.addText("Current Prompt", { x: 0.5, y: 0.12, w: 8.5, fontFace: "Arial", fontSize: 20, color: "FFFFFF", bold: true, align: "left" });
        promptSlide.addText("Query entered by the user", { x: 0.5, y: 0.78, w: 8.5, fontFace: "Arial", fontSize: 11, color: "888888", italic: true, align: "left" });
        const estimatedLines = Math.ceil(newPromptName.trim().length / 80);
        const boxHeight = Math.min(Math.max(estimatedLines * 0.35 + 0.4, 1.0), 4.5);
        promptSlide.addText(newPromptName.trim(), { x: 0.5, y: 1.15, w: 8.5, h: boxHeight, fontFace: "Arial", fontSize: 15, color: THEME.text, fill: { color: "EEF2FF" }, line: { color: "4472C4", pt: 1 }, wrap: true, valign: "middle", align: "left", lineSpacing: 22, margin: [10, 14, 10, 14] });
      }

      // Table data slides
      if (includeTableData && runResult?.table && runResult.table.data.length > 0) {
        try {
          const columns = runResult.table.columns;
          const tableHeader = columns.map(col => ({ text: col, fontFace: "Arial", bold: true, fill: THEME.headerBackground, color: THEME.primary, fontSize: 11 }));
          const dataToDisplay = tableRowOption === 'all' ? runResult.table.data : runResult.table.data.slice(0, 20);
          const COLUMNS_PER_SLIDE_THRESHOLD = 8;

          if (columns.length > COLUMNS_PER_SLIDE_THRESHOLD) {
            const columnsPerSlide = 8;
            const totalColumnSlides = Math.ceil(columns.length / columnsPerSlide);
            for (let colSlideIndex = 0; colSlideIndex < totalColumnSlides; colSlideIndex++) {
              const startCol = colSlideIndex * columnsPerSlide;
              const endCol = Math.min(startCol + columnsPerSlide, columns.length);
              const currentColumnSet = columns.slice(startCol, endCol);
              const partialTableHeader = currentColumnSet.map(col => ({ text: col, fontFace: "Arial", bold: true, fill: THEME.headerBackground, color: THEME.primary, fontSize: 11 }));
              const rowsPerSlide = 15;
              const rowSlidesNeeded = Math.ceil(dataToDisplay.length / rowsPerSlide);
              for (let rowSlideIndex = 0; rowSlideIndex < rowSlidesNeeded; rowSlideIndex++) {
                const startRow = rowSlideIndex * rowsPerSlide;
                const endRow = Math.min(startRow + rowsPerSlide, dataToDisplay.length);
                const currentRows = dataToDisplay.slice(startRow, endRow).map(row => row.slice(startCol, endCol).map(cell => ({ text: String(cell || ''), fontFace: "Arial", fontSize: 10, color: THEME.text })));
                const tableSlide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });
                tableSlide.addText(`Table Data - Columns ${startCol + 1}-${endCol}`, { x: 0.5, y: 0.5, fontSize: 18, fontFace: "Arial", color: THEME.primary, bold: true });
                tableSlide.addText(`Rows ${startRow + 1}-${endRow} of ${dataToDisplay.length}`, { x: 0.5, y: 1.0, fontSize: 14, fontFace: "Arial", color: THEME.secondary });
                const availableWidth = 8.5;
                const colWidth = availableWidth / currentColumnSet.length;
                tableSlide.addTable([partialTableHeader, ...currentRows], { x: 0.5, y: 1.4, w: availableWidth, border: { pt: 0.5, color: "CFCFCF" }, colW: currentColumnSet.map(() => colWidth), rowH: Array(currentRows.length + 1).fill(0.3), fill: { color: "FFFFFF" }, valign: "middle", align: "center", fontSize: 10, autoPage: true });
              }
            }
          } else {
            const rowsPerSlide = 10;
            const totalSlides = Math.ceil(dataToDisplay.length / rowsPerSlide);
            for (let slideIndex = 0; slideIndex < totalSlides; slideIndex++) {
              const startRow = slideIndex * rowsPerSlide;
              const endRow = Math.min(startRow + rowsPerSlide, dataToDisplay.length);
              const currentRows = dataToDisplay.slice(startRow, endRow).map(row => row.map(cell => ({ text: String(cell || ''), fontFace: "Arial", fontSize: 10, color: THEME.text })));
              const tableSlide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });
              tableSlide.addText(`Table Data (${slideIndex + 1}/${totalSlides})`, { x: 0.5, y: 0.7, fontSize: 20, fontFace: "Arial", color: THEME.primary, bold: true });
              tableSlide.addTable([tableHeader, ...currentRows], { x: 0.5, y: 1.3, w: 8.5, border: { pt: 0.5, color: "CFCFCF" }, colW: columns.map(() => 8.5 / columns.length), rowH: Array(currentRows.length + 1).fill(0.3), fill: { color: "FFFFFF" }, valign: "middle" });
              const rowInfoText = tableRowOption === 'all'
                ? `Showing rows ${startRow + 1} to ${endRow} of ${dataToDisplay.length} total rows`
                : `Showing rows ${startRow + 1} to ${endRow} of 20 ${runResult.table.data.length > 20 ? `(limited from ${runResult.table.data.length} total rows)` : ''}`;
              tableSlide.addText(rowInfoText, { x: 0.5, y: 6.5, fontSize: 10, fontFace: "Arial", italic: true, color: "666666" });
            }
          }
        } catch (error) {
          console.error("Error creating table slides:", error);
        }
      }

      // Chart slides — capture canvas images
      if (runResult?.charts && runResult.charts.length > 0) {
        const chartsGrid = document.getElementById('cxo-charts-grid');
        const canvases = chartsGrid ? chartsGrid.querySelectorAll("canvas") : document.querySelectorAll("canvas");

        runResult.charts.forEach((chart, index) => {
          const slide = ppt.addSlide({ masterName: "CLEAN_MASTER_SLIDE" });
          slide.addText(chart.chart_type.toUpperCase() + " Chart", { x: 0.5, y: 0.7, fontSize: 20, fontFace: "Arial", color: THEME.primary, bold: true, align: "left" });
          const canvas = canvases[index] as HTMLCanvasElement;
          if (canvas) {
            const imgData = canvas.toDataURL("image/png", 1.0);
            slide.addImage({ data: imgData, x: 0.5, y: 1.3, w: 4.5, h: 3.5 });
          } else {
            slide.addText("Chart not available", { x: 0.5, y: 2, fontSize: 14, color: "FF0000" });
          }
          if (chart.insight?.length) {
            slide.addText("Key Insights:", { x: 5.5, y: 1.3, fontSize: 14, fontFace: "Arial", color: THEME.primary, bold: true });
            const maxInsights = Math.min(6, chart.insight.length);
            chart.insight.slice(0, maxInsights).forEach((insight, i) => {
              const text = insight.length > 80 ? insight.substring(0, 77) + "..." : insight;
              slide.addText(text, { x: 5.5, y: 1.7 + i * 0.4, w: 3.5, fontSize: 11, bullet: true, color: THEME.text });
            });
          }
        });
      }

      let fileName = "CXO_Report";
      if (!includeTableData) fileName += "_Charts_Only";
      else if (tableRowOption === 'all') fileName += "_All_Data";
      else fileName += "_Limited_Data";
      fileName += ".pptx";
      ppt.writeFile({ fileName });
    } catch (e) { console.error(e); }
  };

  const handleRePrompt = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/main-boards/boards/prompts/re_prompt`, null, {
        params: { input_text: newPromptName, board_id: selectedBoardId },
        headers: { "X-API-Key": EXCEL_API_KEY },
      });
      setNewPromptName(res.data.newPromptName || res.data);
      textareaRef.current?.focus();
    } catch (error) {
      if (axios.isAxiosError(error)) showToast(`Server Error (${error.response?.status || 'Unknown'}): ${error.response?.data?.message || error.message}`);
      else if (error instanceof Error) showToast(`Error: ${error.message}`);
      else showToast('An unknown error occurred.');
    } finally { setIsLoading(false); }
  };

  const handleSavePrompt = async () => {
    if (!newPromptName.trim()) { showToast('Prompt cannot be empty!'); return; }
    if (!selectedBoardId) { showToast('Error: board is not selected.'); return; }
    setIsLoading(true);
    try {
      let loggedInUserName: string | null = null;
      try {
        const stored = sessionStorage.getItem('currentUserData');
        if (stored) { const d = JSON.parse(stored); loggedInUserName = d.userName; }
      } catch {}
      if (!loggedInUserName) loggedInUserName = localStorage.getItem('loggedInUserName');
      if (!loggedInUserName || loggedInUserName.trim() === '' || loggedInUserName === 'Unknown User') {
        showToast('Error: User name missing. Please log in again.'); setIsLoading(false); return;
      }
      const response = await fetch(`${API_BASE_URL}/main-boards/boards/prompts/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': EXCEL_API_KEY },
        body: JSON.stringify({ board_id: selectedBoardId, prompt_text: newPromptName.trim(), prompt_out: 'out_string', user_name: loggedInUserName, created_by: loggedInUserName }),
      });
      if (!response.ok) {
        const err = await response.json();
        showToast(`Failed to save prompt: ${err.message || 'Unknown error'}`); setIsLoading(false); return;
      }
      const newPromptData = await response.json();
      setPrompts(prev => [...prev, newPromptData]);
      showToast('Prompt saved successfully!', 'info');
    } catch (error) {
      showToast('Network error: Failed to save the prompt.');
    } finally { setIsLoading(false); }
  };

  if (!isMounted || loading) return <div className="flex items-center justify-center h-screen text-sm text-gray-500">Loading...</div>;

  if (!userData.userId) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-base font-semibold mb-3">Authentication Required</h2>
        <p className="mb-3 text-sm text-gray-600">Please log in to access this page.</p>
        <button onClick={() => router.push('/')} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">Go to Login</button>
      </div>
    </div>
  );

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

  const getPieData = (chartData: ChartData) => {
    if (!chartData?.data_format) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
    const { labels = [], values = [] } = chartData.data_format;
    return {
      labels,
      datasets: [{
        data: values as number[],
        backgroundColor: labels.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
        borderColor: '#fff',
        borderWidth: 2,
      }],
    };
  };

  const getChartData = (chartData: ChartData, type: "bar" | "line") => {
    if (!chartData?.data_format) return { labels: [], datasets: [] };
    const { labels = [], categories, values = [] } = chartData.data_format;
    return {
      labels,
      datasets: (categories || []).map((cat, i) => ({
        label: cat,
        data: Array.isArray(values) && Array.isArray((values as number[][])[i]) ? (values as number[][])[i] : [],
        backgroundColor: type === 'bar'
          ? labels.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length])
          : CHART_COLORS[i % CHART_COLORS.length],
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        borderWidth: 2,
        fill: false,
        tension: 0.3,
      })),
    };
  };

  const cardIconStyles = [
    { Icon: BarChart2,      iconColor: 'text-orange-400',  bg: 'bg-orange-50',  textColor: 'text-orange-500'  },
    { Icon: FileText,       iconColor: 'text-purple-400',  bg: 'bg-purple-50',  textColor: 'text-purple-500'  },
    { Icon: PieChart,       iconColor: 'text-blue-400',    bg: 'bg-blue-50',    textColor: 'text-blue-500'    },
    { Icon: TrendingUp,     iconColor: 'text-green-400',   bg: 'bg-green-50',   textColor: 'text-green-500'   },
    { Icon: Database,       iconColor: 'text-rose-400',    bg: 'bg-rose-50',    textColor: 'text-rose-500'    },
    { Icon: Users,          iconColor: 'text-indigo-400',  bg: 'bg-indigo-50',  textColor: 'text-indigo-500'  },
    { Icon: LayoutDashboard,iconColor: 'text-teal-400',    bg: 'bg-teal-50',    textColor: 'text-teal-500'    },
    { Icon: BookOpen,       iconColor: 'text-amber-400',   bg: 'bg-amber-50',   textColor: 'text-amber-500'   },
  ];


  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* Sidebar */}
      <div className={`hidden md:flex flex-col bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 overflow-hidden ${isSidebarCollapsed ? 'w-14' : 'w-60'}`}>
        {/* Logo + collapse button row */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 flex-shrink-0">
          {!isSidebarCollapsed && (
            <div className="flex-1 flex items-center justify-start">
              {orgLogoUrl ? (
                <img src={orgLogoUrl} alt="Logo" className="max-h-9 object-contain" />
              ) : (
                <div className="h-9 w-24 bg-gray-200 animate-pulse rounded" />
              )}
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(v => !v)}
            className="flex items-center justify-center w-7 h-7 rounded border border-gray-300 bg-white hover:bg-gray-100 transition-colors flex-shrink-0 ml-auto"
          >
            <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 px-2 flex flex-col gap-1 overflow-y-auto">
          {/* Search bar */}
          {!isSidebarCollapsed && (
            <div className="relative mb-2">
              <input type="text" placeholder="Search boards..." value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                className="w-full py-1.5 pl-3 pr-7 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
              {sidebarSearch && (
                <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">×</button>
              )}
            </div>
          )}

          {/* Dashboard */}
          <button onClick={() => setCxoView("dashboard")}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${cxoView === "dashboard" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}>
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="text-xs font-medium">Dashboard</span>}
          </button>

          {/* Demo Reference */}
          {!isSidebarCollapsed && (
            <div className="mt-1">
              <button onClick={toggleDemoRef}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${isDemoRefOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isDemoRefOpen ? 'rotate-90' : ''}`} />
                <BookOpen className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-medium">Demo Reference</span>
              </button>
              {isDemoRefOpen && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {isDemoLoading ? (
                    <div className="text-xs text-gray-400 px-2 py-1">Loading...</div>
                  ) : demoMainBoards.length === 0 ? (
                    <div className="text-xs text-gray-400 px-2 py-1">No demo boards found</div>
                  ) : (
                    demoMainBoards.map(mb => {
                      const mbId = String(mb.id);
                      const isActiveDemoMb = activeDemoMainBoard === mbId;
                      const boardsForMb = demoBoards.filter(b => b.main_board_id === mb.id);
                      return (
                        <div key={mbId}>
                          <button onClick={() => setActiveDemoMainBoard(prev => prev === mbId ? null : mbId)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${isActiveDemoMb ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${isActiveDemoMb ? 'rotate-90' : ''}`} />
                            <span className="font-medium truncate">{mb.name}</span>
                          </button>
                          {isActiveDemoMb && (
                            <div className="ml-5 space-y-0.5">
                              {boardsForMb.map(board => (
                                <button key={board.id}
                                  onClick={() => { setCxoView("home"); handleDemoBoardClick(board.id, mb.id, board.name); }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                  <span className="truncate">{board.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main Boards tree */}
          {!isSidebarCollapsed && (
            <div className="mt-1">
              {navItems.filter(item => !sidebarSearch || item.name.toLowerCase().includes(sidebarSearch.toLowerCase())).map(item => {
                const mbId = String(item.main_board_id);
                const isExpanded = activeMainBoardInSidebar === mbId;
                const activeBoards = Object.keys(item.boards).filter(bid => item.boards[bid].is_active &&
                  (!sidebarSearch || item.boards[bid].name.toLowerCase().includes(sidebarSearch.toLowerCase())));
                return (
                  <div key={mbId}>
                    <button onClick={() => setActiveMainBoardInSidebar(prev => prev === mbId ? null : mbId)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors ${isExpanded ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                      <BarChart2 className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium truncate">{item.name}</span>
                    </button>
                    {(isExpanded || sidebarSearch) && (
                      <div className="ml-5 space-y-0.5 pb-1">
                        {activeBoards.map(bid => {
                          const isChecking = boardCheckLoading === bid;
                          const hasNoPrompts = noPromptsBoard === bid;
                          return (
                            <div key={bid}>
                              <button
                                onClick={() => { setCxoView("home"); handleBoardClick(bid); }}
                                disabled={isChecking}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                                  hasNoPrompts ? 'text-red-500 bg-red-50' :
                                  isChecking ? 'opacity-50 cursor-wait text-gray-700' :
                                  'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                                }`}>
                                <span className="truncate">{item.boards[bid].name}</span>
                                {isChecking && <div className="ml-auto animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 flex-shrink-0" />}
                              </button>
                              {hasNoPrompts && (
                                <p className="text-[10px] text-red-400 px-2 pb-1">No prompts available in this board</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* User info at bottom */}
        {!isSidebarCollapsed && (
          <div className="px-3 py-3 border-t border-gray-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{userData.userName?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-gray-800 truncate">{userData.userName || 'User'}</p>
              <p className="text-[10px] text-gray-500 truncate">{userData.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={toggleMobileMenu} />
      )}

      {/* Mobile sidebar */}
      <div className={`md:hidden fixed top-0 left-0 h-full bg-gray-200 z-50 transition-transform duration-300 w-60 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-3">
          <div className="flex justify-between items-center mb-3">
            {orgLogoUrl
              ? <img src={orgLogoUrl} alt="Logo" className="h-12 object-contain" />
              : <Image src={loginImage} alt="Logo" width={110} height={48} className="rounded-md object-contain" />}
            <button onClick={toggleMobileMenu} className="p-1.5"><X className="w-5 h-5" /></button>
          </div>
          <nav className="mt-3 space-y-1.5">
            <button
              onClick={() => { setCxoView("dashboard"); toggleMobileMenu(); }}
              className={`w-full text-left py-2 px-3 text-sm rounded ${cxoView === "dashboard" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-300"}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => { setCxoView("home"); setSelectedMainBoardId(null); toggleMobileMenu(); }}
              className={`w-full text-left py-2 px-3 text-sm rounded ${cxoView === "home" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-300"}`}
            >
              Main board
            </button>
            <a href="/Consultant" className="block py-2 px-3 text-blue-600 text-sm hover:bg-gray-300 rounded">Consultant</a>
            <button onClick={handleLogout} className="w-full py-2 px-3 bg-blue-600 hover:bg-red-500 rounded text-white text-sm text-left">Logout</button>
          </nav>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white shadow-md px-5 py-2.5 flex items-center gap-4 w-full z-30 sticky top-0">
          {/* Mobile menu */}
          <button className="md:hidden" onClick={toggleMobileMenu}><Menu className="w-5 h-5 text-gray-600" /></button>

          {/* Nav — centered */}
          <div className="flex-1 flex justify-center gap-8">
            <a href="/Consultant" className="text-blue-500 text-sm font-medium hover:text-blue-700 transition-colors">Consultant</a>
            <a href="/CXO" className="text-blue-500 text-sm font-medium hover:text-blue-700 transition-colors">CXO</a>
          </div>

          {/* User info + settings */}
          <div className="flex items-center gap-3 flex-shrink-0" ref={dropdownRef}>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{userData.userName || 'User'}</p>
              <p className="text-xs text-gray-500 leading-tight">{userData.email}</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(v => !v)}
                className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors"
              >
                <Settings className="w-4 h-4 text-white" />
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-full mt-1.5 bg-white shadow-lg rounded-md border border-gray-100 min-w-[120px] z-50">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {cxoView === "dashboard" ? (
            <KPIDashboard />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <BarChart2 className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm font-medium">Select a board from the sidebar to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Board Modal — full page overlay matching main layout */}
      {showBoardModal && (
        <div className="fixed inset-0 z-50 flex">

          {/* Replicate sidebar */}
           <div className="hidden md:flex flex-col items-start w-28 bg-gray-200 flex-shrink-0 pt-2 pb-4 gap-1 px-2">
  <div className="w-full h-12 flex items-center justify-center">
    {orgLogoUrl ? (
      <img
        src={orgLogoUrl}
        alt="Logo"
        className="max-h-10 object-contain"
      />
    ) : (
      <div className="h-10 w-full bg-gray-300 animate-pulse rounded"></div>
    )}
  </div>
</div>

          {/* Main panel */}
          <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">

            {/* Replicate header */}
            <header className="bg-white shadow-md px-5 py-2.5 flex items-center gap-4 w-full z-30 flex-shrink-0">
              <div className="flex-1 flex justify-center gap-8">
                <a href="/Consultant" className="text-blue-500 text-sm font-medium hover:text-blue-700">Consultant</a>
                <a href="/CXO" className="text-blue-500 text-sm font-medium hover:text-blue-700">CXO</a>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{userData.userName || 'User'}</p>
                  <p className="text-xs text-gray-500 leading-tight">{userData.email}</p>
                </div>
                <div className="relative">
                  <button onClick={() => setShowDropdown(v => !v)}
                    className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-white" />
                  </button>
                  {showDropdown && (
                    <div onMouseDown={e => e.stopPropagation()} className="absolute right-0 top-full mt-1.5 bg-white shadow-lg rounded-md border border-gray-100 min-w-[120px] z-50">
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md">Logout</button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Breadcrumb */}
            <div className="px-6 py-2.5 flex items-center gap-1 text-xs text-gray-500">
              <span onClick={handleCloseBoardModal} className="text-blue-500 hover:underline cursor-pointer font-medium">CXO</span>
              {isDemoBoard ? (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-gray-600 font-medium">Demo Reference</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-gray-700 font-semibold">{demoBoardName}</span>
                </>
              ) : (
                <>
                  {selectedMainBoard && (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-gray-600 font-medium">{selectedMainBoard.name}</span>
                    </>
                  )}
                  {selectedBoardId && selectedMainBoard?.boards[selectedBoardId] && (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-gray-700 font-semibold">{selectedMainBoard.boards[selectedBoardId].name}</span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Back + Clear action bar */}
            <div className="mx-5 mb-2 flex items-center justify-end gap-2">
              <button
                onClick={handleCloseBoardModal}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors bg-white"
              >
                ← Back
              </button>
              <button
                onClick={() => { setNewPromptName(""); setRunResult(null); setIsRunClicked(false); }}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-200"
              >
                Clear
              </button>
            </div>

            {/* Prompt toolbar */}
            <div className="mx-5 mb-4 bg-[#1a237e] rounded-xl flex items-center px-3 py-2 gap-3 shadow-lg">
              <input
                ref={textareaRef as unknown as React.RefObject<HTMLInputElement>}
                className="flex-1 bg-white text-gray-800 placeholder-gray-400 text-sm outline-none min-w-0 rounded-lg px-3 py-2 border-0"
                placeholder="Dynamic Prompt Entry..."
                value={newPromptName}
                onChange={e => setNewPromptName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRunPrompt(); } }}
              />
                  <button
                onClick={handleVoiceInput}
                title="Click to speak"
                className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${isListening ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
              >
                <FiMic className="text-white text-lg" />
              </button>
              {/* <button className="text-blue-200 hover:text-white p-1 flex-shrink-0">
                <Mic className="w-4 h-4" />
              </button> */}
              <button
                onClick={handleRePrompt}
                disabled={isLoading}
                className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                Re Prompt
              </button>
              <button
                onClick={handleRunPrompt}
                disabled={!newPromptName.trim() || isLoading}
                className="flex-shrink-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {isLoading ? <Spinner /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={handleSavePrompt}
                disabled={!newPromptName.trim() || isLoading}
                className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>

            {/* Results area */}
            <div ref={scrollRef} onScroll={handleResultsScroll} className="flex-1 overflow-y-auto px-5 pb-20">
              {isRunClicked && runResult && (
                <div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {['message', 'table', 'charts'].map(tab => {
                      const hasData = tab === 'message'
                        ? (runResult?.message?.length ?? 0) > 0
                        : tab === 'table'
                          ? (runResult?.table?.columns?.length ?? 0) > 0
                          : (runResult?.charts?.length ?? 0) > 0;
                      return (
                        <button key={tab}
                          disabled={!hasData}
                          onClick={() => hasData && setActiveTab(tab)}
                          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${!hasData ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' : activeTab === tab ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      );
                    })}
                    {activeTab !== 'message' && (
                      <div className="ml-auto flex gap-2">
                        {activeTab === 'table' && runResult?.table?.columns?.length > 0 && (
                          <button onClick={downloadExcel} className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded transition-colors">Download Excel</button>
                        )}
                        <button onClick={() => setShowDownloadModal(true)} className="px-3 py-1.5 text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white rounded transition-colors">Download PPT</button>
                      </div>
                    )}
                  </div>
                  <div>
                    {activeTab === 'message' && (
                      <div className="text-sm text-gray-700 p-4 bg-white rounded-xl shadow-sm">
                        {runResult?.message?.length > 0 ? <p>{runResult.message[0]}</p> : <p className="text-gray-400">No message found.</p>}
                      </div>
                    )}
                    {activeTab === 'table' && (
                      runResult.table?.columns?.length > 0 ? (
                      <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'auto', scrollbarColor: '#313b96 #f1f1f1' }}>
                        <table className="min-w-full table-auto text-sm whitespace-nowrap border-collapse">
                          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f3f4f6' }}>
                            <tr>
                              {runResult.table.columns.map((col, i) => (
                                <th key={i} className="px-3 py-2 border-b border-gray-200 text-left font-bold text-gray-700 text-xs uppercase tracking-wide">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {runResult.table.data.length > 0
                              ? runResult.table.data.map((row, ri) => (
                                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 border-b border-gray-100 text-gray-700 text-sm">{cell}</td>)}
                                  </tr>
                                ))
                              : <tr><td colSpan={runResult.table.columns.length} className="text-center p-3 text-gray-400">No data available.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                      ) : (
                        <div className="text-sm text-gray-400 p-4 bg-white rounded-xl shadow-sm">No table data found.</div>
                      )
                    )}
                    {activeTab === 'charts' && (
                      runResult.charts && runResult.charts.length > 0 ? (
                        <div id="cxo-charts-grid" className="flex flex-wrap justify-center gap-6">
                          {runResult.charts.map((chart: ChartData, i: number) => {
                            if (chart.chart_type === 'pie') return (
                              <div key={i} className="w-full max-w-[400px] flex-1 bg-white rounded-xl shadow-sm p-4">
                                <h5 className="text-sm font-semibold text-center mb-2">Pie Chart</h5>
                                <div style={{ height: '350px' }}><Pie data={getPieData(chart)} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } } }} /></div>
                                {chart.insight && chart.insight.length > 0 && <div className="mt-2 p-3 bg-gray-50 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>}
                              </div>
                            );
                            if (chart.chart_type === 'bar') return (
                              <div key={i} className="w-full max-w-[500px] flex-1 bg-white rounded-xl shadow-sm p-4">
                                <h5 className="text-sm font-semibold text-center mb-2">Bar Chart</h5>
                                <div style={{ height: '350px' }}><Bar data={getChartData(chart, 'bar')} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true } } }} /></div>
                                {chart.insight && chart.insight.length > 0 && <div className="mt-2 p-3 bg-gray-50 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>}
                              </div>
                            );
                            if (chart.chart_type === 'line') return (
                              <div key={i} className="w-full max-w-[500px] flex-1 bg-white rounded-xl shadow-sm p-4">
                                <h5 className="text-sm font-semibold text-center mb-2">Line Chart</h5>
                                <div style={{ height: '350px' }}><Line data={getChartData(chart, 'line')} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true } } }} /></div>
                                {chart.insight && chart.insight.length > 0 && <div className="mt-2 p-3 bg-gray-50 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>}
                              </div>
                            );
                            return null;
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400 p-4 bg-white rounded-xl shadow-sm">No charts found.</div>
                      )
                    )}
                  </div>
                </div>
              )}

              {showScrollTop && (
    <button
      onClick={handleScrollTop}
      className="absolute bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-full shadow-lg transition-all z-50"
    >
      ↑ Top
    </button>
  )}
            </div>
          </div>

          {/* View Prompts — fixed to right edge, vertical when result shown */}
          <button
            onClick={handleViewPromptsClick}
            className={`fixed right-0 top-1/2 -translate-y-1/2 z-[60] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xl transition-all ${isRunClicked && runResult ? 'px-2 py-6 [writing-mode:vertical-rl] rotate-180' : 'px-4 py-2.5'} rounded-l-lg`}
          >
            View Prompts
          </button>
        </div>
      )}
       {/* {showScrollTop && (
  <button
    onClick={handleScrollTop}
    className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-full shadow-lg transition-all"
  >
    ↑ Top
  </button>
)} */}

      {/* Prompts panel — fixed right overlay */}
      {showPromptsModal && (
        <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-[60] transition-transform duration-300">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <h4 className="text-sm font-semibold text-gray-800">Prompts</h4>
            <button onClick={handleClosePromptsModal} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
          </div>
          <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full py-1.5 px-3 pr-7 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">×</button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {promptsLoading ? (
              <div className="flex justify-center items-center h-16">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              </div>
            ) : error ? (
              <p className="text-red-500 text-xs p-2">{error}</p>
            ) : filteredPrompt.length === 0 ? (
              <div className="text-center text-gray-400 text-xs p-3">
                {searchTerm ? `No prompts found for "${searchTerm}"` : 'No prompts found for this board.'}
                {searchTerm && <button onClick={() => setSearchTerm('')} className="block mx-auto mt-1 text-blue-600 hover:underline">Clear</button>}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPrompt.map((prompt: Prompt, index: number) => (
                  <div key={prompt.id || index} onClick={() => handlePromptClick(prompt)}
                    className="border border-gray-100 rounded-lg p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-blue-500 flex-shrink-0">{index + 1}.</span>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800 leading-snug">{prompt.prompt_title}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-3 leading-relaxed">{prompt.prompt_text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Report Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-blue-700 mb-4">Download Report Options</h3>
            <p className="font-bold mb-2">Charts Only:</p>
            <p className="mb-4">Please select the type of report you would like to download:</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setShowDownloadModal(false); downloadPPT(false, 'limited'); }}
                className="flex-1 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
              >
                Download
              </button>
            </div>
            <div className="border-t border-gray-200 pt-4 mb-4">
              <p className="font-bold mb-2">Include table data in report:</p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center">
                  <input type="radio" id="cxoLimitedRows" name="cxoTableRows" value="limited" defaultChecked className="mr-2" />
                  <label htmlFor="cxoLimitedRows">First 20 rows only</label>
                </div>
                <div className="flex items-center">
                  <input type="radio" id="cxoAllRows" name="cxoTableRows" value="all" className="mr-2" />
                  <label htmlFor="cxoAllRows">All table rows</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const el = document.querySelector('input[name="cxoTableRows"]:checked') as HTMLInputElement | null;
                    const opt = el ? el.value : 'limited';
                    setShowDownloadModal(false);
                    downloadPPT(true, opt);
                  }}
                  className="flex-1 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowDownloadModal(false)}
              className="w-full py-2 bg-gray-200 text-gray-800 rounded border border-gray-300 hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[200] pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white animate-fade-in ${t.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
            <span>{t.type === 'error' ? '✕' : 'ℹ'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
    
  );
}