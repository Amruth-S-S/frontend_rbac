"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import LanguageSelector from '../components/LanguageSelector';
import { Search, Edit2, Trash2, ChevronUp, ChevronDown, ArrowUpDown, X, Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const EXCEL_API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Singapore', 'UAE', 'Japan', 'Other'];
const TIMEZONES = ['Asia/Kolkata', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];

interface ClientUser {
  id: string;
  email: string;
  name: string;
  designation: string;
  country: string;
}

type SortKey = 'name' | 'email' | 'designation' | 'country';
type SortDir = 'asc' | 'desc';

/* ─── Register User Modal ─────────────────────────────────────────────────── */
function RegisterUserModal({ onClose, onRegistered }: { onClose: () => void; onRegistered: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', mobile_number: '',
    password: '', confirm_password: '', country: '',
    timezone: '', department: '', designation: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      const payload: Record<string, string> = {
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, mobile_number: form.mobile_number,
        password: form.password, confirm_password: form.confirm_password,
        country: form.country,
      };
      if (form.timezone) payload.timezone = form.timezone;
      if (form.department) payload.department = form.department;
      if (form.designation) payload.designation = form.designation;

      const res = await fetch(`${API_BASE_URL}/client-users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success('User registered successfully!');
        onRegistered();
        onClose();
      } else {
        const err = await res.json().catch(() => null);
        const msg = err?.detail?.[0]?.msg || err?.message || `Error ${res.status}`;
        toast.error(`Registration failed: ${msg}`);
      }
    } catch { toast.error('Network error — please try again'); }
    finally { setIsLoading(false); }
  };

  const inp = "width:'100%',padding:'9px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:13,color:'#1e293b',background:'#f9fafb',outline:'none',boxSizing:'border-box' as const";
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1e293b', background: '#f9fafb', outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };
  const req = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>;

  return (
    <div style={m.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={m.box}>
        <div style={m.modalHeader}>
          <h2 style={m.modalTitle}>Create New User</h2>
          <button onClick={onClose} style={m.closeBtn} disabled={isLoading}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20, marginTop: -4 }}>
          User will be in "no organization" state until an OWNER/SUPER_ADMIN adds them.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Required */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Required</p>
          <div style={m.grid}>
            <div>
              <label style={labelStyle}>First Name{req}</label>
              <input style={inputStyle} name="first_name" value={form.first_name} onChange={handleChange} required disabled={isLoading} placeholder="John" />
            </div>
            <div>
              <label style={labelStyle}>Last Name{req}</label>
              <input style={inputStyle} name="last_name" value={form.last_name} onChange={handleChange} required disabled={isLoading} placeholder="Doe" />
            </div>
            <div>
              <label style={labelStyle}>Email{req}</label>
              <input style={inputStyle} type="email" name="email" value={form.email} onChange={handleChange} required disabled={isLoading} placeholder="john@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Mobile Number{req}</label>
              <input style={inputStyle} type="tel" name="mobile_number" value={form.mobile_number} onChange={handleChange} required disabled={isLoading} placeholder="+91-9876543210" />
            </div>
            <div>
              <label style={labelStyle}>Password{req}</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inputStyle, paddingRight: 36 }} type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} required disabled={isLoading} placeholder="Min. 8 characters" minLength={8} />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Confirm Password{req}</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inputStyle, paddingRight: 36 }} type={showConfirm ? 'text' : 'password'} name="confirm_password" value={form.confirm_password} onChange={handleChange} required disabled={isLoading} placeholder="Re-enter password" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Country{req}</label>
              <select style={inputStyle} name="country" value={form.country} onChange={handleChange} required disabled={isLoading}>
                <option value="">Select country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Optional */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 10px' }}>Optional</p>
          <div style={m.grid}>
            <div>
              <label style={labelStyle}>Timezone</label>
              <select style={inputStyle} name="timezone" value={form.timezone} onChange={handleChange} disabled={isLoading}>
                <option value="">Select timezone…</option>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Department</label>
              <input style={inputStyle} name="department" value={form.department} onChange={handleChange} disabled={isLoading} placeholder="e.g. Finance" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Designation</label>
              <input style={inputStyle} name="designation" value={form.designation} onChange={handleChange} disabled={isLoading} placeholder="e.g. Manager" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={isLoading} style={m.cancelBtn}>Cancel</button>
            <button type="submit" disabled={isLoading} style={m.saveBtn}>
              {isLoading ? 'Registering…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Edit User Modal ─────────────────────────────────────────────────────── */

function EditUserModal({ user, onClose, onUpdated }: { user: ClientUser; onClose: () => void; onUpdated: () => void }) {
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: user.email || '',
    name: user.name || '',
    password: '',
    designation: user.designation || '',
    country: user.country || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        email: form.email,
        name: form.name,
        designation: form.designation,
        country: form.country,
      };
      if (form.password) payload.password = form.password;

      const res = await fetch(`${API_BASE_URL}/client-users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success('User updated successfully!');
        onUpdated();
        onClose();
      } else {
        const err = await res.json().catch(() => null);
        const msg = err?.detail?.[0]?.msg || err?.message || `Error ${res.status}`;
        toast.error(`Update failed: ${msg}`);
      }
    } catch { toast.error('Network error — please try again'); }
    finally { setIsSaving(false); }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1e293b', background: '#f9fafb', outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };

  return (
    <div style={m.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={m.box}>
        <div style={m.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>
              {(user.name || user.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <h2 style={m.modalTitle}>Edit User</h2>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={m.closeBtn} disabled={isSaving}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div style={m.grid}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} name="name" value={form.name} onChange={handleChange} disabled={isSaving} placeholder="Full name" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" name="email" value={form.email} onChange={handleChange} disabled={isSaving} placeholder="john@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Password <span style={{ color: '#94a3b8', fontWeight: 400 }}>(leave blank to keep current)</span></label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inputStyle, paddingRight: 36 }} type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} disabled={isSaving} placeholder="New password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Designation</label>
              <input style={inputStyle} name="designation" value={form.designation} onChange={handleChange} disabled={isSaving} placeholder="e.g. Manager" />
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <select style={inputStyle} name="country" value={form.country} onChange={handleChange} disabled={isSaving}>
                <option value="">Select country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={isSaving} style={m.cancelBtn}>Cancel</button>
            <button type="submit" disabled={isSaving} style={m.saveBtn}>
              {isSaving ? 'Saving…' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Delete Confirmation Modal ───────────────────────────────────────────── */
function DeleteModal({ userName, onConfirm, onCancel, isDeleting }: { userName: string; onConfirm: () => void; onCancel: () => void; isDeleting: boolean }) {
  return (
    <div style={m.overlay}>
      <div style={{ ...m.box, maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trash2 size={18} color="#dc2626" />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>Delete User</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Are you sure you want to delete <strong>"{userName}"</strong>? This cannot be undone.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} disabled={isDeleting} style={m.cancelBtn}>Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting} style={{ ...m.saveBtn, background: '#dc2626' }}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Session helpers ─────────────────────────────────────────────────────── */
function getSessionInfo(): { userId: string; orgId: number | null; orgRole: string } {
  if (typeof window === 'undefined') return { userId: '', orgId: null, orgRole: '' };
  try {
    const raw = sessionStorage.getItem('currentUserData');
    if (!raw) return { userId: '', orgId: null, orgRole: '' };
    const p = JSON.parse(raw);
    return {
      userId: p.userId ? String(p.userId) : '',
      orgId: p.orgId ? Number(p.orgId) : null,
      orgRole: (p.orgRole || '').toUpperCase(),
    };
  } catch { return { userId: '', orgId: null, orgRole: '' }; }
}

function normalizeDirectoryUser(u: any): ClientUser {
  return {
    id: String(u.id || u.user_id || ''),
    email: u.email || u.user_email || '',
    name: u.full_name || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || '',
    designation: u.designation || u.job_title || u.title || '',
    country: u.country || '',
  };
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function UserList() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const [users, setUsers] = useState<ClientUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ClientUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ClientUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [activeScreenRole, setActiveScreenRole] = useState<'consultant' | 'cxo'>('consultant');
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const isViewer = getSessionInfo().orgRole === 'VIEWER';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) setShowRoleDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync active screen role from localStorage on mount
  useEffect(() => {
    if (pathname === '/CXO' || pathname === '/CXODemo') {
      setActiveScreenRole('cxo');
      localStorage.setItem('activeScreenRole', 'cxo');
    } else if (pathname === '/Container' || pathname === '/Consultant' || pathname === '/Dashboard') {
      setActiveScreenRole('consultant');
      localStorage.setItem('activeScreenRole', 'consultant');
    } else {
      const stored = localStorage.getItem('activeScreenRole') as 'consultant' | 'cxo' | null;
      setActiveScreenRole(stored || 'consultant');
    }
  }, [pathname]);

  const fetchUsers = async () => {
    setIsLoading(true); setError(null);
    try {
      const { userId, orgId, orgRole } = getSessionInfo();
      if ((orgRole === 'OWNER' || orgRole === 'SUPER_ADMIN') && userId && orgId) {
        const res = await fetch(`${API_BASE_URL}/client-users/directory?requester_user_id=${userId}&org_id=${orgId}`, {
          headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
        });
        if (res.ok) {
          let data = await res.json();
          if (!Array.isArray(data)) data = data.users ?? data.data ?? data.members ?? [];
          setUsers(data.map(normalizeDirectoryUser));
          return;
        }
      }
      // Fallback for other roles or if directory API fails
      const res = await fetch(`${API_BASE_URL}/client-users/`, {
        headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      let data = await res.json();
      if (!Array.isArray(data)) data = data.users ?? data.data ?? [];
      setUsers(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast.error(`Failed to load users: ${msg}`);
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} style={{ marginLeft: 4, opacity: 0.4 }} />;
    return sortDir === 'asc' ? <ChevronUp size={11} style={{ marginLeft: 4 }} /> : <ChevronDown size={11} style={{ marginLeft: 4 }} />;
  };

  const processed = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    let list = q
      ? users.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.designation || '').toLowerCase().includes(q) ||
        (u.country || '').toLowerCase().includes(q) ||
        String(u.id || '').includes(q)
      )
      : [...users];
    list.sort((a, b) => {
      const av = (a[sortKey] || '').toLowerCase();
      const bv = (b[sortKey] || '').toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [users, searchTerm, sortKey, sortDir]);

  const confirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/client-users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'X-API-Key': EXCEL_API_KEY },
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
        toast.success(`"${deletingUser.name || deletingUser.email}" deleted`);
      } else {
        const err = await res.json().catch(() => null);
        toast.error(`Delete failed: ${err?.message || res.status}`);
      }
    } catch { toast.error('Network error while deleting'); }
    finally { setIsDeleting(false); setDeletingUser(null); }
  };

  const downloadExcel = () => {
    const data = users.map(u => ({ Name: u.name || '—', Email: u.email || '—', Designation: u.designation || '—', Country: u.country || '—' }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `users_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const avatarLetter = (u: ClientUser) => (u.name || u.email || '?')[0].toUpperCase();

  return (
    <div style={s.outer}>
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar />

      {/* ── Modals ── */}
      {showRegisterModal && (
        <RegisterUserModal
          onClose={() => setShowRegisterModal(false)}
          onRegistered={fetchUsers}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={fetchUsers}
        />
      )}
      {deletingUser && (
        <DeleteModal
          userName={deletingUser.name || deletingUser.email || `User ${deletingUser.id}`}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingUser(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* ── Top Navigation Header ── */}
      <header className="bg-white p-3 shadow-sm">
        <div className="flex justify-end items-center gap-2 max-w-screen-xl mx-auto">
          <LanguageSelector />
          <div className="relative" ref={roleDropdownRef}>
            <button
              onClick={() => setShowRoleDropdown(v => !v)}
              className="flex items-center gap-2 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors border border-gray-200 text-sm"
            >
              <span className="text-sm font-medium">
                {activeScreenRole === 'cxo' ? t('header.cxoRole') : t('header.consultantRole')}
              </span>
              <svg className={`w-3 h-3 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => { localStorage.setItem('activeScreenRole', 'consultant'); setActiveScreenRole('consultant'); setShowRoleDropdown(false); router.push('/Consultant'); }}
                  className={`w-full text-left block px-4 py-2 text-sm hover:bg-gray-50 ${activeScreenRole === 'consultant' ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700'}`}>
                  {t('header.consultantRole')}
                </button>
                <button
                  onClick={() => { localStorage.setItem('activeScreenRole', 'cxo'); setActiveScreenRole('cxo'); setShowRoleDropdown(false); router.push('/CXO'); }}
                  className={`w-full text-left block px-4 py-2 text-sm hover:bg-gray-50 ${activeScreenRole === 'cxo' ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700'}`}>
                  {t('header.cxoRole')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Page Content ── */}
      <div style={s.page}>
        {/* Page title row */}
        <div style={s.titleRow}>
          <div>
            <h1 style={s.pageTitle}>Users</h1>
            <p style={s.pageSub}>{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={downloadExcel} style={s.exportBtn}>
              ↓ Export
            </button>
            <button onClick={() => setShowRegisterModal(true)} style={isViewer ? { ...s.createBtn, opacity: 0.4, cursor: 'not-allowed' } : s.createBtn} disabled={isViewer}>
              + Create User
            </button>
          </div>
        </div>

        {/* Card */}
        <div style={s.card}>
          {/* Search bar */}
          <div style={s.searchRow}>
            <div style={s.searchWrap}>
              <Search size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
              <input
                style={s.searchInput}
                type="text"
                placeholder="Search by name, email, username, role…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}>
                  <X size={14} />
                </button>
              )}
            </div>
            {searchTerm && <span style={s.searchCount}>{processed.length} of {users.length}</span>}
          </div>

          {/* Table wrapper — fixed height so header sticks */}
          {isLoading ? (
            <div style={s.center}>
              <div style={s.spinner} />
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>Loading users…</p>
            </div>
          ) : error ? (
            <div style={s.center}>
              <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>
              <button onClick={fetchUsers} style={{ ...s.createBtn, marginTop: 12, fontSize: 12, padding: '8px 18px' }}>Retry</button>
            </div>
          ) : processed.length === 0 ? (
            <div style={s.center}>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>{searchTerm ? `No users match "${searchTerm}"` : 'No users found'}</p>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {([
                      ['name', 'Name'],
                      ['email', 'Email'],
                      ['designation', 'Designation'],
                      ['country', 'Country'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th key={key} style={s.th} onClick={() => handleSort(key)}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                          {label}<SortIcon col={key} />
                        </span>
                      </th>
                    ))}
                    <th style={{ ...s.th, cursor: 'default' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={s.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={s.avatar}>{avatarLetter(u)}</div>
                          <span style={{ fontWeight: 500 }}>{u.name || '—'}</span>
                        </div>
                      </td>
                      <td style={s.td}>{u.email || '—'}</td>
                      <td style={s.td}>{u.designation || '—'}</td>
                      <td style={s.td}>{u.country || '—'}</td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => setEditingUser(u)}
                            style={isViewer ? { ...s.iconBtn, opacity: 0.4, cursor: 'not-allowed' } : s.iconBtn}
                            title="Edit"
                            disabled={isViewer}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingUser(u)}
                            style={isViewer ? { ...s.iconBtn, ...s.iconBtnDanger, opacity: 0.4, cursor: 'not-allowed' } : { ...s.iconBtn, ...s.iconBtnDanger }}
                            title="Delete"
                            disabled={isViewer}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const m: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(2px)' },
  box: { background: '#fff', borderRadius: 18, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', padding: '28px 32px', width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 4 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  cancelBtn: { padding: '10px 24px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  saveBtn: { padding: '10px 28px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' },
};

const s: Record<string, React.CSSProperties> = {
  outer: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9', fontFamily: "'Segoe UI',sans-serif", overflow: 'hidden' },
  page: { flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 32px', overflow: 'hidden' },
  titleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12, flexShrink: 0 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: '#1e293b', margin: 0 },
  pageSub: { fontSize: 13, color: '#64748b', margin: '4px 0 0' },
  createBtn: { padding: '10px 20px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)', whiteSpace: 'nowrap' },
  exportBtn: { padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#16a34a', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  card: { flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', minHeight: 0 },
  searchRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#f9fafb', padding: '9px 14px', flex: 1, maxWidth: 420 },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#1e293b' },
  searchCount: { fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' },
  tableWrap: { flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '13px 16px', background: '#f8faff', color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid #e2e8f0', whiteSpace: 'nowrap', textAlign: 'left', position: 'sticky', top: 0, zIndex: 5 },
  td: { padding: '13px 16px', fontSize: 13, color: '#334155', verticalAlign: 'middle' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  roleBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#eef2ff', color: '#4338ca' },
  subBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#f0fdf4', color: '#16a34a' },
  iconBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' },
  iconBtnDanger: { border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 20px' },
  spinner: { width: 40, height: 40, border: '4px solid #bfdbfe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};
