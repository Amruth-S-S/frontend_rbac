"use client";

import { useState, useEffect } from "react";

const API_BASE = "http://104.225.218.36:8002";
const API_KEY  = "Mnnshh@&!UyqrtvTTXCTvbjjj>ISecuredFCAhyqbjxeg*&@$!7676191005HbghbbwswswIUbwqvQCG1065";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface Organization {
  id: number;
  name: string;
  slug: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Toast                                                               */
/* ------------------------------------------------------------------ */
type ToastType = "success" | "error" | "info";
interface Toast { id: number; type: ToastType; message: string; }
let _tid = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = (id: number) => setToasts(p => p.filter(t => t.id !== id));
  const show   = (type: ToastType, message: string) => {
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
    <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:9999, display:"flex", flexDirection:"column", alignItems:"center", gap:10, maxWidth:340, pointerEvents:"none" }}>
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

/* ------------------------------------------------------------------ */
/*  Edit Modal  — PUT /organizations/{org_id}/                         */
/*  Headers: X-API-Key, X-User-Id, X-Organization-Id                  */
/*  Body:    { name, is_active }                                       */
/* ------------------------------------------------------------------ */
function EditModal({ org, userId, onClose, onSaved }: {
  org: Organization;
  userId: string;
  onClose: () => void;
  onSaved: (updated: Organization) => void;
}) {
  const [name,     setName]     = useState(org.name);
  const [isActive, setIsActive] = useState(org.is_active);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const resolvedUserId = userId ||
    localStorage.getItem("userId") ||
    localStorage.getItem("user_id") || "";

  const handleSave = async () => {
    if (!name.trim()) { setError("Organization name is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/organizations/${org.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type":      "application/json",
          accept:              "application/json",
          "X-API-Key":         API_KEY,
          "X-Organization-Id": String(org.id),
          ...(resolvedUserId ? { "X-User-Id": resolvedUserId } : {}),
        },
        body: JSON.stringify({ name, is_active: isActive }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data);
      } else {
        setError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      setError(`Network Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.box} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <h3 style={m.title}>Edit Organization</h3>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Name */}
        <div style={m.field}>
          <label style={m.label}>Organization Name <span style={{ color:"#ef4444" }}>*</span></label>
          <input
            style={m.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Acme Corporation"
          />
        </div>

        {/* Active toggle */}
        <div style={{ ...m.field, display:"flex", alignItems:"center", gap:12 }}>
          <label style={{ ...m.label, marginBottom:0, flex:1 }}>Status</label>
          <div
            onClick={() => setIsActive(v => !v)}
            style={{ width:48, height:26, borderRadius:13, cursor:"pointer", background:isActive ? "#2563eb" : "#cbd5e1", position:"relative", transition:"background 0.2s", flexShrink:0 }}
          >
            <div style={{ position:"absolute", top:3, left:isActive ? 25 : 3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
          </div>
          <span style={{ fontSize:12, color:isActive ? "#16a34a" : "#94a3b8", fontWeight:600, minWidth:50 }}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:12 }}>{error}</p>}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={m.saveBtn}   onClick={handleSave} disabled={loading}>
            {loading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Modal  — DELETE /organizations/{org_id}/members/{user_id}   */
/*  Headers: X-API-Key, X-User-Id, X-Organization-Id                  */
/* ------------------------------------------------------------------ */
function DeleteModal({ org, userId, onClose, onDeleted }: {
  org: Organization;
  userId: string;
  onClose: () => void;
  onDeleted: (id: number) => void;
}) {
  const [memberUserId, setMemberUserId] = useState(userId);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const handleDelete = async () => {
    if (!memberUserId.trim()) { setError("Member User ID is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${org.id}/members/${memberUserId.trim()}/`,
        {
          method: "DELETE",
          headers: {
            accept:              "application/json",
            "X-API-Key":         API_KEY,
            "X-Organization-Id": String(org.id),   // required by API
            ...(userId ? { "X-User-Id": userId } : {}),
          },
        }
      );
      if (res.ok || res.status === 204) {
        onDeleted(org.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      setError(`Network Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={{ ...m.box, maxWidth:440 }} onClick={e => e.stopPropagation()}>

        {/* Title */}
        <div style={{ textAlign:"center", paddingBottom:16 }}>
          <span style={{ fontSize:44 }}>🗑️</span>
          <h3 style={{ fontSize:18, fontWeight:700, color:"#1e293b", margin:"12px 0 6px" }}>Remove Member?</h3>
          <p style={{ fontSize:13, color:"#64748b", margin:0 }}>
            Remove a member from <strong style={{ color:"#1e293b" }}>"{org.name}"</strong>.
            <br />Requires <code style={{ fontSize:11, background:"#f1f5f9", padding:"1px 6px", borderRadius:4 }}>org_admin</code> permission.
          </p>
        </div>

        {/* Member User ID */}
        <div style={m.field}>
          <label style={m.label}>Member User ID <span style={{ color:"#ef4444" }}>*</span></label>
          <input
            style={m.input}
            placeholder="Enter user_id to remove"
            value={memberUserId}
            onChange={e => setMemberUserId(e.target.value)}
          />
          <p style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>
            The user ID of the member to remove from this organization.
          </p>
        </div>

        {/* Info banner */}
        <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:8, padding:"10px 14px", marginBottom:16, display:"flex", gap:8, alignItems:"center" }}>
          <span>⚠️</span>
          <span style={{ fontSize:12, color:"#92400e" }}>
            <strong>Org ID:</strong> {org.id}&nbsp;&nbsp;·&nbsp;&nbsp;<strong>Org:</strong> {org.name}
          </span>
        </div>

        {error && <p style={{ fontSize:12, color:"#dc2626", marginBottom:12 }}>{error}</p>}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button
            style={{ ...m.saveBtn, background:"#ef4444", boxShadow:"0 4px 12px rgba(239,68,68,0.3)" }}
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Removing…" : "Yes, Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Org Modal                                                    */
/* ------------------------------------------------------------------ */
function CreateOrgModal({ defaultUserId, onClose, onCreated }: {
  defaultUserId: string;
  onClose: () => void;
  onCreated: (org: Organization) => void;
}) {
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [userId,      setUserId]      = useState(defaultUserId);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [apiError,    setApiError]    = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())        e.name        = "Organization name is required.";
    if (!description.trim()) e.description = "Description is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true); setApiError("");
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept:         "application/json",
        "X-API-Key":    API_KEY,
      };
      if (userId.trim()) headers["X-User-Id"] = userId.trim();

      const res = await fetch(`${API_BASE}/organizations/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: name.trim(), slug: description.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated(data);
      } else {
        setApiError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      setApiError(`Network Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(3px)" }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", padding:"24px 30px", width:"100%", maxWidth:460, fontFamily:"'Segoe UI',sans-serif" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, color:"#2563eb", margin:0 }}>Create Organization</h2>
            <p style={{ fontSize:12, color:"#64748b", margin:"3px 0 0" }}>Fill in the details to create a new organization</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#94a3b8" }}>✕</button>
        </div>

        {/* Org Name */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>
            Organization Name <span style={{ color:"#ef4444" }}>*</span>
          </label>
          <input
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1.5px solid ${errors.name?"#f87171":"#e2e8f0"}`, fontSize:13, color:"#1e293b", background:"#f8fafc", outline:"none", fontFamily:"'Segoe UI',sans-serif" }}
            placeholder="e.g. Acme Corporation"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name:"" })); }}
          />
          {errors.name && <p style={{ fontSize:11, color:"#dc2626", margin:"3px 0 0" }}>{errors.name}</p>}
        </div>

        {/* Description */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>
            Description <span style={{ color:"#ef4444" }}>*</span>
          </label>
          <input
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1.5px solid ${errors.description?"#f87171":"#e2e8f0"}`, fontSize:13, color:"#1e293b", background:"#f8fafc", outline:"none", fontFamily:"'Segoe UI',sans-serif" }}
            placeholder="Enter a short description"
            value={description}
            onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description:"" })); }}
          />
          {errors.description && <p style={{ fontSize:11, color:"#dc2626", margin:"3px 0 0" }}>{errors.description}</p>}
        </div>

        {/* User ID */}
        <div style={{ marginBottom:18 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>User ID (Admin)</label>
          <input
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, color:"#1e293b", background:"#f8fafc", outline:"none", fontFamily:"'Segoe UI',sans-serif" }}
            placeholder="Enter your user ID"
            value={userId}
            onChange={e => setUserId(e.target.value)}
          />
        </div>

        {apiError && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:12, color:"#dc2626" }}>
            {apiError}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} disabled={loading}
            style={{ padding:"8px 22px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Segoe UI',sans-serif" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            style={{ padding:"8px 28px", borderRadius:8, border:"none", background:"#2563eb", color:"#fff", fontSize:13, fontWeight:700, cursor:loading?"not-allowed":"pointer", boxShadow:"0 4px 14px rgba(37,99,235,0.35)", opacity:loading?0.7:1, fontFamily:"'Segoe UI',sans-serif" }}>
            {loading ? "Creating…" : "Save Organization"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */
export default function OrganizationList() {

  const [orgs,          setOrgs]          = useState<Organization[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [searchId,      setSearchId]      = useState("");
  const [activeUid,     setActiveUid]     = useState("");
  const [filterText,    setFilterText]    = useState("");
  const [editOrg,       setEditOrg]       = useState<Organization | null>(null);
  const [deleteOrg,     setDeleteOrg]     = useState<Organization | null>(null);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const { toasts, show, remove } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem("userId") || localStorage.getItem("user_id") || "";
    if (stored) { setSearchId(stored); fetchOrgs(stored); }
  }, []);

  const fetchOrgs = async (uid: string) => {
    if (!uid.trim()) { show("error", "Please enter a User ID."); return; }
    setLoading(true); setOrgs([]);
    try {
      const res = await fetch(`${API_BASE}/organizations/`, {
        headers: { accept:"application/json", "X-API-Key":API_KEY, "X-User-Id":uid.trim() },
      });
      const data = await res.json();
      if (res.ok) {
        setOrgs(Array.isArray(data) ? data : []);
        setActiveUid(uid.trim());
        if (data.length === 0) show("info", "No organizations found for this user.");
        else show("success", `${data.length} organization${data.length > 1 ? "s" : ""} loaded.`);
      } else {
        show("error", `Error ${res.status}: ${typeof data.detail === "string" ? data.detail : JSON.stringify(data)}`);
      }
    } catch (e: any) {
      show("error", `Network Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdited = (updated: Organization) => {
    setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o));
    setEditOrg(null);
    show("success", `"${updated.name}" updated successfully.`);
  };

  const handleDeleted = (id: number) => {
    setOrgs(prev => prev.filter(o => o.id !== id));
    setDeleteOrg(null);
    show("success", "Member removed successfully.");
  };

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(filterText.toLowerCase()) ||
    o.slug.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
        * { box-sizing:border-box; }
        .org-row:hover { background:#f8faff !important; }
        .act-btn:hover { opacity:0.8; }
      `}</style>

      <ToastContainer toasts={toasts} remove={remove} />
      {editOrg      && <EditModal      org={editOrg}   userId={activeUid} onClose={() => setEditOrg(null)}   onSaved={handleEdited}   />}
      {deleteOrg    && <DeleteModal    org={deleteOrg} userId={activeUid} onClose={() => setDeleteOrg(null)} onDeleted={handleDeleted} />}
      {createOrgOpen && <CreateOrgModal defaultUserId={activeUid || searchId} onClose={() => setCreateOrgOpen(false)} onCreated={org => { setCreateOrgOpen(false); setOrgs(prev => [org, ...prev]); show("success", `"${org.name}" created successfully! (ID: ${org.id})`); }} />}

      <div style={s.page}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Organizations</h1>
            <p style={s.pageSub}>Browse and manage organizations by User ID</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {activeUid && (
              <div style={s.badge}>
                <span style={{ fontSize:12, color:"#64748b" }}>User ID:</span>
                <strong style={{ fontSize:13, color:"#2563eb" }}>#{activeUid}</strong>
              </div>
            )}
            <button style={s.createBtn} onClick={() => setCreateOrgOpen(true)}>
              + Create Organization
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div style={s.searchCard}>
          <div style={s.searchRow}>
            <div style={s.searchWrap}>
              <span style={{ padding:"0 10px", fontSize:15 }}>🔍</span>
              <input
                style={s.searchInput}
                placeholder="Enter User ID to fetch organizations…"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchOrgs(searchId)}
              />
            </div>
            <button style={s.fetchBtn} onClick={() => fetchOrgs(searchId)} disabled={loading}>
              {loading ? "Fetching…" : "Fetch"}
            </button>
            {orgs.length > 0 && (
              <button style={s.clearBtn} onClick={() => { setOrgs([]); setFilterText(""); setActiveUid(""); }}>
                Clear
              </button>
            )}
          </div>
          {orgs.length > 0 && (
            <input
              style={{ ...s.searchInput, marginTop:12, paddingLeft:14, borderRadius:10, border:"1.5px solid #e2e8f0", background:"#f9fafb" }}
              placeholder="Filter by name or slug…"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          )}
        </div>

        {/* Table */}
        <div style={s.tableCard}>
          {loading ? (
            <div style={s.empty}>
              <span style={{ fontSize:32 }}>⏳</span>
              <p style={{ color:"#64748b", fontSize:14, marginTop:10 }}>Loading organizations…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>
              <span style={{ fontSize:40 }}>🏢</span>
              <p style={{ color:"#94a3b8", fontSize:14, marginTop:10 }}>
                {orgs.length === 0
                  ? "Enter a User ID above and click Fetch to load organizations."
                  : "No results match your filter."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["Org_ID","Org_Name","Org_Description","Status","Actions"].map(col => (
                      <th key={col} style={{ ...s.th, textAlign: col === "Actions" ? "center" : "left" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((org, i) => (
                    <tr key={org.id} className="org-row" style={{ background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                      <td style={{ ...s.td, fontWeight:700, color:"#2563eb" }}>#{org.id}</td>
                      <td style={{ ...s.td, fontWeight:600, color:"#1e293b" }}>{org.name}</td>
                      <td style={s.td}><span style={s.slugBadge}>{org.slug}</span></td>
                      {/* <td style={{ ...s.td, color:"#64748b" }}>User #{org.created_by}</td>
                      <td style={{ ...s.td, color:"#64748b" }}>{formatDate(org.created_at)}</td> */}
                      <td style={s.td}>
                        <span style={{ ...s.statusBadge, background:org.is_active ? "#dcfce7" : "#fee2e2", color:org.is_active ? "#16a34a" : "#dc2626" }}>
                          {org.is_active ? "● Active" : "● Inactive"}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign:"center" }}>
                        <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                          <button className="act-btn" style={s.editBtn}   onClick={() => setEditOrg(org)}>✏️ Edit</button>
                          <button className="act-btn" style={s.deleteBtn} onClick={() => setDeleteOrg(org)}>🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div style={s.tableFooter}>
              Showing <strong>{filtered.length}</strong> of <strong>{orgs.length}</strong> organizations
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal styles (m)                                                    */
/* ------------------------------------------------------------------ */
const m: Record<string, React.CSSProperties> = {
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20, backdropFilter:"blur(2px)" },
  box:     { background:"#fff", borderRadius:18, boxShadow:"0 16px 48px rgba(0,0,0,0.18)", padding:"32px 36px", width:"100%", maxWidth:500, fontFamily:"'Segoe UI',sans-serif" },
  header:  { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 },
  title:   { fontSize:18, fontWeight:700, color:"#1e293b", margin:0 },
  closeBtn:{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#94a3b8" },
  field:   { marginBottom:18 },
  label:   { display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:7 },
  input:   { width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:14, color:"#1e293b", background:"#f9fafb", outline:"none" },
  cancelBtn:{ padding:"10px 24px", borderRadius:10, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:14, fontWeight:600, cursor:"pointer" },
  saveBtn:  { padding:"10px 28px", borderRadius:10, border:"none", background:"#2563eb", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 12px rgba(37,99,235,0.3)" },
};

/* ------------------------------------------------------------------ */
/*  Page styles (s)                                                     */
/* ------------------------------------------------------------------ */
const s: Record<string, React.CSSProperties> = {
  page:      { minHeight:"100vh", background:"#f1f5f9", padding:"36px 32px", fontFamily:"'Segoe UI',sans-serif" },
  header:    { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 },
  pageTitle: { fontSize:26, fontWeight:700, color:"#1e293b", margin:0 },
  pageSub:   { fontSize:13, color:"#64748b", margin:"4px 0 0" },
  badge:     { display:"flex", alignItems:"center", gap:8, background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:"8px 14px" },
  createBtn: { padding:"10px 22px", borderRadius:10, border:"none", background:"#2563eb", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 12px rgba(37,99,235,0.25)", whiteSpace:"nowrap" },
  searchCard:{ background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", padding:"20px 24px", marginBottom:20 },
  searchRow: { display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" },
  searchWrap:{ flex:1, minWidth:220, display:"flex", alignItems:"center", border:"1.5px solid #e2e8f0", borderRadius:10, background:"#f9fafb", overflow:"hidden" },
  searchInput:{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:14, color:"#1e293b", padding:"10px 10px 10px 0" },
  fetchBtn:  { padding:"10px 24px", borderRadius:10, border:"none", background:"#2563eb", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" },
  clearBtn:  { padding:"10px 18px", borderRadius:10, border:"1.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:14, fontWeight:600, cursor:"pointer" },
  tableCard: { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden" },
  table:     { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:        { padding:"13px 16px", background:"#f8faff", color:"#64748b", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", borderBottom:"1.5px solid #e2e8f0", whiteSpace:"nowrap" },
  td:        { padding:"13px 16px", borderBottom:"1px solid #f1f5f9", fontSize:13, color:"#334155", verticalAlign:"middle" },
  slugBadge: { background:"#f1f5f9", color:"#475569", padding:"3px 10px", borderRadius:6, fontSize:12, fontFamily:"monospace" },
  statusBadge:{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600 },
  editBtn:   { padding:"6px 14px", borderRadius:8, border:"1.5px solid #bfdbfe", background:"#eff6ff", color:"#2563eb", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" },
  deleteBtn: { padding:"6px 14px", borderRadius:8, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" },
  empty:     { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"64px 20px", textAlign:"center" },
  tableFooter:{ padding:"12px 20px", fontSize:12, color:"#94a3b8", borderTop:"1px solid #f1f5f9", textAlign:"right" },
};