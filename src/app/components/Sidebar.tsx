"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useSWR from "swr";
import Link from 'next/link';
import {
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  X,
  User,
  NotebookText,
  Edit3,
  Upload,
  Menu,
  Settings,
  LogOut,
  ChartColumnDecreasing,
  Search,
  Eye,
  EyeOff
} from 'lucide-react';
import './Toast.css';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ─── Interfaces ────────────────────────────────────────────────────────────────
interface Board {
  name: string;
  is_active: boolean;
  path?: string;
}

interface MainBoard {
  id(id: string): React.Key | null | undefined;
  main_board_id: string;
  name: string;
  boards: { [key: string]: Board };
}

type SelectedBoard = {
  mainBoardId: string;
  boardId?: string;
  boardName?: string;
} | null;

interface SidebarProps {
  clientUserId: string | number;
}

interface UserData {
  email: string;
  userId: string;
  userRole: string;
  userName: string;
}

// ─── Global Loader Component ────────────────────────────────────────────────────
const GlobalLoader = ({ message = "Loading..." }: { message?: string }) => (
  <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-24 h-24">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * 360;
          const rad = (angle * Math.PI) / 180;
          const x = 50 + 40 * Math.sin(rad);
          const y = 50 - 40 * Math.cos(rad);
          return (
            <div
              key={i}
              className="absolute w-2.5 h-2.5 rounded-full bg-white"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                opacity: 0.2 + (i / 12) * 0.8,
                animation: `spin-dot 1.2s linear infinite`,
                animationDelay: `${-(12 - i) * (1.2 / 12)}s`,
              }}
            />
          );
        })}
      </div>
      <p className="mt-4 text-white text-base font-medium tracking-wide animate-pulse">
        {message}
      </p>
    </div>
    <style>{`
      @keyframes spin-dot {
        0% { opacity: 0.2; }
        50% { opacity: 1; }
        100% { opacity: 0.2; }
      }
    `}</style>
  </div>
);

// ─── Main Sidebar Component ─────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({ }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Mobile
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Logo
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [logoDescription, setLogoDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);

  // Settings / Password
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [loadingMainBoard, setLoadingMainBoard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Board states
  const [newBoardName, setNewBoardName] = useState('');
  const [customerDbKey, setCustomerDbKey] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);

  const [selectedBoard, setSelectedBoard] = useState<SelectedBoard>(null);
  const [navItems, setNavItems] = useState<MainBoard[]>([]);
  const [activeMainBoard, setActiveMainBoard] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mainBoardName, setMainBoardName] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [, setMainBoardId] = useState(null);

  // ── Global Loading State ──────────────────────────────────────────────────────
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("Loading...");

  const showGlobalLoader = (msg: string) => {
    setGlobalLoadingMessage(msg);
    setGlobalLoading(true);
  };
  const hideGlobalLoader = () => setGlobalLoading(false);

  const [deletingBoards, setDeletingBoards] = useState<{ [key: string]: boolean }>({});

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [userData, setUserData] = useState<UserData>({ email: "", userId: "", userRole: "", userName: "" });
  const [isMounted, setIsMounted] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [confirmation, setConfirmation] = useState({ isOpen: false, message: '', boardId: '', mainBoardId: '' });

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  // ─── Password Update ──────────────────────────────────────────────────────────
  const handlePasswordUpdate = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill in all password fields'); return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New password and confirm password do not match'); return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long'); return;
    }
    setIsUpdatingPassword(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password?user_id=${userData.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': EXCEL_API_KEY },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword,
          confirm_password: passwordData.confirmPassword,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Password updated successfully!');
        setIsSettingsModalOpen(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to update password');
      }
    } catch {
      toast.error('An error occurred while updating password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSettingsClick = () => { setIsSettingsModalOpen(true); setShowUserDropdown(false); closeMobileMenu(); };
  const handleUpdatePasswordClick = () => setIsPasswordModalOpen(true);

  // ─── Mobile ──────────────────────────────────────────────────────────────────
  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) { setIsSidebarOpen(false); setSidebarWidth(0); }
      else { setIsSidebarOpen(true); setSidebarWidth(320); setIsMobileMenuOpen(false); }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    document.body.style.overflow = (isMobile && isMobileMenuOpen) ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobile, isMobileMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && isMobileMenuOpen && sidebarRef.current &&
        !(sidebarRef.current as HTMLElement).contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isMobileMenuOpen]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => { if (isMobile) setIsMobileMenuOpen(false); };

  // ─── Admin nav items ──────────────────────────────────────────────────────────
  const adminNavigationItems = [
    { id: 'users', label: 'User', href: '/UserList' },
    { id: 'roles', label: 'Role', href: '/RoleList' },
    { id: 'board-assignment', label: 'Assign Boards to Roles', href: '/BoardRoleAssignment' },
    { id: 'user-assignment', label: 'Assign User to Roles', href: '/UserRoleAssignment' }
  ];

  // ─── Search filtering ─────────────────────────────────────────────────────────
  const filteredNavItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const query = searchQuery.toLowerCase();
    const matchingMainBoards = new Set<string>();
    return navItems.map(item => {
      const mainBoardMatches = item.name.toLowerCase().includes(query);
      const matchingBoards: { [key: string]: Board } = {};
      let hasBoardMatches = false;
      Object.entries(item.boards).forEach(([boardId, board]) => {
        if (board.is_active && board.name.toLowerCase().includes(query)) {
          matchingBoards[boardId] = board; hasBoardMatches = true;
        }
      });
      if (mainBoardMatches) {
        Object.entries(item.boards).forEach(([boardId, board]) => { if (board.is_active) matchingBoards[boardId] = board; });
      }
      if (mainBoardMatches || hasBoardMatches) {
        matchingMainBoards.add(item.main_board_id);
        return { ...item, boards: mainBoardMatches ? Object.fromEntries(Object.entries(item.boards).filter(([, b]) => b.is_active)) : matchingBoards };
      }
      return null;
    }).filter(Boolean) as MainBoard[];
  }, [navItems, searchQuery]);

  const filteredAdminItems = useMemo(() => {
    if (!searchQuery.trim()) return adminNavigationItems;
    return adminNavigationItems.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() && filteredNavItems.length > 0) setActiveMainBoard(filteredNavItems[0].main_board_id);
  }, [filteredNavItems, searchQuery]);

  useEffect(() => { if (isSearchOpen && searchInputRef.current) searchInputRef.current.focus(); }, [isSearchOpen]);

  const clearSearch = () => { setSearchQuery(''); if (searchInputRef.current) searchInputRef.current.focus(); };
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value), []);

  // ─── Load user data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;
    try {
      const sessionData = sessionStorage.getItem('currentUserData');
      if (sessionData) {
        const p = JSON.parse(sessionData);
        setUserData({ email: p.email || "", userId: p.userId || "", userRole: p.userRole || "", userName: p.userName || "" });
        return;
      }
      const ld = {
        email: localStorage.getItem('loggedInUserEmail') || "",
        userId: localStorage.getItem('loggedInUserId') || "",
        userRole: localStorage.getItem('loggedInUserRole') || "",
        userName: localStorage.getItem('loggedInUserName') || "",
      };
      if (ld.userId) setUserData(ld);
    } catch { /* ignore */ }
  }, [isMounted]);

  useEffect(() => {
    const h = (event: { target: any }) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowUserDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ─── Logo ────────────────────────────────────────────────────────────────────
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const fetchCurrentLogo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/logo?skip=0&limit=100`, {
        method: 'GET', headers: { 'Accept': 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });
      if (response.ok) {
        const logos = await response.json();
        if (logos?.length > 0 && logos[0].id) await testLogoEndpoint(logos[0].id);
        else setCurrentLogo(null);
      } else setCurrentLogo(null);
    } catch { setCurrentLogo(null); }
  };

  const testLogoEndpoint = async (logoId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/logo/${logoId}`, { method: 'GET', headers: { 'X-API-Key': EXCEL_API_KEY } });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.startsWith('image/')) { setCurrentLogo(`${API_BASE_URL}/logo/${logoId}`); }
        else {
          const data = await response.text();
          try {
            const j = JSON.parse(data);
            const url = j.url || j.file_path || j.download_url;
            if (url) setCurrentLogo(url);
          } catch { /* ignore */ }
        }
      } else setCurrentLogo(null);
    } catch { setCurrentLogo(null); }
  };

  const handleLogoSubmit = async () => {
    if (!selectedFile) { toast.error('Please select a file'); return; }
    setIsUploading(true);
    try {
      const localUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
      });
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('description', logoDescription);
      setCurrentLogo(localUrl);
      const response = await fetch(`${API_BASE_URL}/logo`, { method: 'POST', headers: { 'X-API-Key': EXCEL_API_KEY }, body: formData });
      if (response.ok) {
        const result = await response.json();
        toast.success('Logo updated successfully!');
        handleLogoCancel();
        localStorage.setItem('currentLogoFile', JSON.stringify({ localUrl, filename: selectedFile.name, uploadDate: new Date().toISOString(), backendId: result.id || null }));
      } else {
        toast.error('Upload failed. Please try again.');
        setCurrentLogo(null);
      }
    } catch { toast.error('Network error. Please check your connection.'); setCurrentLogo(null); }
    finally { setIsUploading(false); }
  };

  const handleLogoCancel = () => { setIsLogoModalOpen(false); setSelectedFile(null); setLogoDescription(''); };

  // ─── Sidebar resize ───────────────────────────────────────────────────────────
  const toggleSidebar = () => {
    const newWidth = sidebarWidth > 100 ? 80 : 320;
    setSidebarWidth(newWidth);
    setIsSidebarOpen(newWidth > 100);
  };

  const startResizing = (e: { preventDefault: () => void }) => {
    e.preventDefault(); setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };
  const handleMouseMove = (e: { clientX: number }) => {
    if (isResizing && e.clientX >= 80 && e.clientX <= 400) {
      setSidebarWidth(e.clientX); setIsSidebarOpen(e.clientX > 100);
    }
  };
  const stopResizing = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  };
  useEffect(() => () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  }, [isResizing]);

  // ─── Init ─────────────────────────────────────────────────────────────────────
  // ✅ FIX: sessionStorage access is safely inside useEffect — never called at render time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const s = sessionStorage.getItem('currentUserData');
      if (s) {
        const d = JSON.parse(s);
        setUserRole(d.userRole);
        setClientUserId(d.userId);
      } else {
        // Fallback to localStorage
        const id = localStorage.getItem('loggedInUserId');
        const role = localStorage.getItem('loggedInUserRole');
        if (id) setClientUserId(id);
        if (role) setUserRole(role);
      }
    } catch { /* ignore */ }
    loadStoredLogo();
  }, []);

  const loadStoredLogo = () => {
    try {
      const storedLogo = localStorage.getItem('currentLogoFile');
      if (storedLogo) {
        const logoData = JSON.parse(storedLogo);
        setCurrentLogo(logoData.localUrl);
        const imgElement = new window.Image();
        imgElement.onerror = () => fetchCurrentLogo();
        imgElement.src = logoData.localUrl;
      } else fetchCurrentLogo();
    } catch { fetchCurrentLogo(); }
  };

  // ─── Create Main Board ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!mainBoardName.trim()) { toast.error("Please enter a name for the main board."); return; }
    let currentUserData: { userId?: string } = {};
    if (typeof window !== 'undefined') {
      const s = sessionStorage.getItem('currentUserData');
      currentUserData = s ? JSON.parse(s) : {};
    }
    const userId = currentUserData.userId;
    if (!userId) { toast.error("User not found. Please log in again."); return; }

    showGlobalLoader("Creating Main Board...");
    try {
      const response = await fetch(`${API_BASE_URL}/main-boards/?user_id=${userId}`, {
        method: "POST",
        headers: { accept: "application/json", "Content-Type": "application/json", "X-API-Key": EXCEL_API_KEY },
        body: JSON.stringify({ user_id: parseInt(userId), main_board_type: "ANALYSIS", name: mainBoardName }),
      });
      const data = await response.json();
      if (!response.ok) { toast.error(`Failed to save: ${JSON.stringify(data)}`); return; }
      toast.success("Main board saved successfully!");
      setMainBoardName(""); setMainBoardId(data.id); setIsModalOpen(false);
      router.push("/Container");
      mutateNavItems();
    } catch { toast.error("An error occurred. Please try again."); }
    finally { hideGlobalLoader(); }
  };

  // ─── Create / Update Board ────────────────────────────────────────────────────
  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) { toast.error('Please enter a board name'); return; }
    if (!customerDbKey.trim()) { toast.error('Please enter a customer database key'); return; }
    if (!isEditMode && !selectedBoard?.mainBoardId) { toast.error('Main board ID is missing'); return; }
    if (isEditMode && !editingBoardId) { toast.error('Board ID is missing for editing'); return; }

    let userId: string | null = null;
    if (typeof window !== 'undefined') {
      const s = sessionStorage.getItem('currentUserData');
      if (s) { const d = JSON.parse(s); userId = d.userId || d.user_id || d.id; }
      if (!userId) userId = sessionStorage.getItem("loggedInUserId") || localStorage.getItem('loggedInUserId');
    }
    if (!userId) { toast.error("User ID not found. Please log in again."); return; }

    showGlobalLoader(isEditMode ? "Updating Board..." : "Creating Board...");
    try {
      if (isEditMode) {
        const response = await fetch(`${API_BASE_URL}/main-boards/boards/${editingBoardId}?user_id=${userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-API-Key": EXCEL_API_KEY },
          body: JSON.stringify({ main_board_id: parseInt(selectedBoard!.mainBoardId), name: newBoardName.trim(), customer_db_key: customerDbKey.trim() }),
        });
        if (!response.ok) {
          const errorBody = await response.text();
          let msg = `Failed to update board: ${response.status}`;
          try { const e = JSON.parse(errorBody); msg = e.detail || e.message || msg; } catch { /* ignore */ }
          toast.error(msg); return;
        }
        toast.success("Board updated successfully!");
        closeModal();
        router.push(`/Container?main_board_id=${selectedBoard?.mainBoardId}&board_id=${editingBoardId}`);
        mutateNavItems();
      } else {
        const response = await fetch(`${API_BASE_URL}/main-boards/boards/?user_id=${userId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": EXCEL_API_KEY },
          body: JSON.stringify({ main_board_id: parseInt(selectedBoard!.mainBoardId), name: newBoardName.trim(), customer_db_key: customerDbKey.trim() }),
        });
        if (!response.ok) {
          const errorBody = await response.text();
          let msg = `Failed to create board: ${response.status}`;
          try { const e = JSON.parse(errorBody); msg = e.detail || e.message || msg; } catch { /* ignore */ }
          toast.error(msg); return;
        }
        const newBoard = await response.json();
        toast.success("Board created successfully!");
        closeModal();
        router.push(`/Container?main_board_id=${selectedBoard!.mainBoardId}&board_id=${newBoard.id}`);
        mutateNavItems();
      }
    } catch { toast.error("An unexpected error occurred"); }
    finally { hideGlobalLoader(); }
  };

  // ─── Delete Main Board ────────────────────────────────────────────────────────
  const handleDeleteMainBoard = async (e: React.MouseEvent, mainBoardId: string, mainBoardName: string) => {
    e.stopPropagation();
    toast.info(
      <div>
        <p>Are you sure you want to delete <strong>{mainBoardName}</strong>?<br /> This action cannot be undone.</p>
        <div className="toast-actions">
          <button onClick={() => { deleteMainBoard(mainBoardId); toast.dismiss(); }} className="confirm-btn">Confirm</button>
          <button onClick={() => toast.dismiss()} className="cancel-btn">Cancel</button>
        </div>
      </div>,
      { autoClose: false, closeButton: true, closeOnClick: false, draggable: false }
    );
  };

  const deleteMainBoard = async (mainBoardId: string) => {
    showGlobalLoader("Deleting Main Board...");
    try {
      let userId = '';
      if (typeof window !== 'undefined') {
        const s = sessionStorage.getItem('currentUserData');
        if (s) { const d = JSON.parse(s); userId = d.userId || d.user_id || d.id || ''; }
        if (!userId) userId = sessionStorage.getItem("loggedInUserId") || localStorage.getItem('loggedInUserId') || '';
      }
      if (!userId) { toast.error("User not found. Please log in again."); return; }

      const response = await fetch(`${API_BASE_URL}/main-boards/${mainBoardId}?user_id=${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });
      if (response.ok) {
        toast.success("Main board deleted successfully");
        mutateNavItems();
        if (activeMainBoard === mainBoardId) setActiveMainBoard('');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || "Failed to delete main board");
      }
    } catch { toast.error("An error occurred while deleting the main board"); }
    finally { hideGlobalLoader(); }
  };

  // ─── Delete Board ─────────────────────────────────────────────────────────────
  const handleDelete = async (boardId: string, mainBoardId: string, boardName: string) => {
    const ConfirmToast = ({ closeToast }: { closeToast: () => void }) => (
      <div className="p-4 bg-white rounded-lg shadow-lg">
        <p className="text-gray-800 mb-4">Are you sure you want to delete <strong>{boardName}</strong>?</p>
        <div className="flex justify-end space-x-2">
          <button onClick={() => closeToast()} className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded">Cancel</button>
          <button
            onClick={async () => {
              closeToast();
              showGlobalLoader("Deleting Board...");
              try {
                let currentUserData: { userId?: string } = {};
                if (typeof window !== 'undefined') {
                  const s = sessionStorage.getItem('currentUserData');
                  currentUserData = s ? JSON.parse(s) : {};
                }
                const userId = currentUserData.userId;
                if (!userId) { toast.error("User not found. Please log in again."); return; }
                const response = await fetch(`${API_BASE_URL}/main-boards/boards/${boardId}?user_id=${userId}`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-Key': EXCEL_API_KEY },
                });
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || "Failed to delete board");
                }
                setNavItems(prev => prev.map(item =>
                  item.main_board_id === mainBoardId
                    ? { ...item, boards: Object.fromEntries(Object.entries(item.boards).filter(([key]) => key !== boardId)) }
                    : item
                ));
                toast.success("Board deleted successfully!");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "An error occurred while deleting the board.");
              } finally { hideGlobalLoader(); }
            }}
            className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded"
          >Delete</button>
        </div>
      </div>
    );
    toast(<ConfirmToast closeToast={() => { }} />, {
      position: 'top-center', autoClose: false, closeButton: false, closeOnClick: false, draggable: false, className: '!bg-transparent !shadow-none',
    });
  };

  // ─── Plus click (create board) ────────────────────────────────────────────────
  const handlePlusClick = (event: React.MouseEvent<SVGSVGElement, MouseEvent>, mainBoardId: string) => {
    event.stopPropagation();
    setSelectedBoard({ mainBoardId });
    setNewBoardName(''); setCustomerDbKey('');
    setIsEditMode(false); setEditingBoardId(null);
    setShowModal(true);
  };

  // ─── Edit board click ────────────────────────────────────────────────────────
  const handleEditClick = async (boardId: string, mainBoardId: string) => {
    if (!Array.isArray(navItems)) return;
    const mainBoard = navItems.find(item => item.main_board_id === mainBoardId);
    if (!mainBoard) return;
    const boardData = mainBoard.boards[boardId];
    if (!boardData) return;

    showGlobalLoader("Loading Board Details...");
    try {
      let userId = '';
      if (typeof window !== 'undefined') {
        const s = sessionStorage.getItem('currentUserData');
        if (s) { const d = JSON.parse(s); userId = d.userId || d.user_id || d.id; }
        if (!userId) userId = sessionStorage.getItem("loggedInUserId") || localStorage.getItem('loggedInUserId') || '';
      }
      if (!userId) { toast.error('User ID not found. Please log in again.'); return; }

      const response = await fetch(`${API_BASE_URL}/main-boards/boards/${boardId}?user_id=${userId}`, {
        method: 'GET', headers: { 'Accept': 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });

      if (response.ok) {
        const boardDetails = await response.json();
        setIsEditMode(true);
        setEditingBoardId(boardId);
        setSelectedBoard({ mainBoardId, boardId, boardName: boardData.name });
        setNewBoardName(boardData.name);
        setCustomerDbKey(boardDetails.customer_db_key || '');
      } else {
        toast.error('Failed to load board details');
        return;
      }
    } catch {
      toast.error('Error loading board details');
      return;
    } finally {
      hideGlobalLoader();
    }

    setShowModal(true);
  };

  // ─── Close modal ──────────────────────────────────────────────────────────────
  const closeModal = () => {
    setShowModal(false); setSelectedBoard(null);
    setNewBoardName(''); setCustomerDbKey('');
    setIsEditMode(false); setEditingBoardId(null);
  };

  // ─── SWR nav fetching ─────────────────────────────────────────────────────────
  const fetcher = (url: string) =>
    fetch(url, { headers: { Accept: "application/json", "X-API-Key": EXCEL_API_KEY } })
      .then(res => { if (!res.ok) throw new Error("Failed to fetch"); return res.json(); });

  // ✅ FIX: Use clientUserId STATE (set safely in useEffect) instead of calling
  // sessionStorage directly at render time. This is the root cause of the build error.
  const { mutate: mutateNavItems } = useSWR(
    clientUserId ? `${API_BASE_URL}/main-boards/get_all_info_tree?user_id=${clientUserId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      onSuccess: data => setNavItems(data),
      onError: () => toast.error("Error loading navigation data"),
    }
  );

  useEffect(() => { if (refreshTrigger) mutateNavItems(); }, [refreshTrigger]);
  const forceRefresh = () => mutateNavItems();

  const toggleMainBoard = (mainBoardId: string) => {
    setActiveMainBoard(prev => prev === mainBoardId ? null : mainBoardId);
    setShowSubMenu(false);
  };

  const handleLogout = () => { closeMobileMenu(); router.push('/'); };

  const handleBoardClick = (boardId: string) => { setActiveBoardId(boardId); closeMobileMenu(); };

  // ─── Highlight search match ───────────────────────────────────────────────────
  const highlight = (text: string, query: string) =>
    query ? text.replace(new RegExp(`(${query})`, 'gi'), '<mark class="bg-yellow-200 px-1 rounded">$1</mark>') : text;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <>
      {globalLoading && <GlobalLoader message={globalLoadingMessage} />}

      {isMobile && (
        <button onClick={toggleMobileMenu} className="fixed top-4 left-4 z-50 p-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors" aria-label="Toggle menu">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      )}

      {isMobile && isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={closeMobileMenu} />}

      <div
        ref={sidebarRef}
        className="h-screen bg-white text-black flex flex-col shadow-2xl"
        style={{
          position: isMobile ? 'fixed' : 'relative',
          left: isMobile ? (isMobileMenuOpen ? 0 : '-100%') : 0,
          top: isMobile ? 0 : 'auto',
          width: isMobile ? '85%' : `${sidebarWidth}px`,
          maxWidth: isMobile ? '320px' : 'none',
          zIndex: isMobile ? 45 : 'auto',
          transition: isMobile ? 'left 0.3s ease-in-out' : 'width 0.3s',
        }}
      >
        <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable={false} pauseOnHover className="z-50" />

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="relative bg-white border-b border-blue-500/50 shadow-lg">
          <div className="p-4 flex justify-between items-center">
            {(isSidebarOpen || isMobile) && (
              <div className="relative group flex-1 min-w-0">
                {currentLogo ? (
                  <div className="relative">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-blue-400/20">
                      <img src={currentLogo} alt="Logo" width={120} height={40} className="object-contain max-h-10" onError={() => setCurrentLogo(null)} />
                    </div>
                    <button onClick={() => setIsLogoModalOpen(true)} className="absolute -top-1 -right-1 p-1.5 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-500 hover:scale-110 shadow-lg">
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-[140px] h-[50px] border-2 border-dashed border-blue-400/40 rounded-xl bg-blue-800/30 hover:bg-blue-700/40 transition-colors group">
                    <button onClick={() => setIsLogoModalOpen(true)} className="flex flex-col items-center text-black transition-colors">
                      <Upload className="w-5 h-5 mb-1" />
                      <span className="text-xs font-medium">Upload Logo</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {!isMobile && (
              <button onClick={toggleSidebar} className="p-2.5 text-black hover:bg-blue-700/50 focus:outline-none rounded-lg transition-all duration-200 hover:scale-105">
                {isSidebarOpen ? <ChevronLeft className="w-5 h-5 text-black" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* ── Create Main Board button ──────────────────────────────────────── */}
        {(isSidebarOpen || isMobile) && (
          <div className="p-4">
            <button
              onClick={() => { setIsModalOpen(true); closeMobileMenu(); }}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
              Create Main Board
            </button>
          </div>
        )}

        {/* ── Search bar ────────────────────────────────────────────────────── */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              ref={searchInputRef} type="text" placeholder="Search..."
              value={searchQuery} onChange={handleSearchChange}
              className="w-full py-3 pl-10 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white shadow-sm transition-all duration-200"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-all duration-200">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Navigation ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="px-4 pb-4">
            {searchQuery && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">{filteredNavItems.length + filteredAdminItems.length + ("dashboard".includes(searchQuery.toLowerCase()) ? 1 : 0)}</span> results for "{searchQuery}"
                  </p>
                  <button onClick={clearSearch} className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:bg-blue-100 px-2 py-1 rounded">Clear</button>
                </div>
              </div>
            )}

            <div className="space-y-1 mb-6">
              {(!searchQuery.trim() || "dashboard".includes(searchQuery.toLowerCase())) && (
                <Link href="/Dashboard" onClick={closeMobileMenu}
                  className="flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 group hover:bg-blue-700/40 hover:shadow-md"
                  onMouseEnter={() => setHoveredItem('dashboard')} onMouseLeave={() => setHoveredItem(null)}
                >
                  <LayoutDashboard className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                  {(isSidebarOpen || isMobile) && (
                    <span className="ml-3 font-medium text-sm">
                      {searchQuery ? <span dangerouslySetInnerHTML={{ __html: highlight("Dashboard", searchQuery) }} /> : "Dashboard"}
                    </span>
                  )}
                </Link>
              )}
            </div>

            <div className="space-y-2 mb-6">
              {filteredNavItems.map(item => {
                const mbId = String(item.main_board_id);
                const isExpanded = searchQuery.trim() ? true : activeMainBoard === mbId;
                return (
                  <div key={mbId} className="space-y-1">
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 group ${isExpanded ? 'bg-blue-700/60 shadow-lg border border-blue-500/30' : 'hover:bg-blue-700/30'}`}
                      onClick={() => toggleMainBoard(mbId)}
                      onMouseEnter={() => setHoveredItem(item.main_board_id)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <div className="flex items-center min-w-0 flex-1 group">
                        {!(item.boards && Object.keys(item.boards).length > 0 && isExpanded) && (
                          <ChartColumnDecreasing className="w-4 h-4 mr-2 text-gray-700 flex-shrink-0 group-hover:hidden" />
                        )}
                        {item.boards && Object.keys(item.boards).length > 0 && (
                          <div className={`flex-shrink-0 ${isExpanded ? "block" : "hidden group-hover:block"}`}>
                            {isExpanded ? <ChevronDown className="w-4 h-4 mr-2 text-gray-700" /> : <ChevronRight className="w-4 h-4 mr-2 text-gray-700" />}
                          </div>
                        )}
                        {(isSidebarOpen || isMobile) && (
                          <span className="font-medium text-sm group-hover:text-black truncate">
                            {searchQuery ? <span dangerouslySetInnerHTML={{ __html: highlight(item.name, searchQuery) }} /> : item.name}
                          </span>
                        )}
                      </div>

                      {(isSidebarOpen || isMobile) && !searchQuery.trim() && (
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Plus className="p-1.5 hover:bg-blue-600 rounded-md transition-colors duration-200" onClick={e => handlePlusClick(e, mbId)} />
                          <button onClick={e => handleDeleteMainBoard(e, mbId, item.name)} className="p-1.5 hover:bg-red-600 rounded-md transition-colors duration-200" title="Delete Main Board">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (isSidebarOpen || isMobile) && (
                      <div className="ml-7 space-y-1 pb-2">
                        {Object.keys(item.boards).filter(bId => item.boards[bId].is_active).map(boardId => {
                          const board = item.boards[boardId];
                          return (
                            <div
                              key={boardId}
                              className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all duration-200 group ${activeBoardId === boardId ? 'bg-blue-600/50 shadow-md border border-blue-400/30' : 'hover:bg-blue-700/25'}`}
                              onClick={() => handleBoardClick(boardId)}
                            >
                              <Link
                                href={{ pathname: '/Container', query: { main_board_id: item.main_board_id, board_id: boardId } }}
                                onClick={closeMobileMenu}
                                className="flex-1 text-black text-sm font-medium truncate"
                              >
                                {searchQuery ? <span dangerouslySetInnerHTML={{ __html: highlight(board.name, searchQuery) }} /> : board.name}
                              </Link>
                              {!searchQuery.trim() && (
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <button
                                    onClick={e => { e.stopPropagation(); handleEditClick(boardId, item.main_board_id); }}
                                    className="p-1 hover:bg-blue-600 rounded transition-colors duration-200" title="Edit Board"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDelete(boardId, item.main_board_id, board.name); }}
                                    className="p-1 hover:bg-red-600 rounded transition-colors duration-200" title="Delete Board"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
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

            {userRole?.toLowerCase() === "admin" && (
              <div className="space-y-1">
                {(searchQuery.trim() ? filteredAdminItems : adminNavigationItems).map(item => (
                  <Link key={item.id} href={item.href} onClick={closeMobileMenu}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 group ${pathname.startsWith(item.href) ? 'bg-blue-700 text-white shadow-md' : 'hover:bg-blue-700/40 hover:shadow-md'}`}
                    onMouseEnter={() => setHoveredItem(item.id)} onMouseLeave={() => setHoveredItem(null)}
                  >
                    {item.id === 'users' && <User className="w-5 h-5 flex-shrink-0" />}
                    {(item.id !== 'users') && <NotebookText className="w-5 h-5 flex-shrink-0" />}
                    {(isSidebarOpen || isMobile) && (
                      <span className="ml-3 font-medium text-sm">
                        {searchQuery ? <span dangerouslySetInnerHTML={{ __html: highlight(item.label, searchQuery) }} /> : item.label}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── User profile / dropdown ──────────────────────────────────────── */}
        <div className="border-t border-gray-200 p-4 relative" ref={dropdownRef}>
          {(isSidebarOpen || isMobile) ? (
            <div>
              <button onClick={toggleDropdown} className="w-full flex items-center space-x-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-left">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                  {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{userData.userName || "N/A"}</p>
                  <p className="text-xs text-blue-600 truncate">{userData.email || "N/A"}</p>
                </div>
                <div className="flex-shrink-0">
                  {isDropdownOpen ? <ChevronLeft className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </div>
              </button>
              {isDropdownOpen && (
                <div className="absolute left-full bottom-0 ml-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-100 relative">
                    <button onClick={() => setIsDropdownOpen(false)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
                    <div className="flex items-center space-x-3 pr-6">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{userData.userName || "N/A"}</p>
                        <p className="text-xs text-blue-600 truncate">{userData.email || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button onClick={handleSettingsClick} className="w-full flex items-center space-x-3 p-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-4 h-4" /><span>Settings</span>
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center space-x-3 p-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <LogOut className="w-4 h-4" /><span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <button onClick={toggleDropdown} className="w-full flex justify-center p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                  {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
              </button>
              {isDropdownOpen && (
                <div className="absolute left-full bottom-0 ml-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{userData.userName || "N/A"}</p>
                        <p className="text-xs text-blue-600 truncate">{userData.email || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button onClick={handleSettingsClick} className="w-full flex items-center space-x-3 p-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-4 h-4" /><span>Settings</span>
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center space-x-3 p-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <LogOut className="w-4 h-4" /><span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Settings / Change Password Modal ─────────────────────────────── */}
        {isSettingsModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
                <button onClick={() => { setIsSettingsModalOpen(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {([
                  { label: 'Current Password', key: 'currentPassword' as const, show: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword) },
                  { label: 'New Password', key: 'newPassword' as const, show: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword) },
                  { label: 'Confirm New Password', key: 'confirmPassword' as const, show: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword) },
                ]).map(({ label, key, show, toggle }) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
                    <div className="relative">
                      <input type={show ? "text" : "password"} value={passwordData[key]} onChange={e => setPasswordData({ ...passwordData, [key]: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 pr-10" placeholder={`Enter ${label.toLowerCase()}`} />
                      <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                <button onClick={() => { setIsSettingsModalOpen(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} disabled={isUpdatingPassword} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button onClick={handlePasswordUpdate} disabled={isUpdatingPassword} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {isUpdatingPassword ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Updating...</>) : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Logo Modal ────────────────────────────────────────────────────── */}
        {isLogoModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                <h2 className="text-xl font-bold text-gray-900">Edit Logo</h2>
                <button onClick={handleLogoCancel} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Upload New Logo</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors bg-gray-50">
                    <input type="file" id="logo-upload" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3"><Upload className="w-6 h-6 text-blue-600" /></div>
                      <span className="text-sm font-medium text-gray-700 mb-1">{selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}</span>
                      <span className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Description (Optional)</label>
                  <textarea value={logoDescription} onChange={e => setLogoDescription(e.target.value)} placeholder="Enter a description for the logo..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none" rows={3} />
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                <button onClick={handleLogoCancel} disabled={isUploading} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button onClick={handleLogoSubmit} disabled={isUploading || !selectedFile} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {isUploading ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Uploading...</>) : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Main Board Modal ───────────────────────────────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 mx-4">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Create Main Board</h2>
              <input
                style={{ color: "black" }} type="text" value={mainBoardName}
                onChange={e => setMainBoardName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Enter Main Board Name"
                className="w-full p-3 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end space-x-4">
                <button onClick={() => setIsModalOpen(false)} className="bg-gray-300 hover:bg-gray-400 text-black py-2.5 px-6 rounded-lg font-medium transition-all duration-200">Cancel</button>
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-6 rounded-lg font-medium transition-all duration-200">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create / Edit Board Modal ─────────────────────────────────────── */}
        {showModal && selectedBoard && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={closeModal}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 relative" onClick={e => e.stopPropagation()}>
              <div className="mb-6">
                <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-all duration-200" onClick={closeModal}>
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Edit Board' : 'Create New Board'}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isEditMode ? `Board ID: ${editingBoardId} • Main Board ID: ${selectedBoard.mainBoardId}` : `Main Board ID: ${selectedBoard.mainBoardId}`}
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Board Name <span className="text-red-500">*</span></label>
                  <input type="text" value={newBoardName} onChange={e => setNewBoardName(e.target.value)}
                    placeholder="Enter board name (e.g., Hospital Analysis)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Database Key <span className="text-red-500">*</span></label>
                  <input type="text" value={customerDbKey} onChange={e => setCustomerDbKey(e.target.value)}
                    placeholder="Enter database key (e.g., customer_db_tally)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                  <p className="mt-1 text-xs text-gray-500">Examples: customer_db_tally, customer_db_onegcp</p>
                </div>
                {newBoardName.trim() && customerDbKey.trim() && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800"><span className="font-semibold">{isEditMode ? 'Ready to update:' : 'Ready to create:'}</span> {newBoardName}</p>
                    <p className="text-xs text-blue-600 mt-1">Database: {customerDbKey}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={closeModal} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">Cancel</button>
                <button onClick={handleCreateBoard} disabled={!newBoardName.trim() || !customerDbKey.trim()}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                  {isEditMode ? 'Update Board' : 'Create Board'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Resize handle ─────────────────────────────────────────────────── */}
        {!isMobile && (
          <div className="absolute top-0 right-0 w-1 h-full cursor-ew-resize bg-blue-600/20 opacity-0 hover:opacity-100 transition-opacity duration-200" onMouseDown={startResizing} />
        )}
      </div>
    </>
  );
};

export default Sidebar;