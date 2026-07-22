"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import { translateBatch } from '../utils/translateService';
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
  EyeOff,
  Building2,
  Users,
  Shield,
  ArrowLeft,
  CheckCircle2,
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
  id?: string | number;
  main_board_id: string;
  name: string;
  boards: { [key: string]: Board };
}

type SelectedBoard = {
  mainBoardId: string;
  boardId?: string;
  boardName?: string;
} | null;

// Always offered in the Customer Database Key dropdown, even if the org's
// available-customer-dbs list doesn't (yet) include it.
const FALLBACK_CUSTOMER_DB_KEY = "customer_db_hospital_a";

interface SidebarProps {
  clientUserId?: string | number;
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
      <div className="relative w-20 h-20">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * 360;
          const rad = (angle * Math.PI) / 180;
          const x = 50 + 40 * Math.sin(rad);
          const y = 50 - 40 * Math.cos(rad);
          return (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-white"
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
      <p className="mt-3 text-white text-sm font-medium tracking-wide animate-pulse">
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
  const { t } = useTranslation();
  const { language } = useLanguage();
  // Map of original name → translated name for current language
  const [boardNameMap, setBoardNameMap] = useState<Record<string, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<string>('');
  const isViewer = orgRole === 'VIEWER' || orgRole === 'EDITOR' || orgRole === 'ANALYST';

  // Permission label shown in the "My Board Access" modal — derived from the
  // logged-in user's org role (VIEWER/ANALYST can only view, EDITOR can edit).
  const accessPermission = (() => {
    if (orgRole === 'VIEWER' || orgRole === 'ANALYST') {
      return { label: 'View Only', Icon: Eye, className: 'bg-gray-100 text-gray-600 border-gray-200' };
    }
    if (orgRole === 'EDITOR') {
      return { label: 'Can Edit', Icon: Edit3, className: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    return { label: 'Full Access', Icon: Shield, className: 'bg-green-100 text-green-700 border-green-200' };
  })();
  const [showModal, setShowModal] = useState<boolean>(false);

  // ── Manage Access modal ───────────────────────────────────────────────────
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessData, setAccessData] = useState<any[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
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
  const [editingBoardActive, setEditingBoardActive] = useState(true);

  const [selectedBoard, setSelectedBoard] = useState<SelectedBoard>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Which dashboard flavor (Consultant vs CXO) the user is currently browsing —
  // stamped onto board links so GroupContainer shows the right label instead of
  // trusting a leftover 'activeScreenRole' value from a previous session.
  const currentScreenRole: 'consultant' | 'cxo' =
    pathname.startsWith('/CXO') ? 'cxo'
    : pathname.startsWith('/Container') || pathname.startsWith('/Consultant') || pathname.startsWith('/Dashboard') ? 'consultant'
    : (typeof window !== 'undefined' && (localStorage.getItem('activeScreenRole') as 'consultant' | 'cxo' | null)) || 'consultant';
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

  // Org id — resolved once for the OWNER, needed for the /rbac/main-boards and
  // /rbac/boards endpoints which require org_id on every call.
  const [orgId, setOrgId] = useState<number | null>(null);

  // Main Boards tree — sourced from /rbac/main-boards/info-tree
  const [groupRefItems, setGroupRefItems] = useState<MainBoard[]>([]);
  const [groupRefLoading, setGroupRefLoading] = useState(false);
  const [activeGroupRefMainBoard, setActiveGroupRefMainBoard] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [userData, setUserData] = useState<UserData>({ email: "", userId: "", userRole: "", userName: "" });
  const [isMounted, setIsMounted] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [customerDbOptions, setCustomerDbOptions] = useState<string[]>([]);

  const [confirmation, setConfirmation] = useState({ isOpen: false, message: '', boardId: '', mainBoardId: '' });

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  const fetchCustomerDbKeys = async () => {
  try {
    let userId = '';

    if (typeof window !== 'undefined') {
      const s = sessionStorage.getItem('currentUserData');
      if (s) {
        const d = JSON.parse(s);
        userId = d.userId || d.user_id || d.id;
      }
    }

    if (!userId) return;

    const res = await fetch(
      `${API_BASE_URL}/main-boards/boards/available-customer-dbs?user_id=${userId}`,
      {
        method: "GET",
        headers: {
          "accept": "application/json",
          "X-API-Key": EXCEL_API_KEY
        }
      }
    );

    if (res.ok) {
      const data = await res.json();
      setCustomerDbOptions(Array.from(new Set([...(Array.isArray(data) ? data : []), FALLBACK_CUSTOMER_DB_KEY])));
    } else {
      console.error("Failed to fetch DB keys");
      setCustomerDbOptions([FALLBACK_CUSTOMER_DB_KEY]);
    }
  } catch (err) {
    console.error("Error:", err);
    setCustomerDbOptions([FALLBACK_CUSTOMER_DB_KEY]);
  }
};

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

  // ─── Mobile ──────────────────────────────────────────────────────────────────
  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) { setIsSidebarOpen(false); setSidebarWidth(0); }
      else { setIsSidebarOpen(true); setSidebarWidth(260); setIsMobileMenuOpen(false); }
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
  // `roles` controls which logged-in role sees the item — Organization and
  // org-groups are OWNER/SUPER_ADMIN-only, the rest stay admin-only.
  const adminNavigationItems = [
    { id: 'users', label: 'User', href: '/UserList', roles: ['admin', 'owner', 'super_admin'] },
    { id: 'organization', label: 'Organization', href: '/Organization', roles: ['owner'] },
    { id: 'members', label: 'Members', href: '/member-list', roles: ['admin'] },
    { id: 'groups', label: 'Groups', href: '/user-groups', roles: ['admin'] },
    { id: 'org-groups', label: 'Groups', href: '/Groups', roles: ['owner', 'super_admin'] },
    // { id: 'board-assignment', label: 'Assign Boards to Roles', href: '/BoardRoleAssignment' },
    // { id: 'user-assignment', label: 'Assign User to Roles', href: '/UserRoleAssignment' }
  ];

  // ─── Search filtering ─────────────────────────────────────────────────────────
  const filteredNavItems = useMemo(() => {
    const sorted = [...groupRefItems].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    if (!searchQuery.trim()) return sorted;
    const query = searchQuery.toLowerCase();
    const matchingMainBoards = new Set<string>();
    return sorted.map(item => {
      const mainBoardMatches = (item.name ?? '').toLowerCase().includes(query);
      const matchingBoards: { [key: string]: Board } = {};
      let hasBoardMatches = false;
      Object.entries(item.boards ?? {}).forEach(([boardId, board]) => {
        if (board.is_active && (board.name ?? '').toLowerCase().includes(query)) {
          matchingBoards[boardId] = board; hasBoardMatches = true;
        }
      });
      if (mainBoardMatches) {
        Object.entries(item.boards ?? {}).forEach(([boardId, board]) => { if (board.is_active) matchingBoards[boardId] = board; });
      }
      if (mainBoardMatches || hasBoardMatches) {
        matchingMainBoards.add(item.main_board_id);
        return { ...item, boards: mainBoardMatches ? Object.fromEntries(Object.entries(item.boards).filter(([, b]) => b.is_active)) : matchingBoards };
      }
      return null;
    }).filter(Boolean) as MainBoard[];
  }, [groupRefItems, searchQuery]);

  const filteredAdminItems = useMemo(() => {
    let visible: typeof adminNavigationItems;
    if (orgRole === 'OWNER' || orgRole === 'SUPER_ADMIN') {
      visible = [
        { id: 'users', label: 'User', href: '/UserList', roles: [] },
        { id: 'organization', label: 'Organization', href: '/Organization', roles: [] },
        { id: 'org-groups', label: 'Role', href: '/Groups', roles: [] },
      ];
    } else if (orgRole === 'ADMIN') {
      visible = [
        { id: 'org-groups', label: 'Role', href: '/Groups', roles: [] },
      ];
    } else if (orgRole === 'VIEWER' || orgRole === 'EDITOR' || orgRole === 'ANALYST') {
      visible = []; // no admin menus — only the boards tree is shown
    } else {
      const role = userRole?.toLowerCase() || '';
      visible = adminNavigationItems.filter(item => item.roles.includes(role));
    }
    if (!searchQuery.trim()) return visible;
    return visible.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, userRole, orgRole]);

  useEffect(() => {
    if (searchQuery.trim() && filteredNavItems.length > 0) {
      setActiveGroupRefMainBoard(filteredNavItems[0].main_board_id);
    }
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

  // ─── Logo ─────────────────────────────────────────────────────────────────────
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  // ── Read userId reliably from storage (never from React state) ───────────────
  const getStoredUserId = (): string => {
    if (typeof window === 'undefined') return '';
    try {
      const s = sessionStorage.getItem('currentUserData');
      if (s) {
        const d = JSON.parse(s);
        const id = d.userId || d.user_id || d.id || '';
        if (id) return String(id);
      }
      return sessionStorage.getItem('loggedInUserId') || localStorage.getItem('loggedInUserId') || '';
    } catch { return ''; }
  };

  // ── Fetch blob from /api/logo/{userId}/view ───────────────────────────────────
  const fetchLogoBlob = async (userId: string): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logo/${userId}/view`, {
        method: 'GET',
        headers: { 'X-API-Key': EXCEL_API_KEY },
      });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 0 && blob.type.startsWith('image/')) {
          return URL.createObjectURL(blob);
        }
      }
      return null;
    } catch { return null; }
  };

  // ── Fetch logo metadata then image from server ────────────────────────────────
  // Rule: Never call setCurrentLogo(null) unless the server CONFIRMS no logo exists.
  const fetchCurrentLogo = async () => {
    const userId = getStoredUserId();
    if (!userId) return; // userId not ready — keep showing cached preview

    try {
      // First, call the metadata endpoint to verify existence
      const metadataRes = await fetch(`${API_BASE_URL}/api/logo/${userId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });

      // If the endpoint returns 404 or any error, the user has no logo
      if (!metadataRes.ok) {
        setCurrentLogo(null);
        return;
      }

      const metadata = await metadataRes.json();
      // Check if the response indicates success and contains a logo object
      const logoExists = metadata?.success === true && metadata?.logo != null;

      if (!logoExists) {
        setCurrentLogo(null);
        return;
      }

      // Logo exists — fetch the actual image blob
      const blobUrl = await fetchLogoBlob(userId);
      if (blobUrl) {
        setCurrentLogo(blobUrl); // replace preview with real server image
      }
      // If blob fetch failed (network hiccup), keep cached preview — don't blank
    } catch {
      // Any error → keep showing cached preview, never blank
    }
  };

  // ── On mount: show cached preview for this user instantly ────────────────────
  const loadStoredLogo = () => {
    const userId = getStoredUserId();
    if (!userId) return; // no userId — server fetch will handle it via useEffect

    try {
      const cached = localStorage.getItem(`logo_cache_${userId}`);
      if (cached) {
        const d = JSON.parse(cached);
        if (d.userId === userId && d.localUrl) {
          setCurrentLogo(d.localUrl); // instant display, no network needed
        }
      }
      // Note: DO NOT call fetchCurrentLogo() here.
      // useEffect([userData.userId]) will do the server refresh once state loads.
    } catch { /* ignore corrupt cache */ }
  };

  // ── Upload logo ───────────────────────────────────────────────────────────────
  const handleLogoSubmit = async () => {
    if (!selectedFile) { toast.error('Please select a file'); return; }
    const userId = getStoredUserId();
    if (!userId) { toast.error('User not found. Please log in again.'); return; }

    setIsUploading(true);
    try {
      // Show local preview immediately
      const localUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
      });
      setCurrentLogo(localUrl);

      const formData = new FormData();
      formData.append('file', selectedFile);
      if (logoDescription.trim()) formData.append('description', logoDescription);

      const response = await fetch(`${API_BASE_URL}/api/logo/upload/${userId}`, {
        method: 'POST',
        headers: { 'X-API-Key': EXCEL_API_KEY },
        body: formData,
      });

      if (response.ok) {
        toast.success('Logo updated successfully!');
        handleLogoCancel();
        // Fetch the real blob and update display
        const blobUrl = await fetchLogoBlob(userId);
        setCurrentLogo(blobUrl || localUrl); // fall back to local preview if blob fails
        // Save per-user cache
        localStorage.setItem(`logo_cache_${userId}`, JSON.stringify({
          localUrl,
          filename: selectedFile.name,
          uploadDate: new Date().toISOString(),
          userId,
        }));
        localStorage.removeItem('currentLogoFile'); // remove legacy shared key
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || err.message || 'Upload failed. Please try again.');
        // Don't blank — keep the preview visible
      }
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoCancel = () => { setIsLogoModalOpen(false); setSelectedFile(null); setLogoDescription(''); };

  // ─── Sidebar resize ───────────────────────────────────────────────────────────
  const toggleSidebar = () => {
    const newWidth = sidebarWidth > 100 ? 64 : 260;
    setSidebarWidth(newWidth);
    setIsSidebarOpen(newWidth > 100);
  };

  const startResizing = (e: { preventDefault: () => void }) => {
    e.preventDefault(); setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };
  const handleMouseMove = (e: { clientX: number }) => {
    if (isResizing && e.clientX >= 64 && e.clientX <= 360) {
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
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const s = sessionStorage.getItem('currentUserData');
      if (s) {
        const d = JSON.parse(s);
        setUserRole(d.userRole);
        setOrgRole((d.orgRole || '').toUpperCase());
        setClientUserId(d.userId);
      } else {
        const id = localStorage.getItem('loggedInUserId');
        const role = localStorage.getItem('loggedInUserRole');
        if (id) setClientUserId(id);
        if (role) setUserRole(role);
      }
    } catch { /* ignore */ }
    loadStoredLogo();
  }, []);

  // ─── Resolve org_id ───────────────────────────────────────────────────────────
  // null = not yet attempted; 0 = all attempts exhausted, none found; >0 = resolved
  useEffect(() => {
    if (!clientUserId) return;
    // 1. Check every variant key in currentUserData
    try {
      const s = sessionStorage.getItem('currentUserData');
      if (s) {
        const d = JSON.parse(s);
        const stored = d.orgId ?? d.org_id ?? d.organizationId ?? d.organization_id;
        if (stored) { setOrgId(Number(stored)); return; }
      }
      // 2. Standalone sessionStorage keys written by other components
      const direct = sessionStorage.getItem('organization_id') ?? sessionStorage.getItem('orgId');
      if (direct) { setOrgId(Number(direct)); return; }
    } catch { /* ignore */ }
    // 3. Owner-only fallback — only resolves for the org OWNER
    fetch(`${API_BASE_URL}/organizations/my-org?owner_user_id=${clientUserId}`, {
      headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const id = data?.id ?? data?.org_id ?? data?.organization?.id;
        setOrgId(id ? Number(id) : 0);
      })
      .catch(() => setOrgId(0));
  }, [clientUserId]);

  // ─── Main Boards tree from /rbac/main-boards/info-tree ──────────────────────
  // Normalize raw API items to the MainBoard shape the UI expects.
  const normalizeMainBoard = (raw: any): MainBoard => {
    const name = raw.name ?? raw.main_board_name ?? raw.board_name ?? raw.title ?? raw.label ?? '';
    const mbId = String(raw.main_board_id ?? raw.id ?? '');
    let boards: { [key: string]: Board } = {};
    if (raw.boards && !Array.isArray(raw.boards)) {
      boards = raw.boards;
    } else if (Array.isArray(raw.boards)) {
      raw.boards.forEach((b: any) => {
        const bId = String(b.board_id ?? b.id ?? b.key ?? Math.random());
        boards[bId] = { name: b.name ?? b.board_name ?? '', is_active: b.is_active ?? true, path: b.path };
      });
    }
    return { ...raw, name, main_board_id: mbId, boards };
  };

  const fetchGroupRefItems = () => {
    if (!clientUserId || orgId === null) return;
    setGroupRefLoading(true);
    // orgId === 0 means org couldn't be resolved; try without it as last resort
    const url = orgId > 0
      ? `${API_BASE_URL}/rbac/main-boards/info-tree?user_id=${clientUserId}&org_id=${orgId}`
      : `${API_BASE_URL}/rbac/main-boards/info-tree?user_id=${clientUserId}`;
    fetch(url, {
      headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        const raw = Array.isArray(data)
          ? data
          : (data?.items ?? data?.main_boards ?? data?.boards ?? data?.data ?? []);
        setGroupRefItems(Array.isArray(raw) ? raw.map(normalizeMainBoard) : []);
      })
      .catch(() => setGroupRefItems([]))
      .finally(() => setGroupRefLoading(false));
  };

  useEffect(() => {
    if (orgId !== null) fetchGroupRefItems();
  }, [clientUserId, orgId]);

  // ── Once userId is confirmed in state, fetch real blob from server ────────────
  useEffect(() => {
    if (userData.userId) fetchCurrentLogo();
  }, [userData.userId]);

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
    if (!orgId || orgId <= 0) { toast.error("Could not determine your organization. Please reload and try again."); return; }

    showGlobalLoader("Creating Main Board...");
    try {
      const response = await fetch(`${API_BASE_URL}/rbac/main-boards/?user_id=${userId}&org_id=${orgId}`, {
        method: "POST",
        headers: { accept: "application/json", "Content-Type": "application/json", "X-API-Key": EXCEL_API_KEY },
        body: JSON.stringify({ client_user_id: parseInt(userId), main_board_type: "ANALYSIS", name: mainBoardName }),
      });
      const data = await response.json();
      if (!response.ok) { toast.error(`Failed to save: ${JSON.stringify(data)}`); return; }
      toast.success("Main board saved successfully!");
      setMainBoardName(""); setMainBoardId(data.id); setIsModalOpen(false);
      router.push("/Container");
      fetchGroupRefItems();
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
    if (!orgId || orgId <= 0) { toast.error("Could not determine your organization. Please reload and try again."); return; }

    showGlobalLoader(isEditMode ? "Updating Board..." : "Creating Board...");
    try {
      if (isEditMode) {
        const response = await fetch(`${API_BASE_URL}/rbac/boards/${editingBoardId}?user_id=${userId}&org_id=${orgId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-API-Key": EXCEL_API_KEY },
          body: JSON.stringify({
            main_board_id: parseInt(selectedBoard!.mainBoardId), name: newBoardName.trim(),
            is_active: editingBoardActive, customer_db_key: customerDbKey.trim(),
          }),
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
        fetchGroupRefItems();
      } else {
        const response = await fetch(`${API_BASE_URL}/rbac/boards/?user_id=${userId}&org_id=${orgId}`, {
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
        fetchGroupRefItems();
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
      if (!orgId || orgId <= 0) { toast.error("Could not determine your organization. Please reload and try again."); return; }

      const response = await fetch(`${API_BASE_URL}/rbac/main-boards/${mainBoardId}?user_id=${userId}&org_id=${orgId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });
      if (response.ok) {
        toast.success("Main board deleted successfully");
        fetchGroupRefItems();
        if (activeGroupRefMainBoard === mainBoardId) setActiveGroupRefMainBoard(null);
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
      <div className="p-3 bg-white rounded-lg shadow-lg">
        <p className="text-gray-800 text-sm mb-3">Are you sure you want to delete <strong>{boardName}</strong>?</p>
        <div className="flex justify-end space-x-2">
          <button onClick={() => closeToast()} className="px-3 py-1.5 text-sm bg-gray-200 text-gray-800 hover:bg-gray-300 rounded">Cancel</button>
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
                if (!orgId || orgId <= 0) { toast.error("Could not determine your organization. Please reload and try again."); return; }
                const response = await fetch(`${API_BASE_URL}/rbac/boards/${boardId}?user_id=${userId}&org_id=${orgId}`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-Key': EXCEL_API_KEY },
                });
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || "Failed to delete board");
                }
                toast.success("Board deleted successfully!");
                fetchGroupRefItems();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "An error occurred while deleting the board.");
              } finally { hideGlobalLoader(); }
            }}
            className="px-3 py-1.5 text-sm bg-red-500 text-white hover:bg-red-600 rounded"
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
     fetchCustomerDbKeys(); 
  };

  // ─── Edit board click ────────────────────────────────────────────────────────
  const handleEditClick = async (boardId: string, mainBoardId: string) => {
    if (!Array.isArray(groupRefItems)) return;
    const mainBoard = groupRefItems.find(item => item.main_board_id === mainBoardId);
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
      if (!orgId || orgId <= 0) { toast.error('Could not determine your organization. Please reload and try again.'); return; }

      const response = await fetch(`${API_BASE_URL}/rbac/boards/${boardId}?user_id=${userId}&org_id=${orgId}`, {
        method: 'GET', headers: { 'Accept': 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });

      if (response.ok) {
        const boardDetails = await response.json();
        setIsEditMode(true);
        setEditingBoardId(boardId);
        setSelectedBoard({ mainBoardId, boardId, boardName: boardData.name });
        setNewBoardName(boardData.name);
        setCustomerDbKey(boardDetails.customer_db_key || '');
        setEditingBoardActive(boardData.is_active);
      } else {
        toast.error('Failed to load board details'); return;
      }
    } catch {
      toast.error('Error loading board details'); return;
    } finally { hideGlobalLoader(); }

    setShowModal(true);
  };

  // ─── Close modal ──────────────────────────────────────────────────────────────
  const closeModal = () => {
    setShowModal(false); setSelectedBoard(null);
    setNewBoardName(''); setCustomerDbKey('');
    setIsEditMode(false); setEditingBoardId(null);
  };

  useEffect(() => { if (refreshTrigger) fetchGroupRefItems(); }, [refreshTrigger]);
  const forceRefresh = () => fetchGroupRefItems();

  // ── Fetch user board access ───────────────────────────────────────────────
  const fetchUserAccess = async () => {
    try {
      const d = sessionStorage.getItem('currentUserData');
      if (!d) return;
      const { userId } = JSON.parse(d);
      if (!userId || !orgId) return;
      setAccessLoading(true);
      setAccessError(null);
      const res = await fetch(
        `${API_BASE_URL}/board-access/user/${userId}/info-tree?org_id=${orgId}`,
        { headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setAccessData(Array.isArray(data) ? data : data.main_boards || []);
    } catch (e: any) {
      setAccessError(e.message || 'Failed to load access data');
    } finally {
      setAccessLoading(false);
    }
  };

  const openAccessModal = () => {
    setShowAccessModal(true);
    fetchUserAccess();
  };

  // Auto-translate all board names when language or groupRefItems changes
  useEffect(() => {
    if (language === 'en' || groupRefItems.length === 0) {
      setBoardNameMap({});
      return;
    }
    // Collect all unique names: main boards + sub-boards
    const allNames: string[] = [];
    groupRefItems.forEach(item => {
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
  }, [language, groupRefItems]);

  const toggleMainBoard = (mainBoardId: string) => {
    setActiveGroupRefMainBoard(prev => prev === mainBoardId ? null : mainBoardId);
    setShowSubMenu(false);
  };

 const handleLogout = () => {
  closeMobileMenu();
  sessionStorage.removeItem('currentUserData'); // clear auth data
  router.replace('/');                          // replace history, not push
};
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
        <button onClick={toggleMobileMenu} className="fixed top-3 left-3 z-50 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors" aria-label="Toggle menu">
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
          width: isMobile ? '80%' : `${sidebarWidth}px`,
          maxWidth: isMobile ? '280px' : 'none',
          zIndex: isMobile ? 45 : 'auto',
          transition: isMobile ? 'left 0.3s ease-in-out' : 'width 0.3s',
        }}
      >
        <ToastContainer position="bottom-center" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable={false} pauseOnHover className="z-50" />

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="relative bg-white border-b border-blue-500/50 shadow-md">
          <div className="px-3 py-2.5 flex justify-between items-center">
            {(isSidebarOpen || isMobile) && (
              <div className="relative group flex-1 min-w-0">
                {currentLogo ? (
                  <div className="relative">
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-blue-400/20">
                      <img
                        src={currentLogo}
                        alt="Logo"
                        width={100}
                        height={32}
                        className="object-contain max-h-8"
                        onError={() => setCurrentLogo(null)}
                      />
                    </div>
                    <button onClick={() => setIsLogoModalOpen(true)} className="absolute -top-1 -right-1 p-1 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-500 shadow-md">
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-[120px] h-[42px] border-2 border-dashed border-blue-400/40 rounded-lg bg-blue-800/30 hover:bg-blue-700/40 transition-colors group">
                    <button onClick={() => setIsLogoModalOpen(true)} className="flex flex-col items-center text-black transition-colors">
                      <Upload className="w-4 h-4 mb-0.5" />
                      <span className="text-xs font-medium">{t('sidebar.uploadLogo')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {!isMobile && (
              <button onClick={toggleSidebar} className="p-2 text-black hover:bg-blue-700/50 focus:outline-none rounded-lg transition-all duration-200 hover:scale-105 flex-shrink-0">
                {isSidebarOpen ? <ChevronLeft className="w-4 h-4 text-black" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* ── Create Main Board button ──────────────────────────────────────── */}
        {(isSidebarOpen || isMobile) && orgRole !== 'ADMIN' && orgRole !== 'VIEWER' && orgRole !== 'EDITOR' && orgRole !== 'ANALYST' && (
          <div className="px-3 py-2">
            <button
              onClick={() => { setIsModalOpen(true); closeMobileMenu(); }}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 px-3 rounded-lg font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
            >
              <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
              {t('sidebar.createMainBoard')}
            </button>
          </div>
        )}

        {/* ── Search bar ────────────────────────────────────────────────────── */}
        {(isSidebarOpen || isMobile) ? (
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
              <input
                ref={searchInputRef} type="text" placeholder={t('sidebar.search')}
                value={searchQuery} onChange={handleSearchChange}
                className="w-full py-2 pl-8 pr-8 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white shadow-sm transition-all duration-200"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-0.5 transition-all duration-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center pb-2">
            <button
              onClick={toggleSidebar}
              title="Search (expand sidebar)"
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Navigation ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="px-3 pb-3">
            {searchQuery && (
              <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-blue-800">
                    <span className="font-medium">{filteredNavItems.length + filteredAdminItems.length}</span> {t('sidebar.resultsFor')} "{searchQuery}"
                  </p>
                  <button onClick={clearSearch} className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:bg-blue-100 px-1.5 py-0.5 rounded">{t('actions.clearSearch')}</button>
                </div>
              </div>
            )}

            {/* Dashboard link */}
            {/* <div className="space-y-0.5 mb-4">
              {(!searchQuery.trim() || "dashboard".includes(searchQuery.toLowerCase())) && (
                <Link href="/Dashboard" onClick={closeMobileMenu}
                  className="flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200 group hover:bg-blue-700/40 hover:shadow-sm"
                  onMouseEnter={() => setHoveredItem('dashboard')} onMouseLeave={() => setHoveredItem(null)}
                >
                  <LayoutDashboard className="w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                  {(isSidebarOpen || isMobile) && (
                    <span className="ml-2 font-medium text-xs">
                      {searchQuery ? <span dangerouslySetInnerHTML={{ __html: highlight("Dashboard", searchQuery) }} /> : "Dashboard"}
                    </span>
                  )}
                </Link>
              )}
            </div> */}

            {/* Main Boards tree — from /rbac/main-boards/info-tree */}
            {(isSidebarOpen || isMobile) && (
              <div className="space-y-0.5 mb-4">
                {(groupRefLoading || orgId === null) ? (
                  <div className="text-xs text-gray-400 px-2 py-1">{t('sidebar.loading')}</div>
                ) : filteredNavItems.length === 0 ? (
                  <div className="text-xs text-gray-400 px-2 py-1">No main boards found.</div>
                ) : (
                  filteredNavItems.map(item => {
                    const mbId = String(item.main_board_id);
                    const isExpanded = searchQuery.trim() ? true : activeGroupRefMainBoard === mbId;
                    return (
                      <div key={mbId} className="space-y-0.5">
                        <div
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all duration-200 group ${isExpanded ? 'bg-blue-600/50 shadow-sm border border-blue-400/30' : 'hover:bg-blue-700/25'}`}
                          onClick={() => toggleMainBoard(mbId)}
                          onMouseEnter={() => setHoveredItem(item.main_board_id)}
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            {isExpanded
                              ? <ChevronDown className="w-3 h-3 mr-1.5 text-gray-600 flex-shrink-0" />
                              : <ChevronRight className="w-3 h-3 mr-1.5 text-gray-600 flex-shrink-0" />
                            }
                            <span className="text-xs font-medium truncate">
                              {searchQuery
                                ? <span dangerouslySetInnerHTML={{ __html: highlight(item.name, searchQuery) }} />
                                : (boardNameMap[item.name] || item.name)}
                            </span>
                          </div>
                          {!searchQuery.trim() && !isViewer && (
                            <div className="flex space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <Plus className="p-1 hover:bg-blue-600 rounded transition-colors duration-200 w-5 h-5" onClick={e => handlePlusClick(e, mbId)} />
                              <button onClick={e => handleDeleteMainBoard(e, mbId, item.name)} className="p-1 hover:bg-red-600 rounded transition-colors duration-200" title="Delete Main Board">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="ml-4 space-y-0.5">
                            {Object.keys(item.boards ?? {}).filter(bId => item.boards[bId]?.is_active).length === 0 ? (
                              <div className="text-xs text-gray-400 px-2 py-1">No boards</div>
                            ) : (
                              Object.keys(item.boards ?? {}).filter(bId => item.boards[bId]?.is_active).map(boardId => {
                                const board = item.boards[boardId];
                                return (
                                  <div
                                    key={boardId}
                                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all duration-200 group ${activeBoardId === boardId ? 'bg-blue-600/50 shadow-sm border border-blue-400/30' : 'hover:bg-blue-700/25'}`}
                                    onClick={() => handleBoardClick(boardId)}
                                  >
                                    <Link
                                      href={{ pathname: '/GroupContainer', query: { main_board_id: item.main_board_id, board_id: boardId, screenRole: currentScreenRole } }}
                                      onClick={closeMobileMenu}
                                      className="flex-1 text-black text-xs font-medium truncate"
                                    >
                                      {searchQuery
                                        ? <span dangerouslySetInnerHTML={{ __html: highlight(board.name, searchQuery) }} />
                                        : (boardNameMap[board.name] || board.name)}
                                    </Link>
                                    {!searchQuery.trim() && !isViewer && (
                                      <div className="flex space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}


            {/* Admin / Owner items */}
            {filteredAdminItems.length > 0 && (
              <div className="space-y-0.5">
                {filteredAdminItems.map(item => (
                  <Link key={item.id} href={item.href} onClick={closeMobileMenu}
                    className={`flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200 group ${pathname.startsWith(item.href) ? 'bg-blue-700 text-white shadow-md' : 'hover:bg-blue-700/40 hover:shadow-sm'}`}
                    onMouseEnter={() => setHoveredItem(item.id)} onMouseLeave={() => setHoveredItem(null)}
                  >
                    {item.id === 'users' && <User className="w-4 h-4 flex-shrink-0" />}
                    {item.id === 'organization' && <Building2 className="w-4 h-4 flex-shrink-0" />}
                    {item.id === 'org-groups' && <Users className="w-4 h-4 flex-shrink-0" />}
                    {!['users', 'organization', 'org-groups'].includes(item.id) && <NotebookText className="w-4 h-4 flex-shrink-0" />}
                    {(isSidebarOpen || isMobile) && (
                      <span className="ml-2 font-medium text-xs">
                        {searchQuery ? <span dangerouslySetInnerHTML={{ __html: highlight(item.label, searchQuery) }} /> : item.label}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Manage Access button ─────────────────────────────────────────── */}
        {(isSidebarOpen || isMobile) && (
          <div className="px-2.5 pb-2">
            <button
              onClick={openAccessModal}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors border border-blue-200"
            >
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              My Board Access
            </button>
          </div>
        )}

        {/* ── User profile / dropdown ──────────────────────────────────────── */}
        <div className="border-t border-gray-200 p-2.5 relative" ref={dropdownRef}>
          {(isSidebarOpen || isMobile) ? (
            <div>
              <button onClick={toggleDropdown} className="w-full flex items-center space-x-2 p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-left">
                <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                  {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{userData.userName || "N/A"}</p>
                  <p className="text-xs text-blue-600 truncate">{userData.email || "N/A"}</p>
                </div>
                <div className="flex-shrink-0">
                  {isDropdownOpen ? <ChevronLeft className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                </div>
              </button>
              {isDropdownOpen && (
                <div className="absolute left-full bottom-0 ml-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2.5 border-b border-gray-100 relative">
                    <button onClick={() => setIsDropdownOpen(false)} className="absolute top-2 right-2 p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X className="w-3.5 h-3.5" /></button>
                    <div className="flex items-center space-x-2 pr-5">
                      <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                        {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{userData.userName || "N/A"}</p>
                        <p className="text-xs text-blue-600 truncate">{userData.email || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button onClick={handleSettingsClick} className="w-full flex items-center space-x-2 p-2.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-3.5 h-3.5" /><span>Settings</span>
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center space-x-2 p-2.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                      <LogOut className="w-3.5 h-3.5" /><span>{t('header.logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <button onClick={toggleDropdown} className="w-full flex justify-center p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-xs">
                  {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                </div>
              </button>
              {isDropdownOpen && (
                <div className="absolute left-full bottom-0 ml-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2.5 border-b border-gray-100">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-xs">
                        {userData.userName ? userData.userName.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{userData.userName || "N/A"}</p>
                        <p className="text-xs text-blue-600 truncate">{userData.email || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button onClick={handleSettingsClick} className="w-full flex items-center space-x-2 p-2.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-3.5 h-3.5" /><span>Settings</span>
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center space-x-2 p-2.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                      <LogOut className="w-3.5 h-3.5" /><span>{t('header.logout')}</span>
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
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-900">Change Password</h2>
                <button onClick={() => { setIsSettingsModalOpen(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {([
                  { label: 'Current Password', key: 'currentPassword' as const, show: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword) },
                  { label: 'New Password', key: 'newPassword' as const, show: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword) },
                  { label: 'Confirm New Password', key: 'confirmPassword' as const, show: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword) },
                ]).map(({ label, key, show, toggle }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
                    <div className="relative">
                      <input type={show ? "text" : "password"} value={passwordData[key]} onChange={e => setPasswordData({ ...passwordData, [key]: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 pr-9" placeholder={`Enter ${label.toLowerCase()}`} />
                      <button type="button" onClick={toggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
                <button onClick={() => { setIsSettingsModalOpen(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} disabled={isUpdatingPassword} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button onClick={handlePasswordUpdate} disabled={isUpdatingPassword} className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                  {isUpdatingPassword ? (<><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />Updating...</>) : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Logo Modal ────────────────────────────────────────────────────── */}
        {isLogoModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                <h2 className="text-base font-bold text-gray-900">Edit Logo</h2>
                <button onClick={handleLogoCancel} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Upload New Logo</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center hover:border-blue-400 transition-colors bg-gray-50">
                    <input type="file" id="logo-upload" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2"><Upload className="w-5 h-5 text-blue-600" /></div>
                      <span className="text-xs font-medium text-gray-700 mb-1">{selectedFile ? selectedFile.name : 'Click to upload'}</span>
                      <span className="text-xs text-gray-500">PNG, JPG, GIF, WebP, SVG up to 5MB</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Description (Optional)</label>
                  <textarea value={logoDescription} onChange={e => setLogoDescription(e.target.value)} placeholder="Enter a description..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none" rows={2} />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
                <button onClick={handleLogoCancel} disabled={isUploading} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button onClick={handleLogoSubmit} disabled={isUploading || !selectedFile} className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                  {isUploading ? (<><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />Uploading...</>) : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Main Board Modal ───────────────────────────────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
            <div className="bg-white rounded-xl shadow-2xl p-5 w-80 mx-4">
              <h2 className="text-base font-bold mb-4 text-gray-900">{t('modal.createMainBoard')}</h2>
              <input
                style={{ color: "black" }} type="text" value={mainBoardName}
                onChange={e => setMainBoardName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder={t('modal.enterMainBoardName')}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end space-x-3">
                <button onClick={() => setIsModalOpen(false)} className="bg-gray-300 hover:bg-gray-400 text-black py-2 px-4 text-sm rounded-lg font-medium transition-all duration-200">{t('modal.cancel')}</button>
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 text-sm rounded-lg font-medium transition-all duration-200">{t('modal.save')}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Create / Edit Board Modal ─────────────────────────────────────── */}
        {showModal && selectedBoard && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={closeModal}>
            <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-sm mx-4 relative" onClick={e => e.stopPropagation()}>
              <div className="mb-4">
                <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-all duration-200" onClick={closeModal}>
                  <X className="w-4 h-4" />
                </button>
                <h2 className="text-base font-bold text-gray-900">{isEditMode ? 'Edit Board' : 'Create New Board'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isEditMode ? `Board ID: ${editingBoardId} • Main Board ID: ${selectedBoard.mainBoardId}` : `Main Board ID: ${selectedBoard.mainBoardId}`}
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Board Name <span className="text-red-500">*</span></label>
                  <input type="text" value={newBoardName} onChange={e => setNewBoardName(e.target.value)}
                    placeholder="Enter board name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
               <div>
  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
    Customer Database Key <span className="text-red-500">*</span>
  </label>

  <select
  value={customerDbKey}
  onChange={(e) => setCustomerDbKey(e.target.value)}
  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
>
  <option value="">Select database</option>

  {customerDbOptions.map((db) => (
    <option key={db} value={db}>
      {db}
    </option>
  ))}
</select>

  {/* <p className="mt-1 text-xs text-gray-500">
    Examples: customer_db_tally, customer_db_onegcp
  </p> */}
</div>
                {newBoardName.trim() && customerDbKey.trim() && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                    <p className="text-xs text-blue-800"><span className="font-semibold">{isEditMode ? 'Ready to update:' : 'Ready to create:'}</span> {newBoardName}</p>
                    <p className="text-xs text-blue-600 mt-0.5">Database: {customerDbKey}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={closeModal} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200">Cancel</button>
                <button onClick={handleCreateBoard} disabled={!newBoardName.trim() || !customerDbKey.trim()}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                  {isEditMode ? 'Update Board' : 'Create Board'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Manage Access Modal ───────────────────────────────────────────── */}
        {showAccessModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">My Board Access</h3>
                    <p className="text-[11px] text-blue-100">Boards you have access to</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccessModal(false)}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {accessLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-600 border-t-transparent" />
                    <p className="text-xs text-gray-400">Loading your access…</p>
                  </div>
                ) : accessError ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                    <p className="text-xs text-red-500 font-medium">{accessError}</p>
                    <button onClick={fetchUserAccess} className="text-xs text-blue-600 underline hover:text-blue-800">Retry</button>
                  </div>
                ) : accessData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                    <Shield className="w-8 h-8 text-gray-200" />
                    <p className="text-xs text-gray-400">No boards assigned to you yet.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">Main Board</th>
                          <th className="text-left font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">Board</th>
                          <th className="text-left font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">Access</th>
                          <th className="text-left font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">Permission</th>
                          <th className="text-left font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {accessData.map((mainBoard: any, idx: number) => {
                          const boards = mainBoard.boards || [];
                          const mainBoardLabel = mainBoard.main_board_name || mainBoard.name || `Main Board #${mainBoard.main_board_id}`;
                          const mainAccess = mainBoard.access_via || null;
                          const shareLabel = mainBoard.share_level ? mainBoard.share_level.replace(/_/g, ' ') : null;

                          const mainBoardCell = (rowSpan: number) => (
                            <td rowSpan={rowSpan} className="align-top px-3 py-2 border-r border-gray-100 bg-gray-50/40">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                <span className="font-bold text-gray-800">{mainBoardLabel}</span>
                              </div>
                              {mainBoard.group_name && (
                                <div className="flex items-center gap-1 text-[10px] text-orange-600 mt-1 pl-5">
                                  <Users className="w-2.5 h-2.5" /> {mainBoard.group_name}
                                </div>
                              )}
                            </td>
                          );

                          if (boards.length === 0) {
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                {mainBoardCell(1)}
                                <td className="px-3 py-2 text-gray-400 italic">No boards</td>
                                <td className="px-3 py-2">
                                  <div className="font-medium text-gray-700">{mainAccess || '—'}</div>
                                  {shareLabel && <div className="text-[10px] text-purple-600">{shareLabel}</div>}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${accessPermission.className}`}>
                                    <accessPermission.Icon className="w-2.5 h-2.5" /> {accessPermission.label}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-300">—</td>
                              </tr>
                            );
                          }

                          return boards.map((board: any, bIdx: number) => (
                            <tr key={`${idx}-${bIdx}`} className="hover:bg-gray-50">
                              {bIdx === 0 && mainBoardCell(boards.length)}
                              <td className="px-3 py-2">
                                <span className="text-gray-700 font-medium">
                                  {board.board_name || board.name || `Board #${board.board_id}`}
                                </span>
                                {board.group_name && (
                                  <div className="flex items-center gap-1 text-[10px] text-orange-600 mt-0.5">
                                    <Users className="w-2.5 h-2.5" /> {board.group_name}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-700">{board.access_via || mainAccess || '—'}</div>
                                {shareLabel && <div className="text-[10px] text-purple-600">{shareLabel}</div>}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${accessPermission.className}`}>
                                  <accessPermission.Icon className="w-2.5 h-2.5" /> {accessPermission.label}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${board.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${board.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                  {board.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="text-[11px] text-gray-400">
                  {accessData.length > 0 ? `${accessData.length} main board${accessData.length !== 1 ? 's' : ''} found` : ''}
                </span>
                <button
                  onClick={() => setShowAccessModal(false)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
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