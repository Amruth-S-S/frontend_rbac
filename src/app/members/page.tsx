"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const API_BASE     = "http://104.225.218.36:8002";
const API_KEY      = "Mnnshh@&!UyqrtvTTXCTvbjjj>ISecuredFCAhyqbjxeg*&@$!7676191005HbghbbwswswIUbwqvQCG1065";
const USERS_API    = process.env.NEXT_PUBLIC_API_BASE_URL || "http://104.225.218.36:8002";
const USERS_APIKEY = process.env.NEXT_PUBLIC_API_KEY     || API_KEY;

/* ─── Types ──────────────────────────────────────────────────────── */
interface ClientUser {
  id: string;
  username: string;
  name: string;
  email: string;
}

/* ─── Toast ─────────────────────────────────────────────────────── */
type ToastType = "success" | "error";
interface Toast { id: number; type: ToastType; title: string; message?: string; }
let _tid = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = (id: number) => setToasts(p => p.filter(t => t.id !== id));
  const show = (type: ToastType, title: string, message?: string) => {
    const id = ++_tid;
    setToasts(p => [...p, { id, type, title, message }]);
    setTimeout(() => remove(id), 4500);
  };
  return { toasts, show, remove };
}

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:9999, display:"flex", flexDirection:"column", alignItems:"center", gap:10, maxWidth:360, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"14px 16px", borderRadius:10, background:"#fff", borderLeft:`4px solid ${t.type==="success"?"#22c55e":"#ef4444"}`, boxShadow:"0 4px 20px rgba(0,0,0,0.1)", pointerEvents:"all", animation:"slideIn 0.3s ease", fontFamily:"'Segoe UI',sans-serif" }}>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, margin:0, color:t.type==="success"?"#15803d":"#dc2626" }}>{t.title}</p>
            {t.message && <p style={{ fontSize:11, color:"#64748b", margin:"3px 0 0", wordBreak:"break-all" }}>{t.message}</p>}
          </div>
          <button onClick={()=>remove(t.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:12, padding:0 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function AddMemberPage() {
  const router = useRouter();
  const { toasts, show, remove } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [orgId,           setOrgId]           = useState("");
  const [xUserId,         setXUserId]         = useState("");
  const [clientUserId,    setClientUserId]    = useState("");  // actual ID sent to API
  const [clientUserName,  setClientUserName]  = useState("");  // display label
  const [role,            setRole]            = useState("");
  const [loading,         setLoading]         = useState(false);
  const [errors,          setErrors]          = useState<Record<string, string>>({});

  // roles
  const [roles,        setRoles]        = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // client users dropdown
  const [clientUsers,      setClientUsers]      = useState<ClientUser[]>([]);
  const [usersLoading,     setUsersLoading]     = useState(true);
  const [dropdownOpen,     setDropdownOpen]     = useState(false);
  const [userSearch,       setUserSearch]       = useState("");

  /* ── Auto-populate X-User-Id from localStorage ── */
  useEffect(() => {
    const stored =
      localStorage.getItem("loggedInUserId") ||
      localStorage.getItem("userId") ||
      localStorage.getItem("user_id") || "";
    if (stored) setXUserId(stored);
  }, []);

  /* ── Fetch roles ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/organizations/roles`, {
          headers: { accept:"application/json", "X-API-Key":API_KEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) { setRoles(data); if (data.length>0) setRole(data[0]); }
      } catch {
        setRoles(["org_admin","consultant","end_user"]); setRole("org_admin");
      } finally { setRolesLoading(false); }
    })();
  }, []);

  /* ── Fetch client users ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${USERS_API}/client-users/`, {
          headers: { accept:"application/json", "X-API-Key":USERS_APIKEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setClientUsers(data);
      } catch {
        // silently fail — user can type manually
      } finally { setUsersLoading(false); }
    })();
  }, []);

  /* ── Close dropdown on outside click ── */
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

  const selectUser = (u: ClientUser) => {
    setClientUserId(String(u.id));
    setClientUserName(u.username || u.name || `User ${u.id}`);
    setUserSearch("");
    setDropdownOpen(false);
    setErrors(p => ({ ...p, clientUserId:"" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!orgId.trim())        e.orgId        = "Organization ID is required.";
    if (!xUserId.trim())      e.xUserId      = "X-User-Id (admin ID) is required.";
    if (!clientUserId.trim()) e.clientUserId = "Please select a client user.";
    if (!role.trim())         e.role         = "Please select a role.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
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
        sessionStorage.setItem("memberAdded", JSON.stringify({
          title: "Member added successfully!",
          message: `${clientUserName} (ID:${clientUserId}) added as "${role}" · invited_by: ${data.invited_by ?? "—"}`,
          orgId: orgId.trim(),
          userId: xUserId.trim(),
        }));
        router.push("/member-list");
      } else {
        const detail = typeof data.detail==="string" ? data.detail : JSON.stringify(data);
        show("error",`Error ${res.status}`, detail);
      }
    } catch (e: any) {
      show("error","Network Error", e.message);
    } finally { setLoading(false); }
  };

  const handleCancel = () => {
    setOrgId(""); setXUserId(""); setClientUserId(""); setClientUserName(""); setRole(roles[0]??""); setErrors({});
    router.push("/member-list");
  };

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
        @keyframes dropDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; }
        .fi {
          width:100%; padding:12px 16px; border-radius:10px;
          border:1.5px solid #e2e8f0; font-size:14px; color:#1e293b;
          background:#f8fafc; outline:none; font-family:'Segoe UI',sans-serif;
          transition:border-color 0.2s,box-shadow 0.2s; appearance:none;
        }
        .fi:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.1); background:#fff; }
        .fi.err { border-color:#f87171; }
        .fi::placeholder { color:#adb5bd; }
        .fi::-webkit-outer-spin-button,.fi::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
        .fi[type=number] { -moz-appearance:textfield; }
        .user-opt { padding:10px 14px; cursor:pointer; display:flex; align-items:center; gap:10px; transition:background 0.1s; }
        .user-opt:hover { background:#f0f7ff; }
        .btn-cancel { padding:12px 32px; border-radius:10px; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; font-size:14px; font-weight:600; cursor:pointer; font-family:'Segoe UI',sans-serif; transition:background 0.15s; }
        .btn-cancel:hover:not(:disabled) { background:#f1f5f9; }
        .btn-save { padding:12px 40px; border-radius:10px; border:none; background:#2563eb; color:#fff; font-size:14px; font-weight:700; cursor:pointer; font-family:'Segoe UI',sans-serif; box-shadow:0 4px 14px rgba(37,99,235,0.35); transition:background 0.15s; }
        .btn-save:hover:not(:disabled) { background:#1d4ed8; }
        .btn-save:disabled,.btn-cancel:disabled { opacity:0.6; cursor:not-allowed; }
      `}</style>

      <ToastContainer toasts={toasts} remove={remove} />

      <div style={s.page}>
        <div style={s.card}>

          <h2 style={s.title}>Add Member</h2>
          <p style={s.subtitle}>Add a user to an organization. </p>

          {/* Request diagram */}
          {/* <div style={s.diagram}>
            {[
              { tag:"path",   label:"org_id",          val: orgId||"—",           note:"path + X-Organization-Id" },
              { tag:"header", label:"X-User-Id",        val: xUserId||"—",         note:"sets invited_by" },
              { tag:"body",   label:"client_user_id",   val: clientUserId ? `${clientUserName} (ID: ${clientUserId})` : "—", note:"" },
              { tag:"body",   label:"role",             val: role||"—",            note:"" },
            ].map(r => (
              <div key={r.label} style={s.diagramRow}>
                <span style={r.tag==="path" ? s.tagPath : r.tag==="header" ? s.tagHeader : s.tagBody}>{r.tag}</span>
                <code style={s.diagramCode}>{r.label}</code>
                <span style={s.arrow}>→</span>
                <span style={s.diagramDesc}><strong>{r.val}</strong>{r.note && <em style={{ color:"#94a3b8" }}> · {r.note}</em>}</span>
              </div>
            ))}
          </div> */}

          {/* 1. Org ID */}
          <div style={s.field}>
            <div style={s.labelRow}>
              <label style={s.label}>Organization ID <span style={s.req}>*</span></label>
              
            </div>
            <input className={`fi${errors.orgId?" err":""}`} placeholder="e.g. 49" type="text"
              value={orgId} onChange={e=>{ setOrgId(e.target.value); setErrors(p=>({...p,orgId:""})); }} />
            
          </div>

          {/* 2. X-User-Id */}
          <div style={s.field}>
            <div style={s.labelRow}>
              <label style={s.label}>User Id (Admin) <span style={s.req}>*</span></label>
              {xUserId && <span style={{ fontSize:11, background:"#f0fdf4", color:"#16a34a", border:"1px solid #bbf7d0", padding:"1px 8px", borderRadius:20, fontWeight:700 }}>auto-filled</span>}
            </div>
            <input className={`fi${errors.xUserId?" err":""}`} placeholder="e.g. 64" type="text"
              value={xUserId} onChange={e=>{ setXUserId(e.target.value); setErrors(p=>({...p,xUserId:""})); }} />
          </div>

          {/* 3. Client User — searchable dropdown */}
          <div style={s.field}>
            <div style={s.labelRow}>
              <label style={s.label}>Client User <span style={s.req}>*</span></label>
              <div style={{ display:"flex", gap:6 }}>
              
              </div>
            </div>

            <div ref={dropdownRef} style={{ position:"relative" }}>
              {/* Selected display / search input */}
              <div
                style={{
                  display:"flex", alignItems:"center",
                  border:`1.5px solid ${errors.clientUserId?"#f87171": dropdownOpen?"#2563eb":"#e2e8f0"}`,
                  borderRadius:10, background: dropdownOpen?"#fff":"#f8fafc",
                  boxShadow: dropdownOpen?"0 0 0 3px rgba(37,99,235,0.1)":"none",
                  overflow:"hidden", cursor:"pointer",
                  transition:"border-color 0.2s",
                }}
                onClick={() => setDropdownOpen(v=>!v)}
              >
                {/* Avatar or icon */}
                <span style={{ padding:"0 12px", fontSize:16, color:"#94a3b8", flexShrink:0 }}>👤</span>

                {/* Text area */}
                <div style={{ flex:1, padding:"11px 0" }}>
                  {clientUserId ? (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14, color:"#1e293b", fontWeight:600 }}>{clientUserName}</span>
                      <span style={{ fontSize:11, background:"#eff6ff", color:"#2563eb", padding:"1px 8px", borderRadius:20, fontWeight:700 }}>
                        ID: {clientUserId}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize:14, color:"#adb5bd" }}>
                      {usersLoading ? "Loading users…" : "Select a user…"}
                    </span>
                  )}
                </div>

                {/* Clear btn */}
                {clientUserId && (
                  <button
                    onClick={e=>{ e.stopPropagation(); setClientUserId(""); setClientUserName(""); setUserSearch(""); }}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:"0 8px", color:"#94a3b8", fontSize:16 }}
                  >✕</button>
                )}

                {/* Chevron */}
                <span style={{ padding:"0 14px 0 4px", color:"#94a3b8", fontSize:12, transition:"transform 0.2s", display:"inline-block", transform: dropdownOpen?"rotate(180deg)":"rotate(0deg)" }}>▼</span>
              </div>

              {/* Dropdown panel */}
              {dropdownOpen && (
                <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:12, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:100, animation:"dropDown 0.2s ease", maxHeight:280, display:"flex", flexDirection:"column" }}>

                  {/* Search inside dropdown */}
                  <div style={{ padding:"10px 12px", borderBottom:"1px solid #f1f5f9" }}>
                    <input
                      className="fi"
                      style={{ padding:"8px 12px", fontSize:13 }}
                      placeholder="Search by name, username, email or ID…"
                      value={userSearch}
                      onChange={e=>setUserSearch(e.target.value)}
                      onClick={e=>e.stopPropagation()}
                      autoFocus
                    />
                  </div>

                  {/* List */}
                  <div style={{ overflowY:"auto", maxHeight:210 }}>
                    {usersLoading ? (
                      <p style={{ padding:"16px", fontSize:13, color:"#94a3b8", textAlign:"center" }}>Loading users…</p>
                    ) : filteredUsers.length === 0 ? (
                      <p style={{ padding:"16px", fontSize:13, color:"#94a3b8", textAlign:"center" }}>No users found.</p>
                    ) : filteredUsers.map(u => (
                      <div
                        key={u.id}
                        className="user-opt"
                        onClick={()=>selectUser(u)}
                        style={{ background: String(u.id)===clientUserId ? "#eff6ff" : undefined }}
                      >
                        {/* Avatar circle */}
                        <div style={{ width:32, height:32, borderRadius:"50%", background:"#dbeafe", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:"#2563eb" }}>
                            {(u.username||u.name||"?")[0].toUpperCase()}
                          </span>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#1e293b" }}>{u.username || u.name}</p>
                          <p style={{ margin:0, fontSize:11, color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</p>
                        </div>
                        <span style={{ fontSize:11, background:"#f1f5f9", color:"#64748b", padding:"2px 8px", borderRadius:20, flexShrink:0, fontFamily:"monospace" }}>
                          ID: {u.id}
                        </span>
                        {String(u.id)===clientUserId && <span style={{ color:"#2563eb", fontSize:16 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected ID display below */}
            
          </div>

          {/* 4. Role */}
          <div style={s.field}>
            <div style={s.labelRow}>
              <label style={s.label}>Role <span style={s.req}>*</span></label>
              <div style={{ display:"flex", gap:6 }}>
                
              </div>
            </div>
            <div style={{ position:"relative" }}>
              <select className={`fi${errors.role?" err":""}`} value={role}
                onChange={e=>{ setRole(e.target.value); setErrors(p=>({...p,role:""})); }}
                disabled={rolesLoading} style={{ cursor:"pointer", paddingRight:40 }}>
                {rolesLoading ? <option>Loading roles…</option> : <>
                  <option value="">-- Select a role --</option>
                  {roles.map(r=><option key={r} value={r}>{r}</option>)}
                </>}
              </select>
              <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:"#94a3b8", fontSize:12 }}>▼</span>
            </div>
           
          </div>

          {/* Buttons */}
          <div style={s.btnRow}>
            <button className="btn-cancel" onClick={handleCancel} disabled={loading}>Cancel</button>
            <button className="btn-save" onClick={handleSave} disabled={loading||rolesLoading}>
              {loading ? "Adding…" : "Add Member"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:       { minHeight:"100vh", background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", padding:"48px 20px", fontFamily:"'Segoe UI',sans-serif" },
  card:       { background:"#fff", borderRadius:18, boxShadow:"0 4px 24px rgba(0,0,0,0.08)", padding:"40px 48px", width:"100%", maxWidth:580 },
  title:      { fontSize:26, fontWeight:700, color:"#2563eb", textAlign:"center", margin:"0 0 6px" },
  subtitle:   { fontSize:13, color:"#64748b", textAlign:"center", margin:"0 0 24px" },
  code:       { fontSize:11, background:"#f1f5f9", padding:"1px 5px", borderRadius:4, color:"#475569", fontFamily:"monospace" },
  diagram:    { background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:"14px 18px", marginBottom:28, display:"flex", flexDirection:"column", gap:7 },
  diagramRow: { display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" },
  diagramCode:{ fontSize:11, fontFamily:"monospace", color:"#334155", background:"#fff", border:"1px solid #e2e8f0", padding:"2px 7px", borderRadius:5 },
  diagramDesc:{ fontSize:12, color:"#64748b" },
  arrow:      { color:"#94a3b8", fontSize:12 },
  field:      { marginBottom:22 },
  labelRow:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 },
  label:      { fontSize:13, fontWeight:600, color:"#374151" },
  req:        { color:"#ef4444" },
  errText:    { fontSize:11, color:"#dc2626", marginTop:5 },
  hint:       { fontSize:11, color:"#94a3b8", marginTop:5 },
  btnRow:     { display:"flex", gap:12, marginTop:32, justifyContent:"flex-end" },
  tagPath:    { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#fef3c7", color:"#92400e" },
  tagHeader:  { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#ede9fe", color:"#5b21b6" },
  tagBody:    { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#dcfce7", color:"#15803d" },
  liveTag:    { fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#f0fdf4", color:"#16a34a", border:"1px solid #bbf7d0" },
};