"use client";

import { useState, useEffect, useRef } from "react";

const API_BASE = "http://104.225.218.36:8002";
const API_KEY  = "Mnnshh@&!UyqrtvTTXCTvbjjj>ISecuredFCAhyqbjxeg*&@$!7676191005HbghbbwswswIUbwqvQCG1065";

/* ─── Types ────────────────────────────────────────────────── */
interface Member {
  id: number;
  organization_id: number;
  client_user_id: number;
  role: string;
  invited_by: number | null;
  joined_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ─── Toast ────────────────────────────────────────────────── */
type ToastType = "success" | "error" | "info";
interface Toast { id: number; type: ToastType; message: string; }
let _tid = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = (id: number) => setToasts(p => p.filter(t => t.id !== id));
  const show = (type: ToastType, message: string) => {
    const id = ++_tid;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  };
  return { toasts, show, remove };
}

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  const colors: Record<ToastType, string> = { success:"#22c55e", error:"#ef4444", info:"#3b82f6" };
  const icons:  Record<ToastType, string> = { success:"✅", error:"❌", info:"ℹ️" };
  return (
    <div style={{ position:"fixed", top:20, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:10, maxWidth:340, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 16px", borderRadius:12, background:"#fff", borderLeft:`4px solid ${colors[t.type]}`, boxShadow:"0 6px 20px rgba(0,0,0,0.1)", pointerEvents:"all", animation:"slideIn 0.3s ease", fontFamily:"'Segoe UI',sans-serif" }}>
          <span style={{ fontSize:16 }}>{icons[t.type]}</span>
          <p style={{ margin:0, fontSize:13, color:"#1e293b", fontWeight:500, flex:1 }}>{t.message}</p>
          <button onClick={() => remove(t.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:13 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ─── Role badge colors ────────────────────────────────────── */
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  org_admin:   { bg:"#eff6ff", color:"#1d4ed8" },
  consultant:  { bg:"#fef3c7", color:"#92400e" },
  end_user:    { bg:"#f0fdf4", color:"#15803d" },
  org_member:  { bg:"#f0fdf4", color:"#15803d" },
  org_viewer:  { bg:"#f5f3ff", color:"#6d28d9" },
};
const defaultRole = { bg:"#f1f5f9", color:"#475569" };

/* ─── Add Member Modal ─────────────────────────────────────── */
interface ClientUser { id: string; username: string; name: string; email: string; }

function AddMemberModal({ defaultOrgId, defaultUserId, onClose, onAdded }: {
  defaultOrgId: string;
  defaultUserId: string;
  onClose: () => void;
  onAdded: (member: Member) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [orgId,          setOrgId]          = useState(defaultOrgId);
  const [xUserId,        setXUserId]        = useState(defaultUserId);
  const [clientUserId,   setClientUserId]   = useState("");
  const [clientUserName, setClientUserName] = useState("");
  const [role,           setRole]           = useState("");
  const [loading,        setLoading]        = useState(false);
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [roles,          setRoles]          = useState<string[]>([]);
  const [rolesLoading,   setRolesLoading]   = useState(true);
  const [clientUsers,    setClientUsers]    = useState<ClientUser[]>([]);
  const [usersLoading,   setUsersLoading]   = useState(true);
  const [dropdownOpen,   setDropdownOpen]   = useState(false);
  const [userSearch,     setUserSearch]     = useState("");
  const [apiError,       setApiError]       = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/organizations/roles`, {
          headers: { accept: "application/json", "X-API-Key": API_KEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) { setRoles(data); if (data.length > 0) setRole(data[0]); }
      } catch { setRoles(["org_admin","consultant","end_user"]); setRole("org_admin"); }
      finally { setRolesLoading(false); }
    })();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/client-users/`, {
          headers: { accept: "application/json", "X-API-Key": API_KEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setClientUsers(data);
      } catch { /* silent */ }
      finally { setUsersLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredUsers = clientUsers.filter(u => {
    const q = userSearch.toLowerCase();
    return (
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.name     && u.name.toLowerCase().includes(q))     ||
      (u.email    && u.email.toLowerCase().includes(q))    ||
      String(u.id).includes(q)
    );
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!orgId.trim())        e.orgId        = "Organization ID is required.";
    if (!xUserId.trim())      e.xUserId      = "User ID (admin) is required.";
    if (!clientUserId.trim()) e.clientUserId = "Please select a client user.";
    if (!role.trim())         e.role         = "Please select a role.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true); setApiError("");
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId.trim()}/members`, {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          accept:              "application/json",
          "X-API-Key":         API_KEY,
          "X-User-Id":         xUserId.trim(),
          "X-Organization-Id": orgId.trim(),
        },
        body: JSON.stringify({ client_user_id: Number(clientUserId), role }),
      });
      const data = await res.json();
      if (res.ok) {
        onAdded(data);
      } else {
        setApiError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) { setApiError(`Network Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(3px)" }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", padding:"22px 28px", width:"100%", maxWidth:480, fontFamily:"'Segoe UI',sans-serif" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, color:"#2563eb", margin:0 }}>Add Member</h2>
            <p style={{ fontSize:12, color:"#64748b", margin:"2px 0 0" }}>Add a user to an organization</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#94a3b8", lineHeight:1 }}>✕</button>
        </div>

        {/* Org ID + User ID side by side */}
        <div style={{ display:"flex", gap:12, marginBottom:12 }}>
          <div style={{ flex:1 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>
              Organization ID <span style={{ color:"#ef4444" }}>*</span>
            </label>
            <input
              style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:`1.5px solid ${errors.orgId?"#f87171":"#e2e8f0"}`, fontSize:13, color:"#1e293b", background:"#f8fafc", outline:"none", fontFamily:"'Segoe UI',sans-serif" }}
              placeholder="e.g. 20"
              value={orgId}
              onChange={e => { setOrgId(e.target.value); setErrors(p => ({ ...p, orgId:"" })); }}
            />
            {errors.orgId && <p style={{ fontSize:11, color:"#dc2626", margin:"3px 0 0" }}>{errors.orgId}</p>}
          </div>
          <div style={{ flex:1 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>
              User ID (Admin) <span style={{ color:"#ef4444" }}>*</span>
            </label>
            <input
              style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:`1.5px solid ${errors.xUserId?"#f87171":"#e2e8f0"}`, fontSize:13, color:"#1e293b", background:"#f8fafc", outline:"none", fontFamily:"'Segoe UI',sans-serif" }}
              placeholder="e.g. 77"
              value={xUserId}
              onChange={e => { setXUserId(e.target.value); setErrors(p => ({ ...p, xUserId:"" })); }}
            />
            {errors.xUserId && <p style={{ fontSize:11, color:"#dc2626", margin:"3px 0 0" }}>{errors.xUserId}</p>}
          </div>
        </div>

        {/* Client User dropdown */}
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>
             User <span style={{ color:"#ef4444" }}>*</span>
          </label>
          <div ref={dropdownRef} style={{ position:"relative" }}>
            <div
              style={{ display:"flex", alignItems:"center", border:`1.5px solid ${errors.clientUserId?"#f87171":dropdownOpen?"#2563eb":"#e2e8f0"}`, borderRadius:8, background:dropdownOpen?"#fff":"#f8fafc", boxShadow:dropdownOpen?"0 0 0 3px rgba(37,99,235,0.1)":"none", overflow:"hidden", cursor:"pointer", transition:"border-color 0.2s" }}
              onClick={() => setDropdownOpen(v => !v)}
            >
              <span style={{ padding:"0 10px", fontSize:14, color:"#94a3b8", flexShrink:0 }}>👤</span>
              <div style={{ flex:1, padding:"8px 0" }}>
                {clientUserId ? (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:13, color:"#1e293b", fontWeight:600 }}>{clientUserName}</span>
                    <span style={{ fontSize:11, background:"#eff6ff", color:"#2563eb", padding:"1px 8px", borderRadius:20, fontWeight:700 }}>ID: {clientUserId}</span>
                  </div>
                ) : (
                  <span style={{ fontSize:13, color:"#adb5bd" }}>{usersLoading ? "Loading users…" : "Select a user…"}</span>
                )}
              </div>
              {clientUserId && (
                <button onClick={e => { e.stopPropagation(); setClientUserId(""); setClientUserName(""); setUserSearch(""); }}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:"0 6px", color:"#94a3b8", fontSize:14 }}>✕</button>
              )}
              <span style={{ padding:"0 12px 0 4px", color:"#94a3b8", fontSize:11, display:"inline-block", transform:dropdownOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s" }}>▼</span>
            </div>
            {dropdownOpen && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:200, maxHeight:200, display:"flex", flexDirection:"column" }}>
                <div style={{ padding:"8px 10px", borderBottom:"1px solid #f1f5f9" }}>
                  <input style={{ width:"100%", padding:"6px 10px", borderRadius:7, border:"1.5px solid #e2e8f0", fontSize:12, outline:"none", fontFamily:"'Segoe UI',sans-serif" }}
                    placeholder="Search by name, email or ID…"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                </div>
                <div style={{ overflowY:"auto", maxHeight:150 }}>
                  {usersLoading ? (
                    <p style={{ padding:16, fontSize:13, color:"#94a3b8", textAlign:"center" }}>Loading users…</p>
                  ) : filteredUsers.length === 0 ? (
                    <p style={{ padding:16, fontSize:13, color:"#94a3b8", textAlign:"center" }}>No users found.</p>
                  ) : filteredUsers.map(u => (
                    <div key={u.id}
                      onClick={() => { setClientUserId(String(u.id)); setClientUserName(u.username||u.name||`User ${u.id}`); setUserSearch(""); setDropdownOpen(false); setErrors(p => ({ ...p, clientUserId:"" })); }}
                      style={{ padding:"7px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, background:String(u.id)===clientUserId?"#eff6ff":undefined, transition:"background 0.1s" }}
                      onMouseEnter={e => { if (String(u.id)!==clientUserId) (e.currentTarget as HTMLDivElement).style.background="#f0f7ff"; }}
                      onMouseLeave={e => { if (String(u.id)!==clientUserId) (e.currentTarget as HTMLDivElement).style.background=""; }}
                    >
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"#dbeafe", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:"#2563eb" }}>{(u.username||u.name||"?")[0].toUpperCase()}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#1e293b" }}>{u.username||u.name}</p>
                        <p style={{ margin:0, fontSize:11, color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</p>
                      </div>
                      <span style={{ fontSize:11, background:"#f1f5f9", color:"#64748b", padding:"2px 8px", borderRadius:20, flexShrink:0, fontFamily:"monospace" }}>ID: {u.id}</span>
                      {String(u.id)===clientUserId && <span style={{ color:"#2563eb", fontSize:16 }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {errors.clientUserId && <p style={{ fontSize:11, color:"#dc2626", margin:"4px 0 0" }}>{errors.clientUserId}</p>}
        </div>

        {/* Role */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>
            Role <span style={{ color:"#ef4444" }}>*</span>
          </label>
          <div style={{ position:"relative" }}>
            <select
              style={{ width:"100%", padding:"8px 36px 8px 12px", borderRadius:8, border:`1.5px solid ${errors.role?"#f87171":"#e2e8f0"}`, fontSize:13, color:"#1e293b", background:"#f8fafc", outline:"none", cursor:"pointer", appearance:"none", fontFamily:"'Segoe UI',sans-serif" }}
              value={role}
              onChange={e => { setRole(e.target.value); setErrors(p => ({ ...p, role:"" })); }}
              disabled={rolesLoading}
            >
              {rolesLoading ? <option>Loading roles…</option> : <>
                <option value="">-- Select a role --</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </>}
            </select>
            <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:"#94a3b8", fontSize:11 }}>▼</span>
          </div>
          {errors.role && <p style={{ fontSize:11, color:"#dc2626", margin:"3px 0 0" }}>{errors.role}</p>}
        </div>

        {apiError && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"8px 12px", marginBottom:12, fontSize:12, color:"#dc2626" }}>
            {apiError}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} disabled={loading}
            style={{ padding:"8px 22px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Segoe UI',sans-serif" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading || rolesLoading}
            style={{ padding:"8px 28px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontSize:13, fontWeight:700, cursor: loading||rolesLoading?"not-allowed":"pointer", boxShadow:"0 4px 14px rgba(37,99,235,0.35)", opacity:loading||rolesLoading?0.7:1, fontFamily:"'Segoe UI',sans-serif" }}>
            {loading ? "Adding…" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Edit Member Modal ────────────────────────────────────── */
function EditMemberModal({ member, orgId, xUserId, onClose, onSaved }: {
  member: Member;
  orgId: string;
  xUserId: string;
  onClose: () => void;
  onSaved: (updated: Member) => void;
}) {
  const [role,    setRole]    = useState(member.role);
  const [roles,   setRoles]   = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [error,   setError]   = useState("");

  const resolvedUid = xUserId ||
    localStorage.getItem("userId") ||
    localStorage.getItem("user_id") || "";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/organizations/roles`, {
          headers: { accept: "application/json", "X-API-Key": API_KEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setRoles(data);
        else setRoles(["org_admin","consultant","end_user","org_member","org_viewer"]);
      } catch { setRoles(["org_admin","consultant","end_user","org_member","org_viewer"]); }
      finally { setRolesLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/members/${member.client_user_id}`, {
        method: "PUT",
        headers: {
          "Content-Type":      "application/json",
          accept:              "application/json",
          "X-API-Key":         API_KEY,
          "X-Organization-Id": orgId,
          ...(resolvedUid ? { "X-User-Id": resolvedUid } : {}),
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved({ ...member, role });
      } else {
        setError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      setError(`Network Error: ${e.message}`);
    } finally { setLoading(false); }
  };

  const rc = ROLE_COLORS[member.role] ?? defaultRole;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(3px)" }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", padding:"24px 28px", width:"100%", maxWidth:420, fontFamily:"'Segoe UI',sans-serif" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22 }}>✏️</span>
            <div>
              <h2 style={{ fontSize:17, fontWeight:700, color:"#1e293b", margin:0 }}>Edit Member Role</h2>
              <p style={{ fontSize:12, color:"#64748b", margin:"2px 0 0" }}>Update role for this member</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#94a3b8" }}>✕</button>
        </div>

        {/* Member info banner */}
        <div style={{ background:"#f8faff", border:"1px solid #bfdbfe", borderRadius:10, padding:"12px 16px", marginBottom:18, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:"#dbeafe", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#2563eb", flexShrink:0 }}>
              {String(member.client_user_id)[0]}
            </div>
            <div>
              <p style={{ margin:0, fontSize:13, fontWeight:700, color:"#1e293b" }}>User #{member.client_user_id}</p>
              <p style={{ margin:0, fontSize:11, color:"#64748b" }}>Member ID: #{member.id} · Org ID: #{orgId}</p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:"#64748b" }}>Current Role:</span>
            <span style={{ background:rc.bg, color:rc.color, padding:"2px 10px", borderRadius:20, fontSize:12, fontWeight:700 }}>{member.role}</span>
          </div>
          {member.joined_at && (
            <p style={{ margin:0, fontSize:11, color:"#94a3b8" }}>Joined: {formatDate(member.joined_at)}</p>
          )}
        </div>

        {/* Role selector */}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:6 }}>
            New Role <span style={{ color:"#ef4444" }}>*</span>
          </label>
          <div style={{ position:"relative" }}>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              disabled={rolesLoading}
              style={{ width:"100%", padding:"9px 36px 9px 12px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, color:"#1e293b", background:"#f8fafc", outline:"none", cursor:"pointer", appearance:"none", fontFamily:"'Segoe UI',sans-serif" }}
            >
              {rolesLoading
                ? <option>Loading roles…</option>
                : roles.map(r => <option key={r} value={r}>{r}</option>)
              }
            </select>
            <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:"#94a3b8", fontSize:11 }}>▼</span>
          </div>
        </div>

        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:12, color:"#dc2626" }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} disabled={loading}
            style={{ padding:"8px 22px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Segoe UI',sans-serif" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading || rolesLoading}
            style={{ padding:"8px 26px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontSize:13, fontWeight:700, cursor:loading?"not-allowed":"pointer", boxShadow:"0 4px 12px rgba(37,99,235,0.3)", opacity:loading?0.7:1, fontFamily:"'Segoe UI',sans-serif" }}>
            {loading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */
export default function MemberList() {
  const { toasts, show, remove } = useToast();

  const [orgId,      setOrgId]      = useState("");
  const [xUserId,    setXUserId]    = useState("");
  const [members,    setMembers]    = useState<Member[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [activeOrg,  setActiveOrg]  = useState("");
  const [filterText, setFilterText] = useState("");
  const [deletingIds, setDeletingIds] = useState<number[]>([]);
  const [confirmMember, setConfirmMember] = useState<Member | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editMember,    setEditMember]    = useState<Member | null>(null);
  const [clientUserMap, setClientUserMap] = useState<Record<number, { username: string; name: string; email: string }>>({});

  /* fetch client users for username lookup */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/client-users/`, {
          headers: { accept: "application/json", "X-API-Key": API_KEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          const map: Record<number, { username: string; name: string; email: string }> = {};
          data.forEach((u: any) => { map[Number(u.id)] = { username: u.username || "", name: u.name || "", email: u.email || "" }; });
          setClientUserMap(map);
        }
      } catch { /* silent — username display degrades gracefully */ }
    })();
  }, []);

  /* auto-load from localStorage + handle redirect from Add Member */
  useEffect(() => {
    const stored = localStorage.getItem("userId") || localStorage.getItem("user_id") || "";
    if (stored) setXUserId(stored);

    const raw = sessionStorage.getItem("memberAdded");
    if (raw) {
      sessionStorage.removeItem("memberAdded");
      try {
        const { title, message, orgId: oid, userId: uid } = JSON.parse(raw);
        show("success", `${title}${message ? " — " + message : ""}`);
        if (oid) {
          setOrgId(oid);
          if (uid) setXUserId(uid);
          fetchMembers(oid, uid || stored);
        }
      } catch { /* ignore parse errors */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMembers = async (oid: string, uid?: string) => {
    if (!oid.trim()) { show("error", "Please enter an Organization ID."); return; }
    const resolvedUid = (uid ?? xUserId).trim();
    setLoading(true); setMembers([]);
    try {
      const res = await fetch(`${API_BASE}/organizations/${oid.trim()}/members`, {
        headers: {
          accept:              "application/json",
          "X-API-Key":         API_KEY,
          "X-Organization-Id": oid.trim(),
          ...(resolvedUid ? { "X-User-Id": resolvedUid } : {}),
        },
      });
      const data = await res.json();
      if (res.ok) {
        const list = Array.isArray(data) ? data : [];
        setMembers(list);
        setActiveOrg(oid.trim());
        if (list.length === 0) show("info", "No members found for this organization.");
        else show("success", `${list.length} member${list.length > 1 ? "s" : ""} loaded.`);
      } else {
        const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data);
        show("error", `Error ${res.status}: ${detail}`);
      }
    } catch (e: any) {
      show("error", `Network Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmAndDelete = (member: Member) => {
    if (!activeOrg) {
      show("error", "No active organization. Please fetch members first.");
      return;
    }
    setConfirmMember(member);
  };

  const deleteMember = async (member: Member) => {
    setConfirmMember(null);
    setDeletingIds(prev => [...prev, member.id]);

    try {
      const res = await fetch(`${API_BASE}/organizations/${activeOrg}/members/${member.client_user_id}`, {
        method: "DELETE",
        headers: {
          accept:              "application/json",
          "X-API-Key":         API_KEY,
          "X-Organization-Id": activeOrg,
          ...(xUserId.trim() ? { "X-User-Id": xUserId.trim() } : {}),
        },
      });

      if (res.ok || res.status === 204) {
        setMembers(prev => prev.filter(m => m.id !== member.id));
        show("success", `Member #${member.client_user_id} (${member.role}) removed successfully.`);
      } else {
        let errorMsg = `Failed to remove member (${res.status})`;
        try {
          const data = await res.json();
          errorMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data);
        } catch (e) {
          // ignore
        }
        show("error", errorMsg);
      }
    } catch (err: any) {
      show("error", `Network error: ${err.message}`);
    } finally {
      setDeletingIds(prev => prev.filter(id => id !== member.id));
    }
  };

  const filtered = members.filter(m =>
    String(m.client_user_id).includes(filterText) ||
    m.role.toLowerCase().includes(filterText.toLowerCase()) ||
    String(m.id).includes(filterText) ||
    (m.invited_by !== null && String(m.invited_by).includes(filterText))
  );

  /* role summary counts */
  const roleCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; }
        .mem-row:hover { background:#f8faff !important; }
        .act-btn:hover { opacity:0.8; }
        .spinner { width:18px; height:18px; border:2.5px solid #fca5a5; border-top-color:#ef4444; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; }
        .fi { border:none; outline:none; background:transparent; font-size:14px; color:#1e293b; font-family:'Segoe UI',sans-serif; }
        .fi::placeholder { color:#adb5bd; }
        .fi::-webkit-outer-spin-button,.fi::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
      `}</style>

      <ToastContainer toasts={toasts} remove={remove} />

      {/* ── Edit Member Modal ── */}
      {editMember && (
        <EditMemberModal
          member={editMember}
          orgId={activeOrg}
          xUserId={xUserId}
          onClose={() => setEditMember(null)}
          onSaved={updated => {
            setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
            setEditMember(null);
            show("success", `Member #${updated.client_user_id} role updated to "${updated.role}".`);
          }}
        />
      )}

      {/* ── Add Member Modal ── */}
      {addMemberOpen && (
        <AddMemberModal
          defaultOrgId={activeOrg || orgId}
          defaultUserId={xUserId}
          onClose={() => setAddMemberOpen(false)}
          onAdded={(member) => {
            setAddMemberOpen(false);
            show("success", `Member #${member.client_user_id} (${member.role}) added successfully!`);
            if (activeOrg) fetchMembers(activeOrg);
          }}
        />
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmMember && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10000, padding:20, backdropFilter:"blur(2px)" }}
          onClick={() => !deletingIds.includes(confirmMember.id) && setConfirmMember(null)}>
          <div style={{ background:"#fff", borderRadius:18, boxShadow:"0 16px 48px rgba(0,0,0,0.18)", padding:"32px 36px", width:"100%", maxWidth:440, fontFamily:"'Segoe UI',sans-serif" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ textAlign:"center", paddingBottom:16 }}>
              <span style={{ fontSize:44 }}>🗑️</span>
              <h3 style={{ fontSize:18, fontWeight:700, color:"#1e293b", margin:"12px 0 6px" }}>Remove Member?</h3>
              <p style={{ fontSize:13, color:"#64748b", margin:0 }}>
                You are about to remove <strong style={{ color:"#1e293b" }}>User #{confirmMember.client_user_id}</strong> ({confirmMember.role}).
                <br />This action cannot be undone.
              </p>
            </div>

            {/* Info banner */}
            <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:8, padding:"10px 14px", marginBottom:16, display:"flex", gap:8, alignItems:"center" }}>
              <span>⚠️</span>
              <span style={{ fontSize:12, color:"#92400e" }}>
                <strong>Member ID:</strong> {confirmMember.id}&nbsp;&nbsp;·&nbsp;&nbsp;
                <strong>Org ID:</strong> {activeOrg}&nbsp;&nbsp;·&nbsp;&nbsp;
                <strong>Role:</strong> {confirmMember.role}
              </span>
            </div>

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button
                onClick={() => setConfirmMember(null)}
                disabled={deletingIds.includes(confirmMember.id)}
                style={{ padding:"10px 24px", borderRadius:10, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:14, fontWeight:600, cursor:"pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMember(confirmMember)}
                disabled={deletingIds.includes(confirmMember.id)}
                style={{ padding:"10px 28px", borderRadius:10, border:"none", background:"#ef4444", color:"#fff", fontSize:14, fontWeight:700, cursor: deletingIds.includes(confirmMember.id) ? "not-allowed" : "pointer", boxShadow:"0 4px 12px rgba(239,68,68,0.3)", opacity: deletingIds.includes(confirmMember.id) ? 0.8 : 1 }}
              >
                {deletingIds.includes(confirmMember.id) ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={s.page}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Organization Members</h1>
            <p style={s.pageSub}>List all members of an organization</p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {activeOrg && (
              <div style={s.badge}>
                <span style={{ fontSize:12, color:"#64748b" }}>Org ID:</span>
                <strong style={{ fontSize:13, color:"#2563eb" }}>#{activeOrg}</strong>
              </div>
            )}
            <button style={s.addBtn} onClick={() => setAddMemberOpen(true)}>
              + Add Member
            </button>
          </div>
        </div>

        {/* ── Search card ── */}
        <div style={s.searchCard}>
          <div style={s.searchRow}>
            {/* Org ID */}
            <div style={s.inputBox}>
              <span style={{ padding:"0 10px", fontSize:13, color:"#94a3b8", fontWeight:700 }}>#</span>
              <input
                className="fi"
                style={{ flex:1, padding:"10px 0" }}
                placeholder="Organization ID (required)"
                value={orgId}
                onChange={e => setOrgId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchMembers(orgId)}
              />
            </div>

            {/* X-User-Id */}
            <div style={{ ...s.inputBox, flex:"0 0 180px" }}>
              <span style={{ padding:"0 10px", fontSize:13, color:"#94a3b8" }}>👤</span>
              <input
                className="fi"
                style={{ flex:1, padding:"10px 0" }}
                placeholder="X-User-Id"
                value={xUserId}
                onChange={e => setXUserId(e.target.value)}
              />
            </div>

            <button style={s.fetchBtn} onClick={() => fetchMembers(orgId)} disabled={loading}>
              {loading ? "Loading…" : "Fetch Members"}
            </button>
            {members.length > 0 && (
              <button style={s.clearBtn} onClick={() => { setMembers([]); setFilterText(""); setActiveOrg(""); }}>
                Clear
              </button>
            )}
          </div>

          {/* Filter */}
          {members.length > 0 && (
            <div style={{ ...s.inputBox, marginTop:12 }}>
              <span style={{ padding:"0 10px", fontSize:15 }}>🔍</span>
              <input
                className="fi"
                style={{ flex:1, padding:"10px 0" }}
                placeholder="Filter by role, user ID, member ID…"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
              />
              {filterText && (
                <button onClick={() => setFilterText("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:"0 10px", fontSize:16 }}>✕</button>
              )}
            </div>
          )}
        </div>

        {/* ── Role summary pills ── */}
        {Object.keys(roleCounts).length > 0 && (
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            {Object.entries(roleCounts).map(([role, count]) => {
              const c = ROLE_COLORS[role] ?? defaultRole;
              return (
                <div key={role} style={{ display:"flex", alignItems:"center", gap:6, background:c.bg, border:`1px solid ${c.color}30`, borderRadius:20, padding:"5px 14px" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:c.color }}>{role}</span>
                  <span style={{ fontSize:12, background:"#fff", color:c.color, borderRadius:20, padding:"1px 8px", fontWeight:700 }}>{count}</span>
                </div>
              );
            })}
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:20, padding:"5px 14px" }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#64748b" }}>Total</span>
              <span style={{ fontSize:12, background:"#fff", color:"#64748b", borderRadius:20, padding:"1px 8px", fontWeight:700 }}>{members.length}</span>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div style={s.tableCard}>
          {loading ? (
            <div style={s.empty}>
              <span style={{ fontSize:32 }}>⏳</span>
              <p style={{ color:"#64748b", fontSize:14, marginTop:10 }}>Loading members…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>
              <span style={{ fontSize:40 }}>👥</span>
              <p style={{ color:"#94a3b8", fontSize:14, marginTop:10 }}>
                {members.length === 0
                  ? "Enter an Organization ID and click \"Fetch Members\"."
                  : "No results match your filter."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["#","Member ID","Org ID","Client User ID","Role","Invited By","Joined At","Actions"].map(col => (
                      <th key={col} style={s.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const rc = ROLE_COLORS[m.role] ?? defaultRole;
                    const isDeleting = deletingIds.includes(m.id);
                    return (
                      <tr key={m.id} className="mem-row" style={{ background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                        <td style={{ ...s.td, color:"#94a3b8", fontSize:12 }}>{i + 1}</td>
                        <td style={{ ...s.td, fontWeight:700, color:"#2563eb" }}>#{m.id}</td>
                        <td style={{ ...s.td, color:"#64748b" }}>
                          <span style={{ background:"#eff6ff", color:"#2563eb", padding:"2px 10px", borderRadius:20, fontSize:12, fontWeight:600 }}>
                            {m.organization_id}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontWeight:600, color:"#1e293b" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {/* <div style={{ width:32, height:32, borderRadius:"50%", background:"#dbeafe", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#2563eb", flexShrink:0 }}>
                              {(clientUserMap[m.client_user_id]?.username || clientUserMap[m.client_user_id]?.name || String(m.client_user_id))[0].toUpperCase()}
                            </div> */}
                            <div>
                              <div style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>
                                {clientUserMap[m.client_user_id]?.username || clientUserMap[m.client_user_id]?.name || `User #${m.client_user_id}`}
                              </div>
                              <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:2 }}>
                                <span style={{ fontSize:11, color:"#94a3b8" }}>ID: {m.client_user_id}</span>
                                {/* {clientUserMap[m.client_user_id]?.email && (
                                  <span style={{ fontSize:11, color:"#94a3b8" }}>· {clientUserMap[m.client_user_id].email}</span>
                                )} */}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={s.td}>
                          <span style={{ background:rc.bg, color:rc.color, padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700 }}>
                            {m.role}
                          </span>
                        </td>
                        <td style={{ ...s.td, color:"#64748b" }}>
                          {m.invited_by !== null ? (
                            <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                              <span style={{ background:"#f1f5f9", color:"#475569", padding:"2px 10px", borderRadius:20, fontSize:12, display:"inline-block", width:"fit-content" }}>
                                {clientUserMap[m.invited_by]?.username || clientUserMap[m.invited_by]?.name || `#${m.invited_by}`}
                              </span>
                              {clientUserMap[m.invited_by]?.username && (
                                <span style={{ fontSize:10, color:"#94a3b8", paddingLeft:4 }}>ID: {m.invited_by}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color:"#cbd5e1", fontSize:12 }}>—</span>
                          )}
                        </td>
                        <td style={{ ...s.td, color:"#64748b", fontSize:12, whiteSpace:"nowrap" }}>
                          {formatDate(m.joined_at)}
                        </td>
                        <td style={{ ...s.td, textAlign:"center" }}>
                          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                            <button
                              className="act-btn"
                              onClick={() => setEditMember(m)}
                              disabled={!activeOrg}
                              style={{ padding:"6px 14px", borderRadius:8, border:"1.5px solid #bfdbfe", background:"#eff6ff", color:"#2563eb", fontSize:12, fontWeight:600, cursor:!activeOrg?"not-allowed":"pointer", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:5 }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="act-btn"
                              onClick={() => confirmAndDelete(m)}
                              disabled={isDeleting || !activeOrg}
                              style={{ padding:"6px 14px", borderRadius:8, border:"1.5px solid #fecaca", background: isDeleting ? "#fee2e2" : "#fef2f2", color:"#dc2626", fontSize:12, fontWeight:600, cursor: isDeleting || !activeOrg ? "not-allowed" : "pointer", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:6, opacity: isDeleting ? 0.7 : 1 }}
                            >
                              {isDeleting ? <span className="spinner" style={{ width:13, height:13, borderWidth:2 }} /> : "🗑️"}
                              {isDeleting ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div style={s.tableFooter}>
              Showing <strong>{filtered.length}</strong> of <strong>{members.length}</strong> members
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Styles ───────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page:       { minHeight:"100vh", background:"#f1f5f9", padding:"36px 32px", fontFamily:"'Segoe UI',sans-serif" },
  header:     { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 },
  pageTitle:  { fontSize:26, fontWeight:700, color:"#1e293b", margin:0 },
  pageSub:    { fontSize:13, color:"#64748b", margin:"4px 0 0" },
  badge:      { display:"flex", alignItems:"center", gap:8, background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:"8px 14px" },
  addBtn:     { padding:"10px 22px", borderRadius:10, border:"none", background:"#2563eb", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 12px rgba(37,99,235,0.25)", whiteSpace:"nowrap" },
  searchCard: { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", padding:"20px 24px", marginBottom:20 },
  searchRow:  { display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" },
  inputBox:   { flex:1, minWidth:160, display:"flex", alignItems:"center", border:"1.5px solid #e2e8f0", borderRadius:10, background:"#f9fafb", overflow:"hidden" },
  fetchBtn:   { padding:"10px 24px", borderRadius:10, border:"none", background:"#2563eb", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" },
  clearBtn:   { padding:"10px 18px", borderRadius:10, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:14, fontWeight:600, cursor:"pointer" },
  tableCard:  { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden" },
  table:      { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:         { padding:"13px 16px", background:"#f8faff", color:"#64748b", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", borderBottom:"1.5px solid #e2e8f0", whiteSpace:"nowrap", textAlign:"left" },
  td:         { padding:"13px 16px", borderBottom:"1px solid #f1f5f9", fontSize:13, color:"#334155", verticalAlign:"middle" },
  empty:      { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"64px 20px", textAlign:"center" },
  tableFooter:{ padding:"12px 20px", fontSize:12, color:"#94a3b8", borderTop:"1px solid #f1f5f9", textAlign:"right" },
};