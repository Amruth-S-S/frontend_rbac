"use client";

import { useEffect, useRef, useState, Suspense } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import Spinner from '../components/Spinner';
import { useRouter, useSearchParams } from 'next/navigation';
import { Settings, Menu, X, ChevronRight, Play, BarChart2, BookOpen, LayoutDashboard } from 'lucide-react';
import Image from 'next/image';
import loginImage from '../assets/logo.jpg';
import { FiMic } from "react-icons/fi";
import PptxGenJS from "pptxgenjs";
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

interface Prompt {
  id: string;
  prompt_text: string;
  prompt_title?: string;
  user_name?: string;
}

interface ChartDataFormat { labels?: string[]; categories?: string[]; values?: number[] | number[][]; }
interface ChartData { chart_type: string; data_format: ChartDataFormat; insight?: string[]; }
type RunResult = { message: string[]; table: { columns: string[]; data: string[][] }; charts: ChartData[]; };

interface UserData { email: string; userId: string; userRole: string; userName: string; }

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

function CXODemoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardId = searchParams.get("board_id");
  const mainBoardId = searchParams.get("main_board_id");

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  const [userData, setUserData] = useState<UserData>({ email: "", userId: "", userRole: "", userName: "" });
  const [isMounted, setIsMounted] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPrompts, setFilteredPrompts] = useState<Prompt[]>([]);

  const [newPromptName, setNewPromptName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRunClicked, setIsRunClicked] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [activeTab, setActiveTab] = useState('message');
  const [isListening, setIsListening] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [mainBoardName, setMainBoardName] = useState('');

  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'error' | 'info' }[]>([]);
  const textareaRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'error' | 'info' = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Auth guard
  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('currentUserData')) {
      router.replace('/Login');
    }
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      const s = sessionStorage.getItem('currentUserData');
      if (s) {
        const d = JSON.parse(s);
        setUserData({ email: d.email || "", userId: String(d.userId || ""), userRole: d.userRole || "", userName: d.userName || "" });
      }
    } catch {}
  }, [isMounted]);

  // Logo fetch
  useEffect(() => {
    if (!isMounted || !userData.userId) return;
    const fetchLogo = async () => {
      try {
        const cached = localStorage.getItem(`logo_cache_${userData.userId}`);
        if (cached) { const d = JSON.parse(cached); if (d.localUrl) setOrgLogoUrl(d.localUrl); }
        const metaRes = await fetch(`${API_BASE_URL}/api/logo/${userData.userId}`, { headers: { 'X-API-Key': EXCEL_API_KEY } });
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        if (!meta?.success || !meta?.logo) return;
        const blobRes = await fetch(`${API_BASE_URL}/api/logo/${userData.userId}/view`, { headers: { 'X-API-Key': EXCEL_API_KEY } });
        if (blobRes.ok) { const blob = await blobRes.blob(); if (blob.size > 0 && blob.type.startsWith('image/')) setOrgLogoUrl(URL.createObjectURL(blob)); }
      } catch {}
    };
    fetchLogo();
  }, [isMounted, userData.userId]);

  // Fetch prompts for this demo board
  useEffect(() => {
    if (!boardId || !mainBoardId) return;
    const fetchPrompts = async () => {
      setPromptsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/demo/prompts/board/${mainBoardId}/${boardId}`, { headers: { "X-API-Key": EXCEL_API_KEY } });
        if (!res.ok) return;
        const json = await res.json();
        const data: Prompt[] = Array.isArray(json) ? json : (json.data ?? json.items ?? []);
        setPrompts(data);
        setFilteredPrompts(data);
        // Try to get board name from first prompt or API
        if (data.length > 0) setBoardName(`Board ${boardId}`);
      } catch {}
      finally { setPromptsLoading(false); }
    };
    fetchPrompts();
  }, [boardId, mainBoardId]);

  // Filter prompts on search
  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredPrompts(prompts); return; }
    const q = searchTerm.toLowerCase();
    setFilteredPrompts(prompts.filter(p =>
      (p.prompt_title && p.prompt_title.toLowerCase().includes(q)) ||
      (p.prompt_text && p.prompt_text.toLowerCase().includes(q))
    ));
  }, [prompts, searchTerm]);

  const handleRunPrompt = async () => {
    setIsLoading(true);
    setIsRunClicked(true);
    if (!newPromptName?.trim()) { showToast("Please enter a valid prompt.", 'info'); setIsLoading(false); return; }
    if (!boardId) { showToast("Board ID is required.", 'info'); setIsLoading(false); return; }
    try {
      const url = new URL(`${API_BASE_URL}/demo/prompts/${boardId}/run`);
      url.searchParams.append("input_text", newPromptName.trim());
      url.searchParams.append("use_cache", "true");
      const response = await axios.post(url.href, null, { headers: { "X-API-Key": EXCEL_API_KEY } });
      if (response?.data) {
        setRunResult(response.data);
        setShowScrollTop(false);
        if (response.data.message?.length > 0) setActiveTab("message");
        else if (response.data.table?.columns?.length > 0) setActiveTab("table");
        else if (response.data.charts?.length > 0) setActiveTab("charts");
      } else { showToast("No data returned from the server."); }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) showToast(`Error: ${error.response?.data?.message || error.message}`);
      else showToast("An unknown error occurred.");
    } finally { setIsLoading(false); }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech Recognition not supported in this browser"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.start();
    setIsListening(true);
    recognition.onresult = (event: any) => { setNewPromptName(prev => prev + " " + event.results[0][0].transcript); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  const handleResultsScroll = () => {
    const el = scrollRef.current;
    if (el) setShowScrollTop(el.scrollTop > 200);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUserData');
    router.replace('/Login');
  };

  // Download Excel
  const downloadExcel = () => {
    if (!runResult?.table || runResult.table.data.length === 0) { showToast("No data to download.", 'info'); return; }
    const ws = XLSX.utils.aoa_to_sheet([runResult.table.columns, ...runResult.table.data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Table Data");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), "table_data.xlsx");
  };

  // Download PPT
  const downloadPPT = () => {
    try {
      const ppt = new PptxGenJS();
      const THEME = { primary: "2B579A", text: "2F3542", headerBackground: "F2F2F2", background: "FFFFFF" };
      ppt.defineSlideMaster({ title: "CLEAN", background: { color: THEME.background } });
      const titleSlide = ppt.addSlide({ masterName: "CLEAN" });
      titleSlide.addText("Demo Insights Report", { x: 0.5, y: 2.0, fontFace: "Arial", fontSize: 36, color: THEME.primary, bold: true, align: "center" });
      titleSlide.addText("Generated on " + new Date().toLocaleDateString(), { x: 0.5, y: 3.0, fontFace: "Arial", fontSize: 18, color: THEME.text, align: "center" });
      if (newPromptName.trim()) {
        const s = ppt.addSlide({ masterName: "CLEAN" });
        s.addText("Prompt", { x: 0.5, y: 0.7, fontSize: 20, color: THEME.primary, bold: true, fontFace: "Arial" });
        s.addText(newPromptName.trim(), { x: 0.5, y: 1.3, w: 8.5, h: 2, fontSize: 14, color: THEME.text, wrap: true, fontFace: "Arial", fill: { color: "EEF2FF" } });
      }
      if (runResult?.message?.length) {
        const s = ppt.addSlide({ masterName: "CLEAN" });
        s.addText("Message", { x: 0.5, y: 0.7, fontSize: 20, color: THEME.primary, bold: true, fontFace: "Arial" });
        s.addText(runResult.message[0] || '', { x: 0.5, y: 1.3, w: 8.5, h: 5, fontSize: 13, color: THEME.text, wrap: true, fontFace: "Arial" });
      }
      if (runResult?.table?.columns?.length) {
        const cols = runResult.table.columns;
        const rows = runResult.table.data.slice(0, 20);
        const header = cols.map(c => ({ text: c, bold: true, fill: THEME.headerBackground, color: THEME.primary, fontSize: 11, fontFace: "Arial" }));
        const dataRows = rows.map(row => row.map(cell => ({ text: String(cell || ''), fontSize: 10, fontFace: "Arial", color: THEME.text })));
        const s = ppt.addSlide({ masterName: "CLEAN" });
        s.addText("Table Data", { x: 0.5, y: 0.7, fontSize: 20, color: THEME.primary, bold: true, fontFace: "Arial" });
        s.addTable([header, ...dataRows], { x: 0.5, y: 1.3, w: 8.5, border: { pt: 0.5, color: "CFCFCF" }, colW: cols.map(() => 8.5 / cols.length), rowH: Array(dataRows.length + 1).fill(0.3) });
      }
      ppt.writeFile({ fileName: "CXO_Demo_Report.pptx" });
    } catch (e) { console.error(e); }
  };

  const getPieData = (chart: ChartData) => {
    const labels = chart.data_format?.labels || [];
    const values = chart.data_format?.values || [];
    return { labels, datasets: [{ data: values as number[], backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]), borderColor: '#fff', borderWidth: 2 }] };
  };

  const getChartData = (chart: ChartData, type: "bar" | "line") => {
    const { labels = [], categories, values = [] } = chart.data_format || {};
    return { labels, datasets: (categories || []).map((cat, i) => ({ label: cat, data: Array.isArray((values as number[][])[i]) ? (values as number[][])[i] : [], backgroundColor: type === 'bar' ? labels.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]) : CHART_COLORS[i % CHART_COLORS.length], borderColor: CHART_COLORS[i % CHART_COLORS.length], borderWidth: 2, fill: false, tension: 0.3 })) };
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-white text-sm ${t.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
            <span>⚠</span><span>{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-2 opacity-70 hover:opacity-100">×</button>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div className="hidden md:flex flex-col bg-white border-r border-gray-200 flex-shrink-0 w-60">
        {/* Logo */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 flex items-center justify-start">
            {orgLogoUrl
              ? <img src={orgLogoUrl} alt="Logo" className="max-h-9 object-contain" />
              : <div className="h-9 w-24 bg-gray-200 animate-pulse rounded" />}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 flex flex-col gap-1 overflow-y-auto">
          <a href="/CXO" className="flex items-center gap-3 px-2 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-medium">Back to CXO</span>
          </a>
          <div className="mt-3 px-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Demo Reference</p>
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-blue-50 text-blue-700">
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{boardName || `Board ${boardId}`}</span>
            </div>
          </div>
          {/* Prompts list in sidebar */}
          <div className="mt-3 px-2 flex-1 overflow-hidden flex flex-col">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Prompts</p>
            {promptsLoading ? (
              <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" /></div>
            ) : prompts.length === 0 ? (
              <p className="text-xs text-gray-400 px-1">No prompts available</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1">
                {prompts.map((p, i) => (
                  <button key={p.id || i} onClick={() => setNewPromptName(p.prompt_text)}
                    className="w-full text-left px-2 py-2 rounded-md text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                    <span className="font-medium text-blue-500">{i + 1}. </span>
                    <span className="line-clamp-2">{p.prompt_title || p.prompt_text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* User info */}
        <div className="px-3 py-3 border-t border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{userData.userName?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-gray-800 truncate">{userData.userName || 'User'}</p>
            <p className="text-[10px] text-gray-500 truncate">{userData.email}</p>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-md px-5 py-2.5 flex items-center gap-4 w-full z-30 sticky top-0">
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(v => !v)}><Menu className="w-5 h-5 text-gray-600" /></button>
          <div className="flex-1 flex justify-center gap-8">
            <a href="/Dashboard" className="text-blue-500 text-sm font-medium hover:text-blue-700">Consultant</a>
            <a href="/CXO" className="text-blue-500 text-sm font-medium hover:text-blue-700">CXO</a>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0" ref={dropdownRef}>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{userData.userName || 'User'}</p>
              <p className="text-xs text-gray-500 leading-tight">{userData.email}</p>
            </div>
            <div className="relative">
              <button onClick={() => setShowDropdown(v => !v)} className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center">
                <Settings className="w-4 h-4 text-white" />
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-full mt-1.5 bg-white shadow-lg rounded-md border border-gray-100 min-w-[120px] z-50">
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md">Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Breadcrumb */}
        <div className="px-6 py-2.5 flex items-center gap-1 text-xs text-gray-500 bg-white border-b border-gray-100">
          <a href="/CXO" className="text-blue-500 hover:underline font-medium">CXO</a>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium">Demo Reference</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700 font-semibold">{boardName || `Board ${boardId}`}</span>
        </div>

        {/* Back + Clear bar */}
        <div className="mx-5 mt-3 mb-2 flex items-center justify-end gap-2">
          <button onClick={() => router.back()} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 bg-white">← Back</button>
          <button onClick={() => { setNewPromptName(""); setRunResult(null); setIsRunClicked(false); setShowScrollTop(false); }} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md border border-red-200">Clear</button>
        </div>

        {/* Prompt toolbar */}
        <div className="mx-5 mb-4 bg-[#1a237e] rounded-xl flex items-center px-3 py-2 gap-3 shadow-lg">
          <input
            ref={textareaRef}
            className="flex-1 bg-white text-gray-800 placeholder-gray-400 text-sm outline-none min-w-0 rounded-lg px-3 py-2"
            placeholder="Dynamic Prompt Entry..."
            value={newPromptName}
            onChange={e => setNewPromptName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRunPrompt(); } }}
          />
          <button onClick={handleVoiceInput} title="Click to speak"
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${isListening ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
            <FiMic className="text-white text-lg" />
          </button>
          <button onClick={() => setShowPromptsModal(true)}
            className="flex-shrink-0 px-3 py-1.5 bg-white text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-50 border border-blue-200">
            View Prompts
          </button>
          <button onClick={handleRunPrompt} disabled={!newPromptName.trim() || isLoading}
            className="flex-shrink-0 p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg disabled:opacity-50 transition-colors">
            {isLoading ? <Spinner /> : <Play className="w-4 h-4" />}
          </button>
        </div>

        {/* Results area */}
        <div ref={scrollRef} onScroll={handleResultsScroll} className="flex-1 overflow-y-auto px-5 pb-20">
          {isRunClicked && runResult && (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {['message', 'table', 'charts'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded text-sm font-medium ${activeTab === tab ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
                <div className="ml-auto flex gap-2">
                  <button onClick={downloadExcel} className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded">Download Excel</button>
                  <button onClick={downloadPPT} className="px-3 py-1.5 text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white rounded">Download PPT</button>
                </div>
              </div>

              {/* Message tab */}
              {activeTab === 'message' && (
                <div className="text-sm text-gray-700 p-4 bg-white rounded-xl shadow-sm">
                  {runResult.message?.length > 0 ? <p>{runResult.message[0]}</p> : <p className="text-gray-400">No message found.</p>}
                </div>
              )}

              {/* Table tab */}
              {activeTab === 'table' && (
                runResult.table?.columns?.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'thin', scrollbarColor: '#313b96 #f1f1f1' }}>
                    <table className="min-w-full table-auto text-sm whitespace-nowrap border-collapse">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f3f4f6' }}>
                        <tr>{runResult.table.columns.map((col, i) => <th key={i} className="px-3 py-2 border-b border-gray-200 text-left font-bold text-gray-700 text-xs uppercase tracking-wide">{col}</th>)}</tr>
                      </thead>
                      <tbody>
                        {runResult.table.data.length > 0
                          ? runResult.table.data.map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                              {row.map((cell, ci) => <td key={ci} className="px-3 py-2 border-b border-gray-100 text-gray-700 text-sm">{cell}</td>)}
                            </tr>))
                          : <tr><td colSpan={runResult.table.columns.length} className="text-center p-3 text-gray-400">No data available.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="text-sm text-gray-400 p-4 bg-white rounded-xl shadow-sm">No table data found.</div>
              )}

              {/* Charts tab */}
              {activeTab === 'charts' && (
                runResult.charts && runResult.charts.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-6">
                    {runResult.charts.map((chart, i) => {
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
                ) : <div className="text-sm text-gray-400 p-4 bg-white rounded-xl shadow-sm">No charts found.</div>
              )}
            </div>
          )}

          {/* Scroll to top */}
          {showScrollTop && (
            <button onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-full shadow-lg z-50">
              ↑ Top
            </button>
          )}
        </div>
      </div>

      {/* Prompts Modal */}
      {showPromptsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800">Prompts</h4>
              <button onClick={() => { setShowPromptsModal(false); setSearchTerm(''); }} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
            </div>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="relative">
                <input type="text" placeholder="Search prompts..." value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full py-1.5 px-3 pr-7 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">×</button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {promptsLoading ? (
                <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" /></div>
              ) : filteredPrompts.length === 0 ? (
                <div className="text-center text-gray-400 text-xs p-3">
                  {searchTerm ? `No prompts found for "${searchTerm}"` : 'No prompts available.'}
                  {searchTerm && <button onClick={() => setSearchTerm('')} className="block mx-auto mt-1 text-blue-600 hover:underline">Clear</button>}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPrompts.map((prompt, index) => (
                    <div key={prompt.id || index}
                      onClick={() => { setNewPromptName(prompt.prompt_text); setShowPromptsModal(false); setSearchTerm(''); textareaRef.current?.focus(); }}
                      className="border border-gray-100 rounded-lg p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                      <span className="text-xs font-bold text-blue-500">{index + 1}. </span>
                      <span className="text-xs font-semibold text-gray-800">{prompt.prompt_title || ''}</span>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-3">{prompt.prompt_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CXODemoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <CXODemoContent />
    </Suspense>
  );
}
