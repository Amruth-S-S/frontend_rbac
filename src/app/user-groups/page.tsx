
   
   
"use client";

import { useState, useEffect } from "react";


const API_BASE = "http://104.225.218.36:8002";
const API_KEY  = "Mnnshh@&!UyqrtvTTXCTvbjjj>ISecuredFCAhyqbjxeg*&@$!7676191005HbghbbwswswIUbwqvQCG1065";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface UserGroup {
  id: number;
  organization_id: number;
  name: string;
  description: string;
  created_by: number;
  created_at: string;
  is_active: boolean;
}

interface GroupMember {
  id: number;
  group_id: number;
  client_user_id: number;
  added_by: number;
  added_at: string;
}

interface GroupAccess {
  id: number;
  group_id: number;
  resource_type: string;
  resource_id: number;
  action: string;
  granted_by: number;
  granted_at: string;
}

interface EffectiveAccessItem {
  resource_type: string;
  resource_id: number;
  actions: string[];
}

interface EffectiveAccess {
  group_id: number;
  organization_id: number;
  access: EffectiveAccessItem[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function apiHeaders(userId: string, orgId: string, json = true): Record<string, string> {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    accept: "application/json",
    "X-API-Key": API_KEY,
    "X-User-Id": userId,
    "X-Organization-Id": orgId,
  };
}

const ACTION_COLORS: Record<string, string> = {
  read: "#3b82f6", create: "#22c55e", update: "#f59e0b", delete: "#ef4444",
};
const RESOURCE_COLORS: Record<string, string> = {
  board: "#8b5cf6", main_board: "#2563eb", data_source: "#0891b2",
};

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
  const colors: Record<ToastType, string> = { success: "#22c55e", error: "#ef4444", info: "#3b82f6" };
  const icons:  Record<ToastType, string> = { success: "✅", error: "❌", info: "ℹ️" };
  return (
    <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 340, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 12, background: "#fff", borderLeft: `4px solid ${colors[t.type]}`, boxShadow: "0 6px 20px rgba(0,0,0,0.1)", pointerEvents: "all", animation: "slideIn 0.3s ease", fontFamily: "'Segoe UI',sans-serif" }}>
          <span style={{ fontSize: 16 }}>{icons[t.type]}</span>
          <p style={{ margin: 0, fontSize: 13, color: "#1e293b", fontWeight: 500, flex: 1 }}>{t.message}</p>
          <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Group Modal                                                  */
/* ------------------------------------------------------------------ */
function CreateModal({ orgId, userId, onClose, onCreated }: {
  orgId: string; userId: string;
  onClose: () => void; onCreated: (g: UserGroup) => void;
}) {
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const handleCreate = async () => {
    if (!name.trim()) { setError("Group name is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/`, {
        method: "POST",
        headers: apiHeaders(userId, orgId),
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (res.ok) { onCreated(data); }
      else { setError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`); }
    } catch (e: any) { setError(`Network Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.box} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>👥</span><h3 style={m.title}>Create Group</h3></div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={m.field}>
          <label style={m.label}>Group Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input style={m.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Development Team" />
        </div>
        <div style={m.field}>
          <label style={m.label}>Description</label>
          <textarea style={{ ...m.input, minHeight: 80, resize: "vertical" }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description…" />
        </div>
        <div style={m.infoBanner}><span>🏢</span><span style={{ fontSize: 12, color: "#1e40af" }}>Creating group under <strong>Org ID:</strong> {orgId}</span></div>
        {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={m.saveBtn} onClick={handleCreate} disabled={loading}>{loading ? "Creating…" : "Create Group"}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit Group Modal                                                    */
/* ------------------------------------------------------------------ */
function EditModal({ group, orgId, userId, onClose, onSaved }: {
  group: UserGroup; orgId: string; userId: string;
  onClose: () => void; onSaved: (g: UserGroup) => void;
}) {
  const [name, setName]               = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("Group name is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}`, {
        method: "PUT",
        headers: apiHeaders(userId, orgId),
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (res.ok) { onSaved(data); }
      else { setError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`); }
    } catch (e: any) { setError(`Network Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.box} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>✏️</span><h3 style={m.title}>Edit Group</h3></div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={m.field}>
          <label style={m.label}>Group Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input style={m.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Development Team" />
        </div>
        <div style={m.field}>
          <label style={m.label}>Description</label>
          <textarea style={{ ...m.input, minHeight: 80, resize: "vertical" }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description…" />
        </div>
        <div style={m.infoBanner}><span>🔑</span><span style={{ fontSize: 12, color: "#1e40af" }}><strong>Group ID:</strong> {group.id} &nbsp;·&nbsp; <strong>Org ID:</strong> {orgId}</span></div>
        {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={m.saveBtn} onClick={handleSave} disabled={loading}>{loading ? "Saving…" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Group Modal                                                  */
/* ------------------------------------------------------------------ */
function DeleteModal({ group, orgId, userId, onClose, onDeleted }: {
  group: UserGroup; orgId: string; userId: string;
  onClose: () => void; onDeleted: (id: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleDelete = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}`, {
        method: "DELETE",
        headers: apiHeaders(userId, orgId, false),
      });
      if (res.ok || res.status === 204) { onDeleted(group.id); }
      else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) { setError(`Network Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={{ ...m.box, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: "center", paddingBottom: 16 }}>
          <span style={{ fontSize: 44 }}>🗑️</span>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "12px 0 6px" }}>Delete Group?</h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            You are about to delete <strong style={{ color: "#1e293b" }}>"{group.name}"</strong>.<br />This action cannot be undone.
          </p>
        </div>
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <span>⚠️</span>
          <span style={{ fontSize: 12, color: "#92400e" }}><strong>Group ID:</strong> {group.id} · <strong>Org ID:</strong> {orgId}</span>
        </div>
        {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={{ ...m.saveBtn, background: "#ef4444", boxShadow: "0 4px 12px rgba(239,68,68,0.3)" }} onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Member Modal                                                    */
/* ------------------------------------------------------------------ */
function AddMemberModal({ group, orgId, userId, onClose, onAdded }: {
  group: UserGroup; orgId: string; userId: string;
  onClose: () => void; onAdded: (member: GroupMember) => void;
}) {
  const [clientUserId, setClientUserId] = useState("");
  const [search, setSearch]             = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clientUsers, setClientUsers]   = useState<{ id: number; username: string; name: string }[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/client-users/`, {
          headers: { accept: "application/json", "X-API-Key": API_KEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setClientUsers(data.map((u: any) => ({ id: Number(u.id), username: u.username || "", name: u.name || "" })));
        }
      } catch { /* silent */ }
      finally { setUsersLoading(false); }
    })();
  }, []);

  const selectedUser = clientUsers.find(u => String(u.id) === clientUserId);
  const filtered = clientUsers.filter(u => {
    const q = search.toLowerCase();
    return (
      String(u.id).includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q)
    );
  });

  const handleAdd = async () => {
    if (!clientUserId.trim()) { setError("Please select a user."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}/members`, {
        method: "POST",
        headers: apiHeaders(userId, orgId),
        body: JSON.stringify({ client_user_id: parseInt(clientUserId) }),
      });
      const data = await res.json();
      if (res.ok) { onAdded(data); }
      else { setError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`); }
    } catch (e: any) { setError(`Network Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ ...m.overlay, zIndex: 1100 }} onClick={onClose}>
      <div style={m.box} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>➕</span><h3 style={m.title}>Add Member to Group</h3></div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={m.infoBanner}>
          <span>👥</span>
          <span style={{ fontSize: 12, color: "#1e40af" }}>Adding member to <strong>{group.name}</strong> (Group #{group.id})</span>
        </div>
        <div style={m.field}>
          <label style={m.label}>Select User <span style={{ color: "#ef4444" }}>*</span></label>

          {/* Dropdown trigger */}
          <div
            style={{ ...m.input, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", position: "relative" }}
            onClick={() => { if (!usersLoading) setDropdownOpen(v => !v); }}
          >
            <div style={{ flex: 1, padding: "10px 14px", fontSize: 14, color: selectedUser ? "#1e293b" : "#94a3b8" }}>
              {usersLoading
                ? "Loading users…"
                : selectedUser
                  ? `${selectedUser.username || selectedUser.name} — #${selectedUser.id}`
                  : "Search and select a user…"}
            </div>
            <span style={{ paddingRight: 12, color: "#94a3b8", fontSize: 12 }}>{dropdownOpen ? "▲" : "▼"}</span>
          </div>

          {/* Dropdown list */}
          {dropdownOpen && (
            <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", marginTop: 4, overflow: "hidden", zIndex: 10, position: "relative" }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                <input
                  autoFocus
                  style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", background: "#f9fafb", color: "#1e293b" }}
                  placeholder="Search by name or ID…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: "14px 16px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>No users found</div>
                ) : filtered.map(u => (
                  <div
                    key={u.id}
                    onClick={() => { setClientUserId(String(u.id)); setSearch(""); setDropdownOpen(false); setError(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: clientUserId === String(u.id) ? "#eff6ff" : "transparent", borderBottom: "1px solid #f8faff" }}
                    onMouseEnter={e => { if (clientUserId !== String(u.id)) (e.currentTarget as HTMLDivElement).style.background = "#f8faff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = clientUserId === String(u.id) ? "#eff6ff" : "transparent"; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#2563eb", flexShrink: 0 }}>
                      {(u.username || u.name || String(u.id))[0].toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{u.username || u.name || `User #${u.id}`}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>ID: {u.id}{u.name && u.username ? ` · ${u.name}` : ""}</p>
                    </div>
                    {clientUserId === String(u.id) && <span style={{ marginLeft: "auto", color: "#2563eb", fontSize: 14 }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={m.saveBtn} onClick={handleAdd} disabled={loading || !clientUserId}>{loading ? "Adding…" : "Add Member"}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Grant Access Modal                                                  */
/* ------------------------------------------------------------------ */
function GrantAccessModal({ group, orgId, userId, onClose, onGranted }: {
  group: UserGroup; orgId: string; userId: string;
  onClose: () => void; onGranted: (access: GroupAccess) => void;
}) {
  const [resourceType, setResourceType] = useState("board");
  const [resourceId, setResourceId]     = useState("");
  const [action, setAction]             = useState("read");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const handleGrant = async () => {
    if (!resourceId.trim()) { setError("Resource ID is required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}/access`, {
        method: "POST",
        headers: apiHeaders(userId, orgId),
        body: JSON.stringify({ resource_type: resourceType, resource_id: parseInt(resourceId), action }),
      });
      const data = await res.json();
      if (res.ok) { onGranted(data); }
      else { setError(typeof data.detail === "string" ? data.detail : `Error ${res.status}`); }
    } catch (e: any) { setError(`Network Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  const selectStyle: React.CSSProperties = { ...m.input, appearance: "auto" as any, cursor: "pointer" };

  return (
    <div style={{ ...m.overlay, zIndex: 1100 }} onClick={onClose}>
      <div style={m.box} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span>🔐</span><h3 style={m.title}>Grant Access</h3></div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={m.infoBanner}>
          <span>👥</span>
          <span style={{ fontSize: 12, color: "#1e40af" }}>Granting access for <strong>{group.name}</strong> (Group #{group.id})</span>
        </div>
        <div style={m.field}>
          <label style={m.label}>Resource Type <span style={{ color: "#ef4444" }}>*</span></label>
          <select style={selectStyle} value={resourceType} onChange={e => setResourceType(e.target.value)}>
            <option value="board">Board</option>
            <option value="main_board">Main Board</option>
            <option value="data_source">Data Source</option>
          </select>
        </div>
        <div style={m.field}>
          <label style={m.label}>Resource ID <span style={{ color: "#ef4444" }}>*</span></label>
          <input style={m.input} type="number" value={resourceId} onChange={e => setResourceId(e.target.value)} placeholder="e.g. 123" />
        </div>
        <div style={m.field}>
          <label style={m.label}>Action <span style={{ color: "#ef4444" }}>*</span></label>
          <select style={selectStyle} value={action} onChange={e => setAction(e.target.value)}>
            <option value="read">Read</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
        </div>
        {error && <p style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={{ ...m.saveBtn, background: "#16a34a", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }} onClick={handleGrant} disabled={loading}>
            {loading ? "Granting…" : "Grant Access"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Group Detail Panel (slide-in drawer)                               */
/* ------------------------------------------------------------------ */
type DetailTab = "members" | "access" | "effective";

function GroupDetailPanel({ group, orgId, userId, onClose, showToast }: {
  group: UserGroup; orgId: string; userId: string;
  onClose: () => void; showToast: (type: ToastType, msg: string) => void;
}) {
  const [activeTab, setActiveTab]         = useState<DetailTab>("members");

  // Members
  const [members, setMembers]             = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<number | null>(null);

  // Access
  const [accesses, setAccesses]           = useState<GroupAccess[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessLoaded, setAccessLoaded]   = useState(false);
  const [grantOpen, setGrantOpen]         = useState(false);
  const [revokeId, setRevokeId]           = useState<number | null>(null);

  // Effective
  const [effective, setEffective]         = useState<EffectiveAccess | null>(null);
  const [effectiveLoading, setEffectiveLoading] = useState(false);

  // User name lookup
  const [clientUserMap, setClientUserMap] = useState<Record<number, { username: string; name: string }>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/client-users/`, {
          headers: { accept: "application/json", "X-API-Key": API_KEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          const map: Record<number, { username: string; name: string }> = {};
          data.forEach((u: any) => { map[Number(u.id)] = { username: u.username || "", name: u.name || "" }; });
          setClientUserMap(map);
        }
      } catch { /* silent */ }
    })();
  }, []);

  useEffect(() => {
    if (activeTab === "members" && !membersLoaded) fetchMembers();
    if (activeTab === "access"  && !accessLoaded)  fetchAccesses();
    if (activeTab === "effective") fetchEffective();
  }, [activeTab]);

  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}/members`, {
        headers: apiHeaders(userId, orgId, false),
      });
      const data = await res.json();
      if (res.ok) { setMembers(Array.isArray(data) ? data : (data.items ?? [])); setMembersLoaded(true); }
      else showToast("error", `Failed to load members: ${data.detail ?? res.status}`);
    } catch (e: any) { showToast("error", `Network error: ${e.message}`); }
    finally { setMembersLoading(false); }
  };

  const fetchAccesses = async () => {
    setAccessLoading(true);
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}/access`, {
        headers: apiHeaders(userId, orgId, false),
      });
      const data = await res.json();
      if (res.ok) { setAccesses(Array.isArray(data) ? data : (data.items ?? [])); setAccessLoaded(true); }
      else showToast("error", `Failed to load access: ${data.detail ?? res.status}`);
    } catch (e: any) { showToast("error", `Network error: ${e.message}`); }
    finally { setAccessLoading(false); }
  };

  const fetchEffective = async () => {
    setEffectiveLoading(true);
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}/effective-access`, {
        headers: apiHeaders(userId, orgId, false),
      });
      const data = await res.json();
      if (res.ok) { setEffective(data); }
      else showToast("error", `Failed to load effective access: ${data.detail ?? res.status}`);
    } catch (e: any) { showToast("error", `Network error: ${e.message}`); }
    finally { setEffectiveLoading(false); }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}/members/${memberId}`, {
        method: "DELETE",
        headers: apiHeaders(userId, orgId, false),
      });
      if (res.ok || res.status === 204) {
        setMembers(prev => prev.filter(m => m.id !== memberId));
        showToast("success", "Member removed successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", `Failed to remove: ${data.detail ?? res.status}`);
      }
    } catch (e: any) { showToast("error", `Network error: ${e.message}`); }
    finally { setRemoveMemberId(null); }
  };

  const handleRevokeAccess = async (accessId: number) => {
    try {
      const res = await fetch(`${API_BASE}/organizations/${orgId}/groups/${group.id}/access/${accessId}`, {
        method: "DELETE",
        headers: apiHeaders(userId, orgId, false),
      });
      if (res.ok || res.status === 204) {
        setAccesses(prev => prev.filter(a => a.id !== accessId));
        showToast("success", "Access revoked successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", `Failed to revoke: ${data.detail ?? res.status}`);
      }
    } catch (e: any) { showToast("error", `Network error: ${e.message}`); }
    finally { setRevokeId(null); }
  };

  const tabs: { id: DetailTab; label: string; icon: string }[] = [
    { id: "members",   label: "Members",          icon: "👤" },
    { id: "access",    label: "Access",            icon: "🔐" },
    { id: "effective", label: "Effective Access",  icon: "✅" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 800, backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(740px, 100vw)",
        background: "#fff", zIndex: 801,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
        fontFamily: "'Segoe UI',sans-serif",
        animation: "slideInRight 0.3s ease",
      }}>

        {/* Drawer Header */}
        <div style={{ padding: "20px 24px 0", borderBottom: "1.5px solid #e2e8f0", background: "#f8faff", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ background: "#eff6ff", borderRadius: 10, padding: "8px 10px", fontSize: 20 }}>👥</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{group.name}</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                  Group #{group.id} · Org #{orgId}
                  <span style={{
                    marginLeft: 8, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: group.is_active ? "#dcfce7" : "#fee2e2",
                    color: group.is_active ? "#16a34a" : "#dc2626",
                  }}>
                    {group.is_active ? "● Active" : "● Inactive"}
                  </span>
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", lineHeight: 1 }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 18px", borderRadius: "8px 8px 0 0",
                  border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: activeTab === tab.id ? "#fff" : "transparent",
                  color: activeTab === tab.id ? "#2563eb" : "#64748b",
                  borderBottom: activeTab === tab.id ? "2px solid #2563eb" : "2px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drawer Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>

          {/* ── MEMBERS TAB ── */}
          {activeTab === "members" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Group Members</h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                    {membersLoading ? "Loading…" : `${members.length} member${members.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={p.refreshBtn} onClick={() => { setMembersLoaded(false); fetchMembers(); }} disabled={membersLoading}>↻ Refresh</button>
                  <button style={p.addBtn} onClick={() => setAddMemberOpen(true)}>+ Add Member</button>
                </div>
              </div>

              {membersLoading ? (
                <div style={p.centerBox}><span style={{ fontSize: 30 }}>⏳</span><p style={{ color: "#64748b" }}>Loading members…</p></div>
              ) : members.length === 0 ? (
                <div style={p.centerBox}>
                  <span style={{ fontSize: 40 }}>👤</span>
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>No members in this group yet.</p>
                  <button style={p.addBtn} onClick={() => setAddMemberOpen(true)}>+ Add First Member</button>
                </div>
              ) : (
                <div style={{ overflowX: "auto", borderRadius: 12, border: "1.5px solid #e2e8f0" }}>
                  <table style={p.table}>
                    <thead>
                      <tr>
                        {["ID", "User ID", "Added By", "Added At", "Action"].map(col => (
                          <th key={col} style={{ ...p.th, textAlign: col === "Action" ? "center" : "left" }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member, i) => (
                        <tr key={member.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                          <td style={{ ...p.td, fontWeight: 700, color: "#2563eb" }}>#{member.id}</td>
                          <td style={p.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#2563eb", flexShrink: 0 }}>
                                {(clientUserMap[member.client_user_id]?.username || clientUserMap[member.client_user_id]?.name || String(member.client_user_id))[0].toUpperCase()}
                              </div>
                              <div>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                                  {clientUserMap[member.client_user_id]?.username || clientUserMap[member.client_user_id]?.name || `User #${member.client_user_id}`}
                                </p>
                                <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>ID: {member.client_user_id}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...p.td, color: "#64748b" }}>
                            {clientUserMap[member.added_by]?.username || clientUserMap[member.added_by]?.name || `User #${member.added_by}`}
                          </td>
                          <td style={{ ...p.td, color: "#64748b", whiteSpace: "nowrap" }}>{formatDate(member.added_at)}</td>
                          <td style={{ ...p.td, textAlign: "center" }}>
                            {removeMemberId === member.id ? (
                              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                <button style={p.confirmBtn} onClick={() => handleRemoveMember(member.id)}>✓ Confirm</button>
                                <button style={p.cancelSmBtn} onClick={() => setRemoveMemberId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button style={p.removeBtn} onClick={() => setRemoveMemberId(member.id)}>🗑️ Remove</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── ACCESS TAB ── */}
          {activeTab === "access" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Group Access Rules</h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
                    {accessLoading ? "Loading…" : `${accesses.length} rule${accesses.length !== 1 ? "s" : ""} configured`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={p.refreshBtn} onClick={() => { setAccessLoaded(false); fetchAccesses(); }} disabled={accessLoading}>↻ Refresh</button>
                  <button style={{ ...p.addBtn, background: "#16a34a", boxShadow: "0 4px 12px rgba(22,163,74,0.25)" }} onClick={() => setGrantOpen(true)}>+ Grant Access</button>
                </div>
              </div>

              {accessLoading ? (
                <div style={p.centerBox}><span style={{ fontSize: 30 }}>⏳</span><p style={{ color: "#64748b" }}>Loading access rules…</p></div>
              ) : accesses.length === 0 ? (
                <div style={p.centerBox}>
                  <span style={{ fontSize: 40 }}>🔐</span>
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>No access rules configured.</p>
                  <button style={{ ...p.addBtn, background: "#16a34a", boxShadow: "0 4px 12px rgba(22,163,74,0.25)" }} onClick={() => setGrantOpen(true)}>+ Grant First Access</button>
                </div>
              ) : (
                <div style={{ overflowX: "auto", borderRadius: 12, border: "1.5px solid #e2e8f0" }}>
                  <table style={p.table}>
                    <thead>
                      <tr>
                        {["ID", "Resource Type", "Resource ID", "Action", "Granted By", "Granted At", ""].map((col, i) => (
                          <th key={i} style={{ ...p.th, textAlign: col === "" ? "center" : "left" }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {accesses.map((ac, i) => (
                        <tr key={ac.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                          <td style={{ ...p.td, fontWeight: 700, color: "#2563eb" }}>#{ac.id}</td>
                          <td style={p.td}>
                            <span style={{
                              padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: `${RESOURCE_COLORS[ac.resource_type] || "#64748b"}20`,
                              color: RESOURCE_COLORS[ac.resource_type] || "#64748b",
                            }}>
                              {ac.resource_type.replace(/_/g, " ").toUpperCase()}
                            </span>
                          </td>
                          <td style={{ ...p.td, fontWeight: 600 }}>#{ac.resource_id}</td>
                          <td style={p.td}>
                            <span style={{
                              padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: `${ACTION_COLORS[ac.action] || "#64748b"}20`,
                              color: ACTION_COLORS[ac.action] || "#64748b",
                            }}>
                              {ac.action.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ ...p.td, color: "#64748b" }}>User #{ac.granted_by}</td>
                          <td style={{ ...p.td, color: "#64748b", whiteSpace: "nowrap" }}>{formatDate(ac.granted_at)}</td>
                          <td style={{ ...p.td, textAlign: "center" }}>
                            {revokeId === ac.id ? (
                              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                <button style={p.confirmBtn} onClick={() => handleRevokeAccess(ac.id)}>✓ Confirm</button>
                                <button style={p.cancelSmBtn} onClick={() => setRevokeId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button style={{ ...p.removeBtn, borderColor: "#fca5a5" }} onClick={() => setRevokeId(ac.id)}>🚫 Revoke</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── EFFECTIVE ACCESS TAB ── */}
          {activeTab === "effective" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Effective Access</h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>Computed permissions for this group</p>
                </div>
                <button style={p.refreshBtn} onClick={fetchEffective} disabled={effectiveLoading}>↻ Refresh</button>
              </div>

              {effectiveLoading ? (
                <div style={p.centerBox}><span style={{ fontSize: 30 }}>⏳</span><p style={{ color: "#64748b" }}>Loading effective access…</p></div>
              ) : !effective ? (
                <div style={p.centerBox}>
                  <span style={{ fontSize: 40 }}>✅</span>
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>Click Refresh to load effective access.</p>
                </div>
              ) : effective.access.length === 0 ? (
                <div style={p.centerBox}>
                  <span style={{ fontSize: 40 }}>🔒</span>
                  <p style={{ color: "#94a3b8", fontSize: 14 }}>No effective permissions found.</p>
                  <p style={{ color: "#cbd5e1", fontSize: 12 }}>Grant access rules in the Access tab first.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Summary */}
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "16px 20px", display: "flex", gap: 24, alignItems: "center" }}>
                    {[
                      { value: effective.access.length, label: "Resources" },
                      { value: effective.access.reduce((s, a) => s + a.actions.length, 0), label: "Permissions" },
                      { value: new Set(effective.access.map(a => a.resource_type)).size, label: "Resource Types" },
                    ].map((stat, i, arr) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: "#2563eb" }}>{stat.value}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{stat.label}</div>
                        </div>
                        {i < arr.length - 1 && <div style={{ width: 1, height: 32, background: "#bfdbfe" }} />}
                      </div>
                    ))}
                  </div>

                  {/* Grouped by resource type */}
                  {(["board", "main_board", "data_source"] as const).map(rt => {
                    const items = effective.access.filter(a => a.resource_type === rt);
                    if (items.length === 0) return null;
                    const color = RESOURCE_COLORS[rt] || "#64748b";
                    return (
                      <div key={rt} style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ padding: "12px 16px", background: `${color}10`, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ padding: "3px 12px", borderRadius: 10, background: `${color}20`, color, fontSize: 12, fontWeight: 700 }}>
                            {rt.replace(/_/g, " ").toUpperCase()}
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{items.length} resource{items.length > 1 ? "s" : ""}</span>
                        </div>
                        {items.map((item, idx) => (
                          <div key={idx} style={{
                            padding: "13px 16px",
                            borderBottom: idx < items.length - 1 ? "1px solid #f1f5f9" : "none",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                              Resource #{item.resource_id}
                            </span>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {item.actions.map(action => (
                                <span key={action} style={{
                                  padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                                  background: `${ACTION_COLORS[action] || "#64748b"}20`,
                                  color: ACTION_COLORS[action] || "#64748b",
                                }}>
                                  {action.toUpperCase()}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Member Modal (z-index above drawer) */}
      {addMemberOpen && (
        <AddMemberModal
          group={group} orgId={orgId} userId={userId}
          onClose={() => setAddMemberOpen(false)}
          onAdded={(member) => {
            setMembers(prev => [...prev, member]);
            setAddMemberOpen(false);
            showToast("success", `User #${member.client_user_id} added to group.`);
          }}
        />
      )}

      {/* Grant Access Modal (z-index above drawer) */}
      {grantOpen && (
        <GrantAccessModal
          group={group} orgId={orgId} userId={userId}
          onClose={() => setGrantOpen(false)}
          onGranted={(access) => {
            setAccesses(prev => [...prev, access]);
            setGrantOpen(false);
            showToast("success", `Granted ${access.action} on ${access.resource_type} #${access.resource_id}`);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */
export default function UserGroupsPage() {
  const [groups,       setGroups]       = useState<UserGroup[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [orgId,        setOrgId]        = useState("");
  const [userId,       setUserId]       = useState("");
  const [activeOrgId,  setActiveOrgId]  = useState("");
  const [filterText,   setFilterText]   = useState("");
  const [createOpen,   setCreateOpen]   = useState(false);
  const [editGroup,    setEditGroup]    = useState<UserGroup | null>(null);
  const [deleteGroup,  setDeleteGroup]  = useState<UserGroup | null>(null);
  const [detailGroup,    setDetailGroup]    = useState<UserGroup | null>(null);
  const [mainUserMap,    setMainUserMap]    = useState<Record<number, { username: string; name: string }>>({});
  const { toasts, show, remove } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/client-users/`, {
          headers: { accept: "application/json", "X-API-Key": API_KEY },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          const map: Record<number, { username: string; name: string }> = {};
          data.forEach((u: any) => { map[Number(u.id)] = { username: u.username || "", name: u.name || "" }; });
          setMainUserMap(map);
        }
      } catch { /* silent */ }
    })();
  }, []);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || localStorage.getItem("user_id") || "";
    const oid = localStorage.getItem("orgId")  || localStorage.getItem("org_id")  || "";
    if (uid) setUserId(uid);
    if (oid) setOrgId(oid);
    if (uid && oid) fetchGroups(oid, uid);
  }, []);

  const fetchGroups = async (oid: string, uid: string) => {
    if (!oid.trim()) { show("error", "Please enter an Organization ID."); return; }
    if (!uid.trim()) { show("error", "Please enter a User ID."); return; }
    setLoading(true); setGroups([]);
    try {
      const res = await fetch(`${API_BASE}/organizations/${oid.trim()}/groups/`, {
        headers: apiHeaders(uid.trim(), oid.trim(), false),
      });
      const data = await res.json();
      if (res.ok) {
        const list = Array.isArray(data) ? data : (data.items ?? []);
        setGroups(list);
        setActiveOrgId(oid.trim());
        if (list.length === 0) show("info", "No groups found for this organization.");
        else show("success", `${list.length} group${list.length > 1 ? "s" : ""} loaded.`);
      } else {
        show("error", `Error ${res.status}: ${typeof data.detail === "string" ? data.detail : JSON.stringify(data)}`);
      }
    } catch (e: any) { show("error", `Network Error: ${e.message}`); }
    finally { setLoading(false); }
  };

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (g.description || "").toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(60px); } to { opacity:1; transform:translateX(0); } }
        * { box-sizing:border-box; }
        .grp-row:hover { background:#f8faff !important; }
        .act-btn:hover { opacity:0.8; }
        textarea, select { font-family:'Segoe UI',sans-serif; }
      `}</style>

      <ToastContainer toasts={toasts} remove={remove} />

      {createOpen  && <CreateModal orgId={activeOrgId || orgId} userId={userId} onClose={() => setCreateOpen(false)}  onCreated={g => { setGroups(p => [g, ...p]); setCreateOpen(false); show("success", `Group "${g.name}" created.`); }} />}
      {editGroup   && <EditModal   group={editGroup}   orgId={activeOrgId} userId={userId} onClose={() => setEditGroup(null)}   onSaved={g => { setGroups(p => p.map(x => x.id === g.id ? g : x)); setEditGroup(null); show("success", `Group "${g.name}" updated.`); }} />}
      {deleteGroup && <DeleteModal group={deleteGroup} orgId={activeOrgId} userId={userId} onClose={() => setDeleteGroup(null)} onDeleted={id => { setGroups(p => p.filter(g => g.id !== id)); setDeleteGroup(null); show("success", "Group deleted."); }} />}
      {detailGroup && <GroupDetailPanel group={detailGroup} orgId={activeOrgId} userId={userId} onClose={() => setDetailGroup(null)} showToast={show} />}

      <div style={s.page}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.pageTitle}>👥 User Groups</h1>
            <p style={s.pageSub}>Manage groups, members, and access within your organization</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {activeOrgId && (
              <div style={s.badge}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Org ID:</span>
                <strong style={{ fontSize: 13, color: "#2563eb" }}>#{activeOrgId}</strong>
              </div>
            )}
            <button
              style={s.createBtn}
              onClick={() => {
                const oid = activeOrgId || orgId.trim();
                if (!oid) { show("error", "Please enter an Organization ID first."); return; }
                if (!activeOrgId) setActiveOrgId(oid);
                setCreateOpen(true);
              }}
            >
              + Create Group
            </button>
          </div>
        </div>

        {/* Fetch Bar */}
        <div style={s.searchCard}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Fetch Groups by Organization
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <div style={{ ...s.searchWrap, minWidth: 180 }}>
              <span style={{ padding: "0 10px", fontSize: 13, color: "#94a3b8" }}>🏢</span>
              <input style={s.searchInput} placeholder="Organization ID" value={orgId} onChange={e => setOrgId(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchGroups(orgId, userId)} />
            </div>
            <div style={{ ...s.searchWrap, minWidth: 180 }}>
              <span style={{ padding: "0 10px", fontSize: 13, color: "#94a3b8" }}>👤</span>
              <input style={s.searchInput} placeholder="User ID (X-User-Id)" value={userId} onChange={e => setUserId(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchGroups(orgId, userId)} />
            </div>
            <button style={s.fetchBtn} onClick={() => fetchGroups(orgId, userId)} disabled={loading}>{loading ? "Fetching…" : "Fetch Groups"}</button>
            {groups.length > 0 && (
              <button style={s.clearBtn} onClick={() => { setGroups([]); setFilterText(""); setActiveOrgId(""); }}>Clear</button>
            )}
          </div>
          {groups.length > 0 && (
            <input
              style={{ ...s.searchInput, paddingLeft: 14, borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f9fafb", width: "100%", marginTop: 4 }}
              placeholder="Filter by name or description…"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          )}
        </div>

        {/* Table */}
        <div style={s.tableCard}>
          {loading ? (
            <div style={s.empty}><span style={{ fontSize: 32 }}>⏳</span><p style={{ color: "#64748b", fontSize: 14, marginTop: 10 }}>Loading groups…</p></div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>
              <span style={{ fontSize: 40 }}>👥</span>
              <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 10 }}>
                {groups.length === 0 ? "Enter Org ID & User ID above, then click Fetch Groups." : "No results match your filter."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["ID", "Name", "Description", "Created By", "Created At", "Status", "Actions"].map(col => (
                      <th key={col} style={{ ...s.th, textAlign: col === "Actions" ? "center" : "left" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((group, i) => (
                    <tr key={group.id} className="grp-row" style={{ background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                      <td style={{ ...s.td, fontWeight: 700, color: "#2563eb" }}>#{group.id}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: "#1e293b" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={s.groupIcon}>👥</span>
                          {group.name}
                        </div>
                      </td>
                      <td style={{ ...s.td, color: "#64748b", maxWidth: 220 }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                          {group.description || <em style={{ color: "#cbd5e1" }}>No description</em>}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: "#64748b" }}>
                        {mainUserMap[group.created_by]?.username || mainUserMap[group.created_by]?.name || `User #${group.created_by}`}
                      </td>
                      <td style={{ ...s.td, color: "#64748b", whiteSpace: "nowrap" }}>{formatDate(group.created_at)}</td>
                      <td style={s.td}>
                        <span style={{ ...s.statusBadge, background: group.is_active ? "#dcfce7" : "#fee2e2", color: group.is_active ? "#16a34a" : "#dc2626" }}>
                          {group.is_active ? "● Active" : "● Inactive"}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                          <button className="act-btn" style={s.manageBtn} onClick={() => setDetailGroup(group)}>⚙️ Manage</button>
                          <button className="act-btn" style={s.editBtn}   onClick={() => setEditGroup(group)}>✏️ Edit</button>
                          <button className="act-btn" style={s.deleteBtn} onClick={() => setDeleteGroup(group)}>🗑️</button>
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
              Showing <strong>{filtered.length}</strong> of <strong>{groups.length}</strong> groups
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
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(2px)" },
  box:        { background: "#fff", borderRadius: 18, boxShadow: "0 16px 48px rgba(0,0,0,0.18)", padding: "32px 36px", width: "100%", maxWidth: 500, fontFamily: "'Segoe UI',sans-serif" },
  header:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title:      { fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 },
  closeBtn:   { background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" },
  field:      { marginBottom: 18 },
  label:      { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 },
  input:      { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, color: "#1e293b", background: "#f9fafb", outline: "none" },
  infoBanner: { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "center" },
  cancelBtn:  { padding: "10px 24px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  saveBtn:    { padding: "10px 28px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" },
};

/* ------------------------------------------------------------------ */
/*  Panel styles (p)                                                    */
/* ------------------------------------------------------------------ */
const p: Record<string, React.CSSProperties> = {
  table:       { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th:          { padding: "11px 14px", background: "#f8faff", color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap" },
  td:          { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#334155", verticalAlign: "middle" },
  centerBox:   { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", textAlign: "center", gap: 12 },
  addBtn:      { padding: "8px 18px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.25)", whiteSpace: "nowrap" },
  refreshBtn:  { padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  removeBtn:   { padding: "5px 12px", borderRadius: 7, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  confirmBtn:  { padding: "5px 12px", borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  cancelSmBtn: { padding: "5px 12px", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
};

/* ------------------------------------------------------------------ */
/*  Page styles (s)                                                     */
/* ------------------------------------------------------------------ */
const s: Record<string, React.CSSProperties> = {
  page:        { minHeight: "100vh", background: "#f1f5f9", padding: "36px 32px", fontFamily: "'Segoe UI',sans-serif" },
  header:      { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  pageTitle:   { fontSize: 26, fontWeight: 700, color: "#1e293b", margin: 0 },
  pageSub:     { fontSize: 13, color: "#64748b", margin: "4px 0 0" },
  badge:       { display: "flex", alignItems: "center", gap: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "8px 14px" },
  createBtn:   { padding: "10px 22px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.25)", whiteSpace: "nowrap" },
  searchCard:  { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "20px 24px", marginBottom: 20 },
  searchWrap:  { display: "flex", alignItems: "center", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#f9fafb", overflow: "hidden" },
  searchInput: { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#1e293b", padding: "10px 10px 10px 0" },
  fetchBtn:    { padding: "10px 24px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  clearBtn:    { padding: "10px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  tableCard:   { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" },
  table:       { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th:          { padding: "13px 16px", background: "#f8faff", color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap" },
  td:          { padding: "13px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#334155", verticalAlign: "middle" },
  groupIcon:   { background: "#eff6ff", borderRadius: 6, padding: "2px 6px", fontSize: 13 },
  statusBadge: { padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  manageBtn:   { padding: "6px 14px", borderRadius: 8, border: "1.5px solid #d1d5db", background: "#f9fafb", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  editBtn:     { padding: "6px 14px", borderRadius: 8, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  deleteBtn:   { padding: "6px 12px", borderRadius: 8, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  empty:       { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 20px", textAlign: "center" },
  tableFooter: { padding: "12px 20px", fontSize: 12, color: "#94a3b8", borderTop: "1px solid #f1f5f9", textAlign: "right" },
};
