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
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import loginImage from '../assets/logo.jpg';

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

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

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

  const handleRunPrompt = async () => {
    setIsLoading(true);
    setIsRunClicked(true);
    if (!newPromptName?.trim()) { alert("Please enter a valid prompt."); setIsLoading(false); return; }
    if (!selectedBoardId) { alert("Board ID is required."); setIsLoading(false); return; }
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
      } else { alert("No data was returned from the server."); }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) alert(`Server Error (${error.response?.status || "Unknown"}): ${error.response?.data?.message || error.message}`);
      else if (error instanceof Error) alert(`Error: ${error.message}`);
      else alert("An unknown error occurred.");
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
  const handleBoardClick = (id: string) => { setActiveTab("prompts"); setSelectedBoardId(id); setShowBoardModal(true); };
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
    router.push('/');
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
      if (axios.isAxiosError(error)) alert(`Server Error (${error.response?.status || 'Unknown'}): ${error.response?.data?.message || error.message}`);
      else if (error instanceof Error) alert(`Error: ${error.message}`);
      else alert('An unknown error occurred.');
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

  const getPieData = (chartData: ChartData) => {
    if (!chartData?.data_format) return { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
    const { labels, values } = chartData.data_format;
    return { labels, datasets: [{ data: values as number[], backgroundColor: labels.map(() => getRandomColor()) }] };
  };

  const getChartData = (chartData: ChartData, type: "bar" | "line") => {
    if (!chartData?.data_format) return { labels: [], datasets: [] };
    const { labels, categories, values } = chartData.data_format;
    return { labels, datasets: (categories || []).map((cat, i) => ({ label: cat, data: (values as number[][]).map(v => v[i]), backgroundColor: getRandomColor() })) };
  };

  const getRandomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className={`hidden md:block bg-gray-100 border-r border-gray-200 transition-all duration-300 ${isSidebarOpen ? 'w-44' : 'w-12'}`}>
        <div className="p-2 flex items-center justify-center">
          {isSidebarOpen ? (
            <Image src={loginImage} alt="Logo" width={130} height={130} className="rounded-md" />
          ) : (
            <Image src={loginImage} alt="Logo" width={32} height={32} className="rounded-md" />
          )}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={toggleSidebar} />
      )}

      {/* Mobile Sidebar */}
      <div className={`md:hidden fixed top-0 left-0 h-full bg-gray-200 z-50 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-60`}>
        <div className="p-3">
          <div className="flex justify-between items-center mb-3">
            <Image src={loginImage} alt="Logo" width={130} height={130} className="rounded-md" />
            <button onClick={toggleSidebar} className="p-1.5"><X className="w-5 h-5" /></button>
          </div>
          <nav className="mt-4 space-y-1.5">
            <a href="/Dashboard" className="block py-2 px-3 text-blue-700 text-sm hover:bg-gray-300 rounded" onClick={toggleSidebar}>Consultant Role</a>
            <a href="/CXO" className="block py-2 px-3 text-blue-700 text-sm hover:bg-gray-300 rounded" onClick={toggleSidebar}>CXO Role</a>
            <button onClick={handleLogout} className="w-full py-2 px-3 bg-blue-600 hover:bg-red-400 rounded text-white text-sm text-left">Logout</button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-gray-100 border-b border-gray-200 py-1.5 px-3 flex justify-between items-center">
          <button className="md:hidden p-1" onClick={toggleSidebar}>
            <Menu className="w-4 h-4" />
          </button>
          <div className="hidden md:flex flex-1 justify-center gap-6">
            <a href="/Dashboard" className="text-blue-600 text-xs font-medium hover:underline">Consultant Role</a>
            <a href="/CXO" className="text-blue-600 text-xs font-medium hover:underline">CXO Role</a>
          </div>
          <div className="md:hidden flex-1 flex justify-center">
            <button onClick={toggleMobileMenu} className="text-blue-600 text-xs font-medium">Menu</button>
          </div>
          <div className="hidden md:block">
            <button onClick={handleLogout} className="py-1 px-3 bg-blue-600 hover:bg-red-500 rounded text-white text-xs transition-colors">Logout</button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-4">
          {!selectedMainBoardId ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {navItems.map(item => (
                <div
                  key={item.main_board_id}
                  onClick={() => handleMainBoardClick(item.main_board_id)}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200 flex items-center justify-center text-center p-4 min-h-[80px]"
                >
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                </div>
              ))}
            </div>
          ) : selectedMainBoard && (
            <div>
              <div className="flex items-center gap-1.5 text-xs mb-4">
                <span className="text-blue-600 hover:underline cursor-pointer font-medium" onClick={handleBackClick}>Home</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-700 font-medium">{selectedMainBoard.name}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Object.keys(selectedMainBoard.boards)
                  .filter(bid => selectedMainBoard.boards[bid].is_active)
                  .map(bid => (
                    <div
                      key={bid}
                      onClick={() => handleBoardClick(bid)}
                      className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200 flex items-center justify-center text-center p-4 min-h-[80px]"
                    >
                      <span className="text-sm font-medium text-gray-700">{selectedMainBoard.boards[bid].name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Board Modal - Full Screen */}
          {showBoardModal && (
            <div className="fixed inset-0 bg-white z-50 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-base font-semibold text-gray-800">Run Your Prompt</h3>
                <button
                  onClick={handleCloseBoardModal}
                  className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-bold transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Dynamic Prompt Entry..."
                  value={newPromptName}
                  rows={8}
                  ref={textareaRef}
                  onChange={e => setNewPromptName(e.target.value)}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700" onClick={handleViewPromptsClick}>View Prompts</button>
                  <button onClick={handleRePrompt} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50" disabled={isLoading}>
                    Reprompt {isLoading && <Spinner />}
                  </button>
                  <button onClick={handleRunPrompt} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50" disabled={!newPromptName.trim() || isLoading}>
                    {isLoading ? "Running..." : "Run"}
                  </button>
                </div>

                {isRunClicked && runResult && (
                  <div className="mt-4">
                    <div className="flex justify-end gap-2 mb-3">
                      {['message', 'table', 'charts'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                          className={`px-4 py-1.5 rounded text-sm font-medium ${activeTab === tab ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div>
                      {activeTab === 'message' && (
                        <div className="text-sm text-gray-700 p-3 bg-gray-50 rounded">
                          {runResult?.message?.length > 0 ? <p>{runResult.message[0]}</p> : <p className="text-gray-400">No message found.</p>}
                        </div>
                      )}
                      {activeTab === 'table' && runResult.table?.columns?.length > 0 && (
                        <div className="overflow-auto border border-gray-200 rounded">
                          <table className="min-w-full table-auto text-sm">
                            <thead className="bg-gray-50">
                              <tr>{runResult.table.columns.map((col, i) => <th key={i} className="px-3 py-2 border-b text-left font-medium text-gray-600">{col}</th>)}</tr>
                            </thead>
                            <tbody>
                              {runResult.table.data.length > 0
                                ? runResult.table.data.map((row, ri) => <tr key={ri} className="hover:bg-gray-50">{row.map((cell, ci) => <td key={ci} className="px-3 py-2 border-b text-gray-700">{cell}</td>)}</tr>)
                                : <tr><td colSpan={runResult.table.columns.length} className="text-center p-3 text-gray-400">No data available.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {activeTab === 'charts' && runResult.charts && (
                        <div className="flex flex-wrap justify-center gap-6 my-2">
                          {runResult.charts.map((chart: ChartData, i: number) => {
                            if (chart.chart_type === 'pie') return (
                              <div key={i} className="w-full max-w-[400px] flex-1">
                                <h5 className="text-sm font-semibold text-center mb-2">Pie Chart</h5>
                                <div style={{ height: "350px" }}><Pie data={getPieData(chart)} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: "top" } } }} /></div>
                                <div className="mt-2 p-3 bg-gray-100 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>
                              </div>
                            );
                            if (chart.chart_type === 'bar') return (
                              <div key={i} className="w-full max-w-[500px] flex-1">
                                <h5 className="text-sm font-semibold text-center mb-2">Bar Chart</h5>
                                <div style={{ height: "350px" }}><Bar data={getChartData(chart, 'bar')} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: "top" } }, scales: { y: { beginAtZero: true } } }} /></div>
                                <div className="mt-2 p-3 bg-gray-100 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>
                              </div>
                            );
                            if (chart.chart_type === 'line') return (
                              <div key={i} className="w-full max-w-[500px] flex-1">
                                <h5 className="text-sm font-semibold text-center mb-2">Line Chart</h5>
                                <div style={{ height: "350px" }}><Line data={getChartData(chart, 'line')} options={{ maintainAspectRatio: false, plugins: { legend: { display: true, position: "top" } }, scales: { y: { beginAtZero: true } } }} /></div>
                                <div className="mt-2 p-3 bg-gray-100 rounded text-xs"><ul className="list-disc list-inside">{chart.insight.map((ins, j) => <li key={j}>{ins}</li>)}</ul></div>
                              </div>
                            );
                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompts Sidebar Modal (CSS styles) */}
          {showPromptsModal && (
            <div className={styles.modalOverlay}>
              <div className={`${styles.promptsModal} ${styles.slideInLeft}`}>
                <div className={styles.modalHeader}>
                  <button className={styles.closeButton} onClick={handleClosePromptsModal}>×</button>
                </div>
                <div className={styles.modalContent}>
                  <div className={styles.searchContainer}>
                    <input type="text" placeholder="Search prompts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.searchInput} />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className={styles.clearSearchButton}>×</button>}
                  </div>
                  {promptsLoading ? (
                    <div className={styles.loadingOverlay}><div className={styles.spinner}></div></div>
                  ) : error ? (
                    <div className={styles.error}>{error}</div>
                  ) : filteredPrompt.length === 0 ? (
                    <div className={styles.noResults}>
                      {searchTerm ? `No prompts found for "${searchTerm}"` : "No prompts found for this board."}
                      {searchTerm && <button onClick={() => setSearchTerm('')} className={styles.clearSearchLink}>Clear search</button>}
                    </div>
                  ) : (
                    <div className={styles.promptContainer}>
                      {searchTerm && (
                        <div className={styles.searchResultsInfo}>
                          <span>Found {filteredPrompt.length} prompt{filteredPrompt.length !== 1 ? 's' : ''} for "{searchTerm}"</span>
                          <button onClick={() => setSearchTerm('')} className={styles.clearSearchLink}>Clear search</button>
                        </div>
                      )}
                      <div className={styles.scrollablePrompts}>
                        {filteredPrompts.map((prompt: Prompt, index: number) => (
                          <div key={prompt.id || index} className={styles.promptCard} onClick={() => handlePromptClick(prompt)}>
                            <div className={styles.promptNumber}>{index + 1}.</div>
                            <h4>{prompt.prompt_title}</h4>
                            <p>{prompt.prompt_text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Prompts Modal (Tailwind) */}
          {showPromptsModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
              <div className="bg-white rounded-lg w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="border-b px-3 py-2 flex justify-between items-center">
                  <h3 className="text-sm font-semibold">Prompts</h3>
                  <button className="text-gray-500 hover:text-gray-700 text-lg leading-none" onClick={handleClosePromptsModal}>×</button>
                </div>
                <div className="px-3 pt-2 pb-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search prompts..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full py-1 px-2.5 pr-8 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">×</button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-3">
                  {promptsLoading ? (
                    <div className="flex justify-center items-center h-24">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : error ? (
                    <div className="text-red-500 text-center text-xs p-3">{error}</div>
                  ) : filteredPrompt.length === 0 ? (
                    <div className="text-center text-gray-400 text-xs p-3">
                      {searchTerm ? `No prompts found for "${searchTerm}"` : "No prompts found for this board."}
                      {searchTerm && <button onClick={() => setSearchTerm('')} className="block mx-auto mt-1.5 text-blue-600 hover:underline">Clear search</button>}
                    </div>
                  ) : (
                    <div className="space-y-1.5 mt-1.5">
                      {filteredPrompts.map((prompt: Prompt, index: number) => (
                        <div
                          key={prompt.id || index}
                          className="border rounded-md p-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => handlePromptClick(prompt)}
                        >
                          <div className="flex items-start gap-1.5">
                            <span className="font-semibold text-gray-500 text-xs flex-shrink-0">{index + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-800 text-xs mb-0.5 truncate">{prompt.prompt_title}</h4>
                              <p className="text-[11px] text-gray-500 line-clamp-2">{prompt.prompt_text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}