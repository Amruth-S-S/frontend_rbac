"use client";

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../context/LanguageContext';
import { translateBatch, formatNumber } from '../utils/translateService';
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
import dynamic from 'next/dynamic';

const LiveDataModal = dynamic(
  () => import('../components/LiveData').then(mod => ({ default: mod.LiveDataModal })),
  { ssr: false }
);
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
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [boardNameMap, setBoardNameMap] = useState<Record<string, string>>({});
  const [translatedCxoTexts, setTranslatedCxoTexts] = useState<Record<string, string>>({});
  const [translatedCxoTitles, setTranslatedCxoTitles] = useState<Record<string, string>>({});
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
  const [cxoView, setCxoView] = useState<"home" | "dashboard" | "livedata">("home");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [, setShowCharts] = useState(false);
  const [isRunClicked, setIsRunClicked] = useState(false);
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
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
  // US-based users don't get the Dashboard / Live Data tiles or sidebar entries.
  const [hideUsRestrictedTabs, setHideUsRestrictedTabs] = useState(false);

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
  const [translatedCxoResultColumns, setTranslatedCxoResultColumns] = useState<string[]>([]);
  const [translatedCxoResultData, setTranslatedCxoResultData] = useState<string[][]>([]);
  const [translatedCxoResultMessages, setTranslatedCxoResultMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredPrompt, setFilteredPrompt] = useState<Prompt[]>([]);
  // Track which prompt IDs are AI-generated (loaded from localStorage, same key as Container page)
  const [cxoGeneratedPromptIds, setCxoGeneratedPromptIds] = useState<Set<string>>(new Set());
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
  const [homeSection, setHomeSection] = useState<"mainboard" | "demo" | null>(null);

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
    if (!isMounted) return;
    setIsDemoLoading(true);
    Promise.all([fetchDemoMainBoards(), fetchDemoBoards()]).finally(() => setIsDemoLoading(false));
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;
    try {
      const sessionData = sessionStorage.getItem('currentUserData');
      if (sessionData) {
        const p = JSON.parse(sessionData);
        setUserData({ email: p.email || "", userId: p.userId || "", userRole: p.userRole || "", userName: p.userName || "" });
        setHideUsRestrictedTabs(p.country === 'United States');
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
        // Get orgId from session
        let orgId: string | null = null;
        try {
          const sd = sessionStorage.getItem('currentUserData');
          if (sd) orgId = String(JSON.parse(sd).orgId || '');
        } catch {}
        const url = orgId
          ? `${API_BASE_URL}/rbac/main-boards/info-tree?user_id=${userData.userId}&org_id=${orgId}`
          : `${API_BASE_URL}/rbac/main-boards/info-tree?user_id=${userData.userId}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json', "X-API-Key": EXCEL_API_KEY },
        });
        if (res.ok) {
          const raw = await res.json();
          const list: any[] = Array.isArray(raw) ? raw : (raw?.items ?? raw?.main_boards ?? raw?.data ?? []);
          // Normalize boards array → object keyed by board_id
          const normalized: MainBoard[] = list.map((mb: any) => {
            const boards: { [key: string]: Board } = {};
            if (Array.isArray(mb.boards)) {
              mb.boards.forEach((b: any) => {
                const bId = String(b.board_id ?? b.id ?? Math.random());
                boards[bId] = { name: b.name ?? b.board_name ?? '', is_active: b.is_active ?? true, path: b.path };
              });
            } else if (mb.boards && typeof mb.boards === 'object') {
              Object.assign(boards, mb.boards);
            }
            return { ...mb, main_board_id: String(mb.main_board_id ?? mb.id ?? ''), name: mb.name ?? '', boards };
          });
          setNavItems(normalized);
        } else {
          setError(`Failed to fetch data: ${res.statusText}`);
        }
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
        // Load generated prompt IDs from localStorage so G1 labels show in View Prompts modal
        try {
          const genStored = localStorage.getItem(`gen_prompt_ids_${selectedBoardId}`);
          setCxoGeneratedPromptIds(genStored ? new Set(JSON.parse(genStored).map(String)) : new Set());
        } catch { setCxoGeneratedPromptIds(new Set()); }
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unknown error occurred");
      } finally { setPromptsLoading(false); }
    };
    fetchPrompts();
  }, [selectedBoardId]);

  // Auto-translate all board names when language or navItems changes
  useEffect(() => {
    if (language === 'en' || navItems.length === 0) {
      setBoardNameMap({});
      return;
    }
    const allNames: string[] = [];
    navItems.forEach(item => {
      allNames.push(item.name);
      Object.values(item.boards).forEach(board => {
        if (board.is_active) allNames.push(board.name);
      });
    });
    const unique = [...new Set(allNames)];
    translateBatch(unique, language).then(translated => {
      const map: Record<string, string> = {};
      unique.forEach((name, i) => { map[name] = translated[i] || name; });
      setBoardNameMap(map);
    });
  }, [language, navItems]);

  // Auto-translate prompt text and titles when language or prompts change
  useEffect(() => {
    if (language === 'en' || prompts.length === 0) {
      setTranslatedCxoTexts({});
      setTranslatedCxoTitles({});
      return;
    }
    const texts = prompts.map(p => p.prompt_text || '');
    translateBatch(texts, language).then(translated => {
      const map: Record<string, string> = {};
      prompts.forEach((p, i) => { map[p.id] = translated[i] || texts[i]; });
      setTranslatedCxoTexts(map);
    });
    const titles = prompts.map(p => p.prompt_title || '');
    if (titles.some(t => t.trim() !== '')) {
      translateBatch(titles, language).then(translated => {
        const map: Record<string, string> = {};
        prompts.forEach((p, i) => { if (p.prompt_title) map[p.id] = translated[i] || titles[i]; });
        setTranslatedCxoTitles(map);
      });
    }
  }, [language, prompts]);

  // Translate run result when language or runResult changes
  useEffect(() => {
    if (!runResult || language === 'en') {
      setTranslatedCxoResultColumns([]);
      setTranslatedCxoResultData([]);
      setTranslatedCxoResultMessages([]);
      return;
    }
    const columns = runResult.table?.columns ?? [];
    const messages: string[] = Array.isArray(runResult.message) ? runResult.message : (runResult.message ? [runResult.message as unknown as string] : []);
    const tableData = runResult.table?.data ?? [];

    // Format numbers synchronously; collect strings for translation
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

    const allTexts = [...columns, ...messages, ...stringCellTexts];
    if (!allTexts.some(t => t.trim())) {
      setTranslatedCxoResultData(formattedData);
      return;
    }

    translateBatch(allTexts, language).then(translated => {
      const colEnd = columns.length;
      const msgEnd = colEnd + messages.length;
      setTranslatedCxoResultColumns(translated.slice(0, colEnd));
      setTranslatedCxoResultMessages(translated.slice(colEnd, msgEnd));
      stringCellCoords.forEach(({ row, col }, i) => {
        formattedData[row][col] = translated[msgEnd + i] || tableData[row][col];
      });
      setTranslatedCxoResultData(formattedData);
    });
  }, [runResult, language]);

  // Also reload cxoGeneratedPromptIds when selectedBoardId changes (handles modal open without re-fetch)
  useEffect(() => {
    if (!selectedBoardId) { setCxoGeneratedPromptIds(new Set()); return; }
    try {
      const genStored = localStorage.getItem(`gen_prompt_ids_${selectedBoardId}`);
      setCxoGeneratedPromptIds(genStored ? new Set(JSON.parse(genStored).map(String)) : new Set());
    } catch { setCxoGeneratedPromptIds(new Set()); }
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
      if (!res.ok) { setNoPromptsBoard(id); showToast("No prompts available in this board.", 'info'); return; }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) { setNoPromptsBoard(id); showToast("No prompts available in this board.", 'info'); return; }
      setPrompts(data);
      setActiveTab("prompts");
      setSelectedBoardId(id);
      setShowBoardModal(true);
    } catch {
      setNoPromptsBoard(id);
      showToast("No prompts available in this board.", 'info');
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
    setShowBoardDropdown(false);
  };
  const handleViewPromptsClick = () => setShowPromptsModal(true);
  const handleClosePromptsModal = () => { setShowPromptsModal(false); setCurrentPromptIndex(0); setSearchTerm(''); };
  const handlePromptClick = (prompt: Prompt) => { setNewPromptName(prompt.prompt_text); setShowPromptsModal(false); textareaRef.current?.focus(); };

  const selectedMainBoard = navItems.find(i => i.main_board_id === selectedMainBoardId)
    ?? navItems.find(i => selectedBoardId != null && selectedBoardId in i.boards);

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
    if (opening) {
      setIsDemoLoading(true);
      Promise.all([fetchDemoMainBoards(), fetchDemoBoards()]).finally(() => setIsDemoLoading(false));
      setCxoView("home");
      setHomeSection("demo");
    }
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
    // Backend sends `values` nested per category ([[..], [..]]) for true
    // multi-series charts, but flat ([..]) when there's only one series.
    const isNested = Array.isArray(values) && Array.isArray((values as number[][])[0]);
    return {
      labels,
      datasets: (categories || []).map((cat, i) => ({
        label: cat,
        data: isNested ? ((values as number[][])[i] ?? []) : (values as number[]),
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
      <style>{`
        .cxo-sidebar-nav::-webkit-scrollbar { width: 4px; }
        .cxo-sidebar-nav::-webkit-scrollbar-track { background: #e5e7eb; border-radius: 4px; }
        .cxo-sidebar-nav::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 4px; }
        .cxo-sidebar-nav::-webkit-scrollbar-thumb:hover { background: #2563eb; }
      `}</style>

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
        <nav className="cxo-sidebar-nav flex-1 py-2 px-2 flex flex-col gap-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3b82f6 #e5e7eb' }}>
          {/* Search bar */}
          {!isSidebarCollapsed && (
            <div className="relative mb-2">
              <input type="text" placeholder={t('sidebar.searchBoards')} value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                className="w-full py-1.5 pl-3 pr-7 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
              {sidebarSearch && (
                <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">×</button>
              )}
            </div>
          )}

          {/* search highlight helper */}
          {(() => {
            const q = sidebarSearch.trim().toLowerCase();
            const hl = (text: string) => {
              if (!q) return <span>{text}</span>;
              const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
              return (
                <span>
                  {parts.map((p, i) =>
                    p.toLowerCase() === q
                      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5 not-italic">{p}</mark>
                      : p
                  )}
                </span>
              );
            };

            // compute visible items based on search
            const dashboardVisible = !hideUsRestrictedTabs && (!q || 'dashboard'.includes(q));
            const liveDataVisible = !hideUsRestrictedTabs && (!q || 'live data'.includes(q));
            const demoMbFiltered = demoMainBoards.filter(mb => {
              if (!q) return true;
              if (mb.name.toLowerCase().includes(q)) return true;
              return demoBoards.some(b => b.main_board_id === mb.id && b.name.toLowerCase().includes(q));
            });
            const demoSectionVisible = !q || 'demo reference'.includes(q) || demoMbFiltered.length > 0;
            const navFiltered = navItems.filter(item => {
              if (!q) return true;
              if (item.name.toLowerCase().includes(q)) return true;
              return Object.values(item.boards).some(b => b.is_active && b.name.toLowerCase().includes(q));
            });

            return (
              <>
                {/* ── Dashboard ── */}
                {dashboardVisible && (
                  <button
                    onClick={() => setCxoView("dashboard")}
                    title="Dashboard"
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${cxoView === "dashboard" ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-blue-100"}`}
                  >
                    <span className="w-3 h-3 flex-shrink-0" />
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                    {!isSidebarCollapsed && <span className="ml-0.5">{hl("Dashboard")}</span>}
                  </button>
                )}

                {/* ── Live Data ── */}
                {liveDataVisible && (
                  <button
                    onClick={() => setCxoView("livedata")}
                    title="Live Data"
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${cxoView === "livedata" ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-blue-100"}`}
                  >
                    <span className="w-3 h-3 flex-shrink-0" />
                    <Database className="w-4 h-4 flex-shrink-0" />
                    {!isSidebarCollapsed && <span className="ml-0.5">{hl("Live Data")}</span>}
                  </button>
                )}

                {/* ── Demo Reference ── */}
                {demoSectionVisible && (
                  <div>
                    <button
                      onClick={toggleDemoRef}
                      title="Demo Reference"
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDemoRefOpen || q ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-blue-100"}`}
                    >
                      <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isDemoRefOpen || q ? "rotate-90" : ""}`} />
                      <Database className="w-4 h-4 flex-shrink-0" />
                      {!isSidebarCollapsed && <span className="ml-0.5">{hl("Demo Reference")}</span>}
                    </button>
                    {(isDemoRefOpen || !!q) && !isSidebarCollapsed && (
                      <div className="ml-3 mt-0.5 space-y-0.5">
                        {isDemoLoading ? (
                          <div className="text-xs text-gray-400 px-3 py-1">Loading...</div>
                        ) : demoMbFiltered.map(mb => {
                          const mbId = String(mb.id);
                          const mbMatches = mb.name.toLowerCase().includes(q);
                          const boardsForMb = demoBoards.filter(b => {
                            if (b.main_board_id !== mb.id) return false;
                            if (!q) return true;
                            return mbMatches || b.name.toLowerCase().includes(q);
                          });
                          const isExpMb = activeDemoMainBoard === mbId || (!!q && boardsForMb.some(b => b.name.toLowerCase().includes(q)));
                          return (
                            <div key={mbId}>
                              <button
                                onClick={() => setActiveDemoMainBoard(prev => prev === mbId ? null : mbId)}
                                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${isExpMb ? "bg-blue-400 text-white" : "text-gray-700 hover:bg-blue-50"}`}
                              >
                                <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isExpMb ? "rotate-90" : ""}`} />
                                <span className="truncate">{hl(mb.name)}</span>
                              </button>
                              {isExpMb && (
                                <div className="ml-5 mt-0.5 space-y-0.5">
                                  {boardsForMb.length === 0
                                    ? <div className="text-xs text-gray-400 px-2 py-1">No boards</div>
                                    : boardsForMb.map(board => (
                                        <button key={board.id}
                                          onClick={() => handleDemoBoardClick(board.id, mb.id, board.name)}
                                          disabled={boardCheckLoading === String(board.id)}
                                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors disabled:opacity-50 ${q && board.name.toLowerCase().includes(q) ? 'bg-yellow-50 text-yellow-900 hover:bg-yellow-100' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'}`}
                                        >
                                          {boardCheckLoading === String(board.id)
                                            ? <span className="flex items-center gap-1"><span className="animate-spin inline-block w-3 h-3 border-b border-blue-600 rounded-full" />Loading...</span>
                                            : hl(board.name)}
                                        </button>
                                      ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Mainboards (tree) ── */}
                {navFiltered.map(item => {
                  const mbId = item.main_board_id;
                  const mbMatches = item.name.toLowerCase().includes(q);
                  const activeBoards = Object.entries(item.boards).filter(([, b]) => {
                    if (!b.is_active) return false;
                    if (!q) return true;
                    return mbMatches || b.name.toLowerCase().includes(q);
                  });
                  const hasMatchingBoard = activeBoards.some(([, b]) => b.name.toLowerCase().includes(q));
                  const isExpMb = activeMainBoardInSidebar === mbId || (!!q && hasMatchingBoard);
                  return (
                    <div key={mbId}>
                      <button
                        onClick={() => setActiveMainBoardInSidebar(prev => prev === mbId ? null : mbId)}
                        title={item.name}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${isExpMb ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-blue-100"}`}
                      >
                        <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${isExpMb ? "rotate-90" : ""}`} />
                        <BarChart2 className="w-4 h-4 flex-shrink-0" />
                        {!isSidebarCollapsed && <span className="ml-0.5 truncate">{hl(boardNameMap[item.name] || item.name)}</span>}
                      </button>
                      {isExpMb && !isSidebarCollapsed && (
                        <div className="ml-5 mt-0.5 space-y-0.5">
                          {activeBoards.length === 0
                            ? <div className="text-xs text-gray-400 px-2 py-1">No boards</div>
                            : activeBoards.map(([boardId, board]) => (
                                <button key={boardId}
                                  onClick={() => handleBoardClick(boardId)}
                                  disabled={boardCheckLoading === boardId}
                                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors disabled:opacity-50 ${q && board.name.toLowerCase().includes(q) ? 'bg-yellow-50 text-yellow-900 hover:bg-yellow-100' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'}`}
                                >
                                  {boardCheckLoading === boardId
                                    ? <span className="flex items-center gap-1"><span className="animate-spin inline-block w-3 h-3 border-b border-blue-600 rounded-full" />Loading...</span>
                                    : hl(boardNameMap[board.name] || board.name)}
                                </button>
                              ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}

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
              onClick={() => { setCxoView("home"); setSelectedMainBoardId(null); toggleMobileMenu(); }}
              className={`w-full text-left py-2 px-3 text-sm rounded ${cxoView === "home" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-300"}`}
            >
              {t('header.home')}
            </button>
            <a href="/Consultant" className="block py-2 px-3 text-blue-600 text-sm hover:bg-gray-300 rounded">{t('header.consultant')}</a>
            <button onClick={handleLogout} className="w-full py-2 px-3 bg-blue-600 hover:bg-red-500 rounded text-white text-sm text-left">{t('header.logout')}</button>
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
            <a href="/Consultant" className="text-blue-500 text-sm font-medium hover:text-blue-700 transition-colors">{t('header.consultant')}</a>
            <a href="/CXO" className="text-blue-500 text-sm font-medium hover:text-blue-700 transition-colors">{t('header.cxo')}</a>
          </div>

          {/* Language selector + User info + settings */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Language Selector */}
            <LanguageSelector />

            <div className="flex items-center gap-3" ref={dropdownRef}>
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
                      {t('header.logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {cxoView === "dashboard" && !hideUsRestrictedTabs ? (
            <>
              <div className="mb-4">
                <button onClick={() => setCxoView("home")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-400 rounded-md hover:bg-blue-50 transition-colors">
                  {t('header.back')}
                </button>
              </div>
              <KPIDashboard />
            </>
          ) : cxoView === "livedata" && !hideUsRestrictedTabs ? (
            <LiveDataModal onClose={() => setCxoView("home")} />
          ) : (
            <div className="p-6">

              {/* ── Sub-navigation: Mainboard boards ── */}
              {selectedMainBoardId ? (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setSelectedMainBoardId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-400 rounded-md hover:bg-blue-50 transition-colors">
                      ← Back
                    </button>
                    <h2 className="text-sm font-bold text-gray-700">
                      {(() => { const n = navItems.find(i => i.main_board_id === selectedMainBoardId)?.name ?? "Boards"; return boardNameMap[n] || n; })()}
                    </h2>
                  </div>
                  <div className="grid grid-cols-4 gap-4 pb-3">
                    {Object.entries(navItems.find(i => i.main_board_id === selectedMainBoardId)?.boards ?? {})
                      .filter(([, b]) => b.is_active)
                      .map(([bid, board], idx) => {
                        const style = cardIconStyles[idx % cardIconStyles.length];
                        const isChecking = boardCheckLoading === bid;
                        return (
                          <button key={bid} onClick={() => handleBoardClick(bid)} disabled={isChecking}
                            className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all disabled:opacity-50 w-full">
                            <div className={`w-16 h-16 rounded-full ${style.bg} flex items-center justify-center`}>
                              {isChecking ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /> : <style.Icon className={`w-8 h-8 ${style.iconColor}`} />}
                            </div>
                            <span className={`text-sm font-semibold text-center ${style.textColor}`}>{boardNameMap[board.name] || board.name}</span>
                          </button>
                        );
                      })}
                  </div>
                </>

              ) : activeDemoMainBoard ? (
                /* ── Sub-navigation: Demo boards ── */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setActiveDemoMainBoard(null)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-400 rounded-md hover:bg-blue-50 transition-colors">
                      ← Back
                    </button>
                    <h2 className="text-sm font-bold text-gray-700">
                      {demoMainBoards.find(m => String(m.id) === activeDemoMainBoard)?.name ?? "Demo Boards"}
                    </h2>
                  </div>
                  <div className="grid grid-cols-4 gap-4 pb-3">
                    {demoBoards.filter(b => b.main_board_id === parseInt(activeDemoMainBoard)).map((board, idx) => {
                      const style = cardIconStyles[idx % cardIconStyles.length];
                      const isChecking = boardCheckLoading === String(board.id);
                      return (
                        <button key={board.id}
                          onClick={() => handleDemoBoardClick(board.id, parseInt(activeDemoMainBoard), board.name)}
                          disabled={isChecking}
                          className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all disabled:opacity-50 w-full">
                          <div className={`w-16 h-16 rounded-full ${style.bg} flex items-center justify-center`}>
                            {isChecking ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /> : <style.Icon className={`w-8 h-8 ${style.iconColor}`} />}
                          </div>
                          <span className={`text-sm font-semibold text-center ${style.textColor}`}>{board.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>

              ) : (
                /* ── Combined home: all tiles in one flat 4-column grid ── */
                <div className="grid grid-cols-4 gap-4 pb-3">

                  {/* Dashboard */}
                  {!hideUsRestrictedTabs && (
                    <button
                      onClick={() => setCxoView("dashboard")}
                      className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3 hover:shadow-md hover:border-teal-200 transition-all w-full"
                    >
                      <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
                        <LayoutDashboard className="w-8 h-8 text-teal-400" />
                      </div>
                      <span className="text-sm font-semibold text-center text-teal-500">Dashboard</span>
                    </button>
                  )}

                  {/* Live Data */}
                  {!hideUsRestrictedTabs && (
                    <button
                      onClick={() => setCxoView("livedata")}
                      className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all w-full"
                    >
                      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                        <Database className="w-8 h-8 text-blue-400" />
                      </div>
                      <span className="text-sm font-semibold text-center text-blue-500">Live Data</span>
                    </button>
                  )}

                  {/* Demo Reference tiles */}
                  {isDemoLoading ? (
                    <div className="text-xs text-gray-400 flex items-center">Loading...</div>
                  ) : (
                    demoMainBoards.map((mb, idx) => {
                      const style = cardIconStyles[(idx + 4) % cardIconStyles.length];
                      return (
                        <button key={mb.id} onClick={() => setActiveDemoMainBoard(String(mb.id))}
                          className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all w-full">
                          <div className={`w-16 h-16 rounded-full ${style.bg} flex items-center justify-center`}>
                            <style.Icon className={`w-8 h-8 ${style.iconColor}`} />
                          </div>
                          <span className={`text-sm font-semibold text-center ${style.textColor}`}>{mb.name}</span>
                        </button>
                      );
                    })
                  )}

                  {/* Mainboard tiles */}
                  {loading ? (
                    <div className="text-xs text-gray-400 flex items-center">Loading...</div>
                  ) : (
                    navItems.map((item, idx) => {
                      const style = cardIconStyles[idx % cardIconStyles.length];
                      return (
                        <button key={item.main_board_id} onClick={() => setSelectedMainBoardId(item.main_board_id)}
                          className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all w-full">
                          <div className={`w-16 h-16 rounded-full ${style.bg} flex items-center justify-center`}>
                            <style.Icon className={`w-8 h-8 ${style.iconColor}`} />
                          </div>
                          <span className={`text-sm font-semibold text-center ${style.textColor}`}>{boardNameMap[item.name] || item.name}</span>
                        </button>
                      );
                    })
                  )}

                </div>
              )}
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
                  <button onClick={() => setShowBoardDropdown(v => !v)}
                    className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-white" />
                  </button>
                  {showBoardDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 bg-white shadow-lg rounded-md border border-gray-100 min-w-[120px] z-[200]">
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
                        {runResult?.message?.length > 0
                          ? <p>{translatedCxoResultMessages.length > 0 ? translatedCxoResultMessages[0] : runResult.message[0]}</p>
                          : <p className="text-gray-400">No message found.</p>}
                      </div>
                    )}
                    {activeTab === 'table' && (
                      runResult.table?.columns?.length > 0 ? (
                      <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'auto', scrollbarColor: '#93c5fd #f1f1f1' }}>
                        <table className="min-w-full table-auto text-sm whitespace-nowrap border-collapse">
                          <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f3f4f6' }}>
                            <tr>
                              {runResult.table.columns.map((col, i) => (
                                <th key={i} className="px-3 py-2 border-b border-gray-200 text-left font-bold text-gray-700 text-xs uppercase tracking-wide">{translatedCxoResultColumns[i] || col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {runResult.table.data.length > 0
                              ? (translatedCxoResultData.length > 0 ? translatedCxoResultData : runResult.table.data).map((row, ri) => (
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

          {/* View Prompts — fixed to right edge, always horizontal */}
          <button
            onClick={handleViewPromptsClick}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xl transition-all px-4 py-2.5 rounded-l-lg whitespace-nowrap"
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
                {filteredPrompt.map((prompt: Prompt, index: number) => {
                  const isGenerated = cxoGeneratedPromptIds.has(String(prompt.id));
                  const gCount = filteredPrompt.slice(0, index).filter(p => cxoGeneratedPromptIds.has(String(p.id))).length + 1;
                  const nCount = filteredPrompt.slice(0, index).filter(p => !cxoGeneratedPromptIds.has(String(p.id))).length + 1;
                  const label = isGenerated ? `G${gCount}` : `${nCount}`;
                  return (
                    <div key={prompt.id || index} onClick={() => handlePromptClick(prompt)}
                      className={`border rounded-lg p-3 cursor-pointer hover:bg-blue-50 transition-colors ${isGenerated ? 'border-blue-300 hover:border-blue-500' : 'border-gray-100 hover:border-blue-200'}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-xs font-bold flex-shrink-0 ${isGenerated ? 'text-blue-600' : 'text-blue-500'}`}>{label}.</span>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-800 leading-snug">{translatedCxoTitles[prompt.id] || prompt.prompt_title}</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-3 leading-relaxed">{translatedCxoTexts[prompt.id] || prompt.prompt_text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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