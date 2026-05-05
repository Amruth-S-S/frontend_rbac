"use client";

import { useEffect, useRef, useState } from 'react';
import styles from '../CXO/CXO.module.css';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
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
import Spinner from '../components/Spinner';
import { useRouter } from 'next/navigation';
import { Menu, X, Settings, BarChart2, FileText, PieChart, TrendingUp, Database, Users, LayoutDashboard, BookOpen, Mic, Play, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import loginImage from '../assets/logo.jpg';
import { FiMic } from "react-icons/fi";


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
  const [noPromptsBoard, setNoPromptsBoard] = useState<string | null>(null);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState("prompts");
  const [, setShowCharts] = useState(false);
  const [isRunClicked, setIsRunClicked] = useState(false);
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    insight: string[];
  }

  interface ChartDataFormat {
    labels: string[];
    categories?: string[];
    values: number[] | number[][];
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
    if (!selectedBoardId) { showToast("Board ID is required.", 'info'); setIsLoading(false); return; }
    try {
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
  const handleBackClick = () => { setActiveTab("prompts"); setSelectedMainBoardId(null); setNoPromptsBoard(null); };
  const handleBoardClick = async (id: string) => {
    setBoardCheckLoading(id);
    setNoPromptsBoard(null);
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
  const handleCloseBoardModal = () => { setShowBoardModal(false); setSelectedBoardId(null); setActiveTab("prompts"); setSelectedPrompt(null); setNewPromptName(''); setIsRunClicked(false); };
  const handleViewPromptsClick = () => setShowPromptsModal(true);
  const handleClosePromptsModal = () => { setShowPromptsModal(false); setCurrentPromptIndex(0); setSearchTerm(''); };
  const handlePromptClick = (prompt: Prompt) => { setNewPromptName(prompt.prompt_text); setShowPromptsModal(false); textareaRef.current?.focus(); };

  const selectedMainBoard = navItems.find(i => i.main_board_id === selectedMainBoardId);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('currentUserData');
      ['loggedInUserEmail','loggedInUserId','loggedInUserRole','loggedInUserName','client_user_id'].forEach(k => localStorage.removeItem(k));
    }
    router.push('/Login');
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

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
    const { labels, values } = chartData.data_format;
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
    const { labels, categories, values } = chartData.data_format;
    return {
      labels,
      datasets: (categories || []).map((cat, i) => ({
        label: cat,
        data: (values as number[][])[i],
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

  const PromptsPanel = () => (
    <>
      {showPromptsModal && (
        <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-[60] transition-transform duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <h4 className="text-sm font-semibold text-gray-800">Prompts</h4>
            <button onClick={handleClosePromptsModal} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
          </div>
          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <input type="text" placeholder="Search prompts..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full py-1.5 px-3 pr-7 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">×</button>
              )}
            </div>
          </div>
          {/* List */}
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
                {filteredPrompts.map((prompt: Prompt, index: number) => (
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
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* Sidebar with logo */}
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
            <a href="/Dashboard" className="block py-2 px-3 text-blue-600 text-sm hover:bg-gray-300 rounded">Consultant</a>
            <a href="/CXO" className="block py-2 px-3 text-blue-600 text-sm hover:bg-gray-300 rounded">CXO</a>
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
            <a href="/Dashboard" className="text-blue-500 text-sm font-medium hover:text-blue-700 transition-colors">Consultant</a>
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
          {!selectedMainBoardId ? (
            navItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <p className="text-sm font-medium">No boards found.</p>
                <p className="text-xs mt-1">No prompts are available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {navItems.map((item, idx) => {
                  const style = cardIconStyles[idx % cardIconStyles.length];
                  return (
                    <div
                      key={item.main_board_id}
                      onClick={() => handleMainBoardClick(item.main_board_id)}
                      className="bg-white rounded-2xl shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col items-center justify-center p-8 gap-4 border border-gray-100 hover:border-blue-200"
                    >
                      <div className={`${style.bg} rounded-2xl p-5`}>
                        <style.Icon className={`w-10 h-10 ${style.iconColor}`} />
                      </div>
                      <span className={`text-sm font-semibold italic ${style.textColor}`}>{item.name}</span>
                    </div>
                  );
                })}
              </div>
            )
          ) : selectedMainBoard && (
            <div>
              <div className="flex items-center gap-1.5 text-xs mb-6">
                <span className="text-blue-600 hover:underline cursor-pointer font-medium" onClick={handleBackClick}>Home</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-700 font-medium">{selectedMainBoard.name}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {Object.keys(selectedMainBoard.boards)
                  .filter(bid => selectedMainBoard.boards[bid].is_active)
                  .map((bid, idx) => {
                    const style = cardIconStyles[idx % cardIconStyles.length];
                    const isChecking = boardCheckLoading === bid;
                    const hasNoPrompts = noPromptsBoard === bid;
                    return (
                      <div
                        key={bid}
                        onClick={() => !isChecking && handleBoardClick(bid)}
                        className={`bg-white rounded-2xl shadow-sm transition-all duration-200 flex flex-col items-center justify-center p-8 gap-4 border relative ${
                          hasNoPrompts
                            ? 'border-red-200 bg-red-50 cursor-not-allowed'
                            : isChecking
                            ? 'border-blue-200 cursor-wait opacity-70'
                            : 'hover:shadow-md cursor-pointer border-gray-100 hover:border-blue-200'
                        }`}
                      >
                        {isChecking && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                          </div>
                        )}
                        <div className={`${hasNoPrompts ? 'bg-red-100' : style.bg} rounded-2xl p-5`}>
                          <style.Icon className={`w-10 h-10 ${hasNoPrompts ? 'text-red-400' : style.iconColor}`} />
                        </div>
                        <span className={`text-sm font-semibold italic ${hasNoPrompts ? 'text-red-500' : style.textColor}`}>
                          {selectedMainBoard.boards[bid].name}
                        </span>
                        {hasNoPrompts && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 border border-red-200 rounded-lg">
                            <span className="text-xs text-red-600 font-medium text-center">No prompts available in this board</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
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
                <a href="/Dashboard" className="text-blue-500 text-sm font-medium hover:text-blue-700">Consultant</a>
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
              <span onClick={handleCloseBoardModal} className="text-blue-500 hover:underline cursor-pointer font-medium">Home</span>
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
                className="px-3 py-1.5  bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium whitespace-nowrap"
              >
                <FiMic className="text-white text-lg" />
              </button>
              {/* <button className="text-blue-200 hover:text-white p-1 flex-shrink-0">
                <Mic className="w-4 h-4" />
              </button> */}
              <button
                onClick={handleRePrompt}
                disabled={isLoading}
                className="flex-shrink-0 px-3 py-1.5 bg-rose-400 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                Re Prompt
              </button>
              <button
                onClick={handleRunPrompt}
                disabled={!newPromptName.trim() || isLoading}
                className="flex-shrink-0 p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {isLoading ? <Spinner /> : <Play className="w-4 h-4" />}
              </button>
              {/* <button className="flex-shrink-0 px-3 py-1.5 bg-[#0d1b6e] hover:bg-[#0a1560] text-white rounded-lg text-xs font-semibold transition-colors">
                Save
              </button> */}
            </div>

            {/* Results area */}
            <div ref={scrollRef} onScroll={handleResultsScroll} className="flex-1 overflow-y-auto px-5 pb-20">
              {isRunClicked && runResult && (
                <div>
                  <div className="flex gap-2 mb-3">
                    {['message', 'table', 'charts'].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-1.5 rounded text-sm font-medium ${activeTab === tab ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div>
                    {activeTab === 'message' && (
                      <div className="text-sm text-gray-700 p-4 bg-white rounded-xl shadow-sm">
                        {runResult?.message?.length > 0 ? <p>{runResult.message[0]}</p> : <p className="text-gray-400">No message found.</p>}
                      </div>
                    )}
                    {activeTab === 'table' && runResult.table?.columns?.length > 0 && (
                      <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'thin', scrollbarColor: '#313b96 #f1f1f1' }}>
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
                    )}
                    {activeTab === 'charts' && runResult.charts && (
                      <div className="flex flex-wrap justify-center gap-6">
                        {runResult.charts.map((chart: ChartData, i: number) => {
                          if (chart.chart_type === 'pie') return (
                            <div key={i} className="w-full max-w-[400px] flex-1 bg-white rounded-xl shadow-sm p-4">
                              <h5 className="text-sm font-semibold text-center mb-2">Pie Chart</h5>
                              <div style={{ height: '350px' }}><Pie data={getPieData(chart)} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } } }} /></div>
                              <div className="mt-2 p-3 bg-gray-50 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>
                            </div>
                          );
                          if (chart.chart_type === 'bar') return (
                            <div key={i} className="w-full max-w-[500px] flex-1 bg-white rounded-xl shadow-sm p-4">
                              <h5 className="text-sm font-semibold text-center mb-2">Bar Chart</h5>
                              <div style={{ height: '350px' }}><Bar data={getChartData(chart, 'bar')} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true } } }} /></div>
                              <div className="mt-2 p-3 bg-gray-50 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>
                            </div>
                          );
                          if (chart.chart_type === 'line') return (
                            <div key={i} className="w-full max-w-[500px] flex-1 bg-white rounded-xl shadow-sm p-4">
                              <h5 className="text-sm font-semibold text-center mb-2">Line Chart</h5>
                              <div style={{ height: '350px' }}><Line data={getChartData(chart, 'line')} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' } }, scales: { y: { beginAtZero: true } } }} /></div>
                              <div className="mt-2 p-3 bg-gray-50 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>
                            </div>
                          );
                          return null;
                        })}
                      </div>
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

          {/* View Prompts — fixed to right edge, vertically centered, horizontal text */}
          <button
            onClick={handleViewPromptsClick}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-[60] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xl transition-colors px-4 py-2.5 rounded-2-lg"
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
      <PromptsPanel />

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