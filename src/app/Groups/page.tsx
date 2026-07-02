"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Search, Edit2, Trash2, ChevronUp, ChevronDown, ArrowUpDown, Users, X, RefreshCw, UserPlus, Lock } from "lucide-react";
import Spinner from "../components/Spinner";
import LanguageSelector from "../components/LanguageSelector";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

interface Group {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  member_count: number;
  created_by: number | null;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface GroupMember {
  id: number;
  group_id: number;
  user_id: number;
  created_at: string | null;
  user_name: string | null;
  user_email: string | null;
  added_by_name: string | null;
  added_by_email: string | null;
}

interface NonGroupUser {
  user_id: number;
  full_name: string;
  email: string;
  department: string | null;
  designation: string | null;
}

interface OrgMainBoard {
  main_board_id: number;
  main_board_name: string;
  main_board_type: string;
  created_by_user_id: number;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: string | null;
  boards: { board_id: number; board_name: string; is_active: boolean }[];
}

interface OrgMemberLite {
  user_id: number;
  user_name: string | null;
  user_email: string | null;
}

interface SharedMainBoard {
  share_id: number;
  org_id: number;
  main_board_id: number;
  main_board_name: string | null;
  shared_with_type: string;
  shared_with_id: number | null;
  shared_with_name: string | null;
  shared_with_email: string | null;
  shared_with_org_role: string | null;
  shared_by_user_id: number;
  shared_by_name: string | null;
  shared_by_email: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface SharedBoard {
  share_id: number;
  org_id: number;
  board_id: number;
  board_name: string | null;
  main_board_id: number | null;
  main_board_name: string | null;
  shared_with_type: string;
  shared_with_id: number | null;
  shared_with_name: string | null;
  shared_with_email: string | null;
  shared_with_org_role: string | null;
  shared_by_user_id: number;
  shared_by_name: string | null;
  shared_by_email: string | null;
  is_active: boolean;
  created_at: string | null;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function getOwnerUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = sessionStorage.getItem("currentUserData");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed.userId ? String(parsed.userId) : "";
  } catch {
    return "";
  }
}

/* ── Create / Edit Modal ─────────────────────────────────────────────────── */
function GroupFormModal({
  mode, group, orgId, userId, onClose, onSaved,
}: {
  mode: "create" | "edit";
  group: Group | null;
  orgId: number;
  userId: string;
  onClose: () => void;
  onSaved: (group: Group) => void;
}) {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Group name is required."); return; }
    setSaving(true);
    try {
      const url = mode === "create"
        ? `${API_BASE_URL}/organizations/${orgId}/groups?created_by_user_id=${userId}`
        : `${API_BASE_URL}/organizations/${orgId}/groups/${group?.id}?updated_by_user_id=${userId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data);
      } else {
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={{ ...m.box, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <h3 style={m.title}>{mode === "create" ? "Create Group" : "Edit Group"}</h3>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={m.label}>Group Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            style={m.input}
            placeholder="e.g. Finance Team"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={m.label}>Description</label>
          <textarea
            style={{ ...m.input, minHeight: 80, resize: "vertical" }}
            placeholder="What is this group for?"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={m.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Create Group" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Modal ─────────────────────────────────────────────────────────── */
function DeleteGroupModal({
  group, orgId, userId, onClose, onDeleted,
}: {
  group: Group;
  orgId: number;
  userId: string;
  onClose: () => void;
  onDeleted: (groupId: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/groups/${group.id}?deleted_by_user_id=${userId}`, {
        method: "DELETE",
        headers: { Accept: "application/json", "X-API-Key": API_KEY },
      });
      if (res.ok) {
        onDeleted(group.id);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={{ ...m.box, maxWidth: 420, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <h3 style={m.title}>Delete Group?</h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: "10px 0 20px" }}>
          This will delete <strong>{group.name}</strong> and remove all its members. This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={deleting}>Cancel</button>
          <button style={{ ...m.saveBtn, background: "#ef4444" }} onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Member Modal (stacked on top of Manage Members) ────────────────── */
function AddGroupMemberModal({
  orgId, groupId, userId, onClose, onAdded,
}: {
  orgId: number;
  groupId: number;
  userId: string;
  onClose: () => void;
  onAdded: (member: GroupMember) => void;
}) {
  const [candidates, setCandidates] = useState<NonGroupUser[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [query, setQuery] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<NonGroupUser | null>(null);
  const [adding, setAdding] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Autofetch org members not yet in this group as soon as the modal opens.
  useEffect(() => {
    const fetchCandidates = async () => {
      setLoadingCandidates(true);
      try {
        const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/groups/${groupId}/non-members?requester_user_id=${userId}`, {
          headers: { Accept: "application/json", "X-API-Key": API_KEY },
        });
        if (res.ok) setCandidates(await res.json());
        else setCandidates([]);
      } catch {
        setCandidates([]);
      } finally {
        setLoadingCandidates(false);
      }
    };
    fetchCandidates();
  }, [orgId, groupId, userId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowOptions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCandidates = candidates.filter(u => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";

  const handleAddMember = async () => {
    if (!selectedUser) { toast.error("Please select a user to add."); return; }
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/groups/${groupId}/members?added_by_user_id=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ user_email: selectedUser.email }),
      });
      const data = await res.json();
      if (res.ok) {
        onAdded(data);
      } else {
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ ...m.overlay, zIndex: 1100 }} onClick={onClose}>
      <div style={{ ...m.box, maxWidth: 440, minHeight: 380, overflow: "visible", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <h3 style={m.title}>Add Member</h3>
          <button style={m.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div ref={boxRef} style={{ flex: 1 }}>
          <label style={m.label}>User Email <span style={{ color: "#ef4444" }}>*</span></label>

          {selectedUser ? (
            <div style={gm.selectedCard}>
              <div style={gm.avatar}>{initials(selectedUser.full_name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{selectedUser.full_name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{selectedUser.email}</div>
              </div>
              <button style={gm.changeBtn} onClick={() => setSelectedUser(null)}>Change</button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <input
                style={m.input}
                placeholder="Search org members by name or email…"
                value={query}
                onFocus={() => setShowOptions(true)}
                onChange={e => { setQuery(e.target.value); setShowOptions(true); }}
              />
              {showOptions && (
                <div style={gm.dropdown}>
                  {loadingCandidates ? (
                    <div style={gm.dropdownEmpty}>Loading members…</div>
                  ) : filteredCandidates.length === 0 ? (
                    <div style={gm.dropdownEmpty}>No matching org members found.</div>
                  ) : (
                    filteredCandidates.map(u => (
                      <div
                        key={u.user_id}
                        style={gm.dropdownItem}
                        onClick={() => { setSelectedUser(u); setShowOptions(false); setQuery(""); }}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <div style={gm.avatarSm}>{initials(u.full_name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{u.full_name}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{u.email}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={adding}>Cancel</button>
          <button style={m.saveBtn} onClick={handleAddMember} disabled={adding || !selectedUser}>
            {adding ? "Adding…" : "Add to Group"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Revoke Share Confirm Modal ───────────────────────────────────────────── */
function RevokeShareModal({
  kind, shareId, targetLabel, sharedWithName, orgId, userId, onClose, onRevoked,
}: {
  kind: "mainboard" | "board";
  shareId: number;
  targetLabel: string | null;
  sharedWithName: string | null;
  orgId: number;
  userId: string;
  onClose: () => void;
  onRevoked: (shareId: number) => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const endpoint = kind === "mainboard" ? "shared-main-boards" : "shared-boards";

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/${endpoint}/${shareId}?deleted_by_user_id=${userId}&org_id=${orgId}`, {
        method: "DELETE",
        headers: { Accept: "application/json", "X-API-Key": API_KEY },
      });
      if (res.ok) {
        onRevoked(shareId);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div style={{ ...m.overlay, zIndex: 1100 }} onClick={onClose}>
      <div style={{ ...m.box, maxWidth: 420, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <h3 style={m.title}>Revoke Access?</h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: "10px 0 20px" }}>
          This permanently revokes <strong>{targetLabel}</strong> access for <strong>{sharedWithName}</strong>.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={revoking}>Cancel</button>
          <button style={{ ...m.saveBtn, background: "#ef4444" }} onClick={handleRevoke} disabled={revoking}>
            {revoking ? "Revoking…" : "Yes, Revoke"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Share Main Board Modal ───────────────────────────────────────────────── */
function ShareMainBoardModal({
  orgId, groupId, groupName, userId, mainBoards, loadingMainBoards, defaultMainBoardId, onClose, onShared,
}: {
  orgId: number;
  groupId: number;
  groupName: string;
  userId: string;
  mainBoards: OrgMainBoard[];
  loadingMainBoards: boolean;
  defaultMainBoardId: number | null;
  onClose: () => void;
  onShared: (mainBoardId: number) => void;
}) {
  const [mainBoardId, setMainBoardId] = useState<number | null>(defaultMainBoardId);
  const [shareType, setShareType] = useState<"GROUP" | "USER">("GROUP");

  const [orgMembers, setOrgMembers] = useState<OrgMemberLite[]>([]);
  const [loadingOrgMembers, setLoadingOrgMembers] = useState(false);
  const [query, setQuery] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgMemberLite | null>(null);
  const [sharing, setSharing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Autofetch this group's members the first time "Specific User" is picked —
  // sharing to a user only makes sense for someone already in this group.
  useEffect(() => {
    if (shareType !== "USER" || orgMembers.length > 0) return;
    const fetchGroupMembers = async () => {
      setLoadingOrgMembers(true);
      try {
        const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/groups/${groupId}/members?requester_user_id=${userId}`, {
          headers: { Accept: "application/json", "X-API-Key": API_KEY },
        });
        if (res.ok) setOrgMembers(await res.json());
        else setOrgMembers([]);
      } catch {
        setOrgMembers([]);
      } finally {
        setLoadingOrgMembers(false);
      }
    };
    fetchGroupMembers();
  }, [shareType, orgId, groupId, userId, orgMembers.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowOptions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMembers = orgMembers.filter(u => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (u.user_name || "").toLowerCase().includes(q) || (u.user_email || "").toLowerCase().includes(q);
  });

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";

  const handleShare = async () => {
    if (!mainBoardId) { toast.error("Please select a main board."); return; }
    if (shareType === "USER" && !selectedUser) { toast.error("Please select a user to share with."); return; }
    setSharing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shared-main-boards/?shared_by_user_id=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          org_id: orgId,
          main_board_id: mainBoardId,
          shared_with_type: shareType,
          shared_with_group_id: shareType === "GROUP" ? groupId : null,
          shared_with_user_id: shareType === "USER" ? selectedUser!.user_id : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onShared(mainBoardId);
      } else {
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={{ ...m.overlay, zIndex: 1100 }} onClick={onClose}>
      <div style={{ ...m.box, maxWidth: 480, minHeight: 440, overflow: "visible", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <h3 style={m.title}>Share Main Board</h3>
          <button style={m.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={m.label}>Main Board <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              style={{ ...m.input, cursor: "pointer" }}
              value={mainBoardId ?? ""}
              onChange={e => setMainBoardId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingMainBoards}
            >
              <option value="">{loadingMainBoards ? "Loading main boards…" : "Select a main board"}</option>
              {mainBoards.map(b => (
                <option key={b.main_board_id} value={b.main_board_id}>{b.main_board_name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={m.label}>Share With</label>
            <select
              style={{ ...m.input, cursor: "pointer" }}
              value={shareType}
              onChange={e => { setShareType(e.target.value as "GROUP" | "USER"); setSelectedUser(null); setQuery(""); }}
            >
              <option value="GROUP">Group</option>
              <option value="USER">Specific User</option>
            </select>
          </div>

          {shareType === "GROUP" ? (
            <div style={gm.selectedCard}>
              <div style={gm.avatar}><Users size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{groupName}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>All members of this group</div>
              </div>
            </div>
          ) : (
            <div ref={boxRef} style={{ marginBottom: 4 }}>
              <label style={m.label}>User <span style={{ color: "#ef4444" }}>*</span></label>
              {selectedUser ? (
                <div style={gm.selectedCard}>
                  <div style={gm.avatar}>{initials(selectedUser.user_name || selectedUser.user_email || "?")}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{selectedUser.user_name || "—"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{selectedUser.user_email}</div>
                  </div>
                  <button style={gm.changeBtn} onClick={() => setSelectedUser(null)}>Change</button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <input
                    style={m.input}
                    placeholder={`Search ${groupName}'s members by name or email…`}
                    value={query}
                    onFocus={() => setShowOptions(true)}
                    onChange={e => { setQuery(e.target.value); setShowOptions(true); }}
                  />
                  {showOptions && (
                    <div style={gm.dropdown}>
                      {loadingOrgMembers ? (
                        <div style={gm.dropdownEmpty}>Loading group members…</div>
                      ) : filteredMembers.length === 0 ? (
                        <div style={gm.dropdownEmpty}>No matching members in this group.</div>
                      ) : (
                        filteredMembers.map(u => (
                          <div
                            key={u.user_id}
                            style={gm.dropdownItem}
                            onClick={() => { setSelectedUser(u); setShowOptions(false); setQuery(""); }}
                            onMouseDown={e => e.preventDefault()}
                          >
                            <div style={gm.avatarSm}>{initials(u.user_name || u.user_email || "?")}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{u.user_name || "—"}</div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>{u.user_email}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={gm.infoNote}>
            <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Sharing with a <strong>Group</strong> gives every member access to this Main Board and all its Boards.
              To give just one <strong>Board</strong> to a single user, use the Board tab instead.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={sharing}>Cancel</button>
          <button style={m.saveBtn} onClick={handleShare} disabled={sharing || !mainBoardId || (shareType === "USER" && !selectedUser)}>
            {sharing ? "Sharing…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Share Board Modal ────────────────────────────────────────────────────── */
interface FlatBoardOption {
  board_id: number;
  board_name: string;
  main_board_name: string;
}

function ShareBoardModal({
  orgId, groupId, groupName, userId, boardOptions, loadingBoards, defaultBoardId, onClose, onShared,
}: {
  orgId: number;
  groupId: number;
  groupName: string;
  userId: string;
  boardOptions: FlatBoardOption[];
  loadingBoards: boolean;
  defaultBoardId: number | null;
  onClose: () => void;
  onShared: (boardId: number) => void;
}) {
  const [boardId, setBoardId] = useState<number | null>(defaultBoardId);
  const [shareType, setShareType] = useState<"GROUP" | "USER">("GROUP");

  const [groupMembers, setGroupMembers] = useState<OrgMemberLite[]>([]);
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);
  const [query, setQuery] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgMemberLite | null>(null);
  const [sharing, setSharing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Autofetch this group's members the first time "Specific User" is picked.
  useEffect(() => {
    if (shareType !== "USER" || groupMembers.length > 0) return;
    const fetchGroupMembers = async () => {
      setLoadingGroupMembers(true);
      try {
        const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/groups/${groupId}/members?requester_user_id=${userId}`, {
          headers: { Accept: "application/json", "X-API-Key": API_KEY },
        });
        if (res.ok) setGroupMembers(await res.json());
        else setGroupMembers([]);
      } catch {
        setGroupMembers([]);
      } finally {
        setLoadingGroupMembers(false);
      }
    };
    fetchGroupMembers();
  }, [shareType, orgId, groupId, userId, groupMembers.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowOptions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMembers = groupMembers.filter(u => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (u.user_name || "").toLowerCase().includes(q) || (u.user_email || "").toLowerCase().includes(q);
  });

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";

  const handleShare = async () => {
    if (!boardId) { toast.error("Please select a board."); return; }
    if (shareType === "USER" && !selectedUser) { toast.error("Please select a user to share with."); return; }
    setSharing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shared-boards/?shared_by_user_id=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          org_id: orgId,
          board_id: boardId,
          shared_with_type: shareType,
          shared_with_group_id: shareType === "GROUP" ? groupId : null,
          shared_with_user_id: shareType === "USER" ? selectedUser!.user_id : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onShared(boardId);
      } else {
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={{ ...m.overlay, zIndex: 1100 }} onClick={onClose}>
      <div style={{ ...m.box, maxWidth: 480, minHeight: 440, overflow: "visible", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <h3 style={m.title}>Share Board</h3>
          <button style={m.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={m.label}>Board <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              style={{ ...m.input, cursor: "pointer" }}
              value={boardId ?? ""}
              onChange={e => setBoardId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingBoards}
            >
              <option value="">{loadingBoards ? "Loading boards…" : "Select a board"}</option>
              {boardOptions.map(b => (
                <option key={b.board_id} value={b.board_id}>{b.main_board_name} → {b.board_name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={m.label}>Share With</label>
            <select
              style={{ ...m.input, cursor: "pointer" }}
              value={shareType}
              onChange={e => { setShareType(e.target.value as "GROUP" | "USER"); setSelectedUser(null); setQuery(""); }}
            >
              <option value="GROUP">Group</option>
              <option value="USER">Specific User</option>
            </select>
          </div>

          {shareType === "GROUP" ? (
            <div style={gm.selectedCard}>
              <div style={gm.avatar}><Users size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{groupName}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>All members of this group</div>
              </div>
            </div>
          ) : (
            <div ref={boxRef} style={{ marginBottom: 4 }}>
              <label style={m.label}>User <span style={{ color: "#ef4444" }}>*</span></label>
              {selectedUser ? (
                <div style={gm.selectedCard}>
                  <div style={gm.avatar}>{initials(selectedUser.user_name || selectedUser.user_email || "?")}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{selectedUser.user_name || "—"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{selectedUser.user_email}</div>
                  </div>
                  <button style={gm.changeBtn} onClick={() => setSelectedUser(null)}>Change</button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <input
                    style={m.input}
                    placeholder={`Search ${groupName}'s members by name or email…`}
                    value={query}
                    onFocus={() => setShowOptions(true)}
                    onChange={e => { setQuery(e.target.value); setShowOptions(true); }}
                  />
                  {showOptions && (
                    <div style={gm.dropdown}>
                      {loadingGroupMembers ? (
                        <div style={gm.dropdownEmpty}>Loading group members…</div>
                      ) : filteredMembers.length === 0 ? (
                        <div style={gm.dropdownEmpty}>No matching members in this group.</div>
                      ) : (
                        filteredMembers.map(u => (
                          <div
                            key={u.user_id}
                            style={gm.dropdownItem}
                            onClick={() => { setSelectedUser(u); setShowOptions(false); setQuery(""); }}
                            onMouseDown={e => e.preventDefault()}
                          >
                            <div style={gm.avatarSm}>{initials(u.user_name || u.user_email || "?")}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{u.user_name || "—"}</div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>{u.user_email}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={gm.infoNote}>
            <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Sharing a single <strong>Board</strong> only gives access to that board — other boards under the same Main Board are unaffected.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={sharing}>Cancel</button>
          <button style={m.saveBtn} onClick={handleShare} disabled={sharing || !boardId || (shareType === "USER" && !selectedUser)}>
            {sharing ? "Sharing…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Access Tab: Main Board sharing ──────────────────────────────────────── */
function GroupAccessPanel({
  orgId, groupId, groupName, userId,
}: {
  orgId: number;
  groupId: number;
  groupName: string;
  userId: string;
}) {
  const [accessSubTab, setAccessSubTab] = useState<"mainboard" | "board">("mainboard");

  const [mainBoards, setMainBoards] = useState<OrgMainBoard[]>([]);
  const [loadingMainBoards, setLoadingMainBoards] = useState(true);

  const [selectedMainBoardId, setSelectedMainBoardId] = useState<number | null>(null);
  const [showShareMainBoardModal, setShowShareMainBoardModal] = useState(false);
  const [mainBoardShares, setMainBoardShares] = useState<SharedMainBoard[]>([]);
  const [loadingMainBoardShares, setLoadingMainBoardShares] = useState(false);
  const [togglingMainBoardShareId, setTogglingMainBoardShareId] = useState<number | null>(null);

  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [showShareBoardModal, setShowShareBoardModal] = useState(false);
  const [boardShares, setBoardShares] = useState<SharedBoard[]>([]);
  const [loadingBoardShares, setLoadingBoardShares] = useState(false);
  const [togglingBoardShareId, setTogglingBoardShareId] = useState<number | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<{
    kind: "mainboard" | "board";
    shareId: number;
    targetLabel: string | null;
    sharedWithName: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchMainBoards = async () => {
      setLoadingMainBoards(true);
      try {
        const res = await fetch(`${API_BASE_URL}/board-access/all-boards?requester_user_id=${userId}&org_id=${orgId}`, {
          headers: { Accept: "application/json", "X-API-Key": API_KEY },
        });
        if (res.ok) setMainBoards(await res.json());
        else setMainBoards([]);
      } catch {
        setMainBoards([]);
      } finally {
        setLoadingMainBoards(false);
      }
    };
    fetchMainBoards();
  }, [userId, orgId]);

  const boardOptions: FlatBoardOption[] = mainBoards.flatMap(mb =>
    mb.boards.map(b => ({ board_id: b.board_id, board_name: b.board_name, main_board_name: mb.main_board_name }))
  );

  const fetchMainBoardShares = async (mainBoardId: number) => {
    setLoadingMainBoardShares(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shared-main-boards/${mainBoardId}?requester_user_id=${userId}&org_id=${orgId}`, {
        headers: { Accept: "application/json", "X-API-Key": API_KEY },
      });
      if (res.ok) setMainBoardShares(await res.json());
      else setMainBoardShares([]);
    } catch {
      setMainBoardShares([]);
    } finally {
      setLoadingMainBoardShares(false);
    }
  };

  useEffect(() => {
    if (selectedMainBoardId) fetchMainBoardShares(selectedMainBoardId);
    else setMainBoardShares([]);
  }, [selectedMainBoardId]);

  const fetchBoardShares = async (boardId: number) => {
    setLoadingBoardShares(true);
    try {
      const res = await fetch(`${API_BASE_URL}/shared-boards/${boardId}?requester_user_id=${userId}&org_id=${orgId}`, {
        headers: { Accept: "application/json", "X-API-Key": API_KEY },
      });
      if (res.ok) setBoardShares(await res.json());
      else setBoardShares([]);
    } catch {
      setBoardShares([]);
    } finally {
      setLoadingBoardShares(false);
    }
  };

  useEffect(() => {
    if (selectedBoardId) fetchBoardShares(selectedBoardId);
    else setBoardShares([]);
  }, [selectedBoardId]);

  const selectedMainBoard = mainBoards.find(b => b.main_board_id === selectedMainBoardId);
  const selectedBoard = boardOptions.find(b => b.board_id === selectedBoardId);

  const handleToggleMainBoardShare = async (share: SharedMainBoard) => {
    setTogglingMainBoardShareId(share.share_id);
    try {
      const res = await fetch(`${API_BASE_URL}/shared-main-boards/${share.share_id}?updated_by_user_id=${userId}&org_id=${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ is_active: !share.is_active }),
      });
      const data = await res.json();
      if (res.ok) {
        setMainBoardShares(prev => prev.map(s => (s.share_id === share.share_id ? data : s)));
        toast.success(share.is_active ? "Share suspended." : "Share restored.");
      } else {
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setTogglingMainBoardShareId(null);
    }
  };

  const handleToggleBoardShare = async (share: SharedBoard) => {
    setTogglingBoardShareId(share.share_id);
    try {
      const res = await fetch(`${API_BASE_URL}/shared-boards/${share.share_id}?updated_by_user_id=${userId}&org_id=${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ is_active: !share.is_active }),
      });
      const data = await res.json();
      if (res.ok) {
        setBoardShares(prev => prev.map(s => (s.share_id === share.share_id ? data : s)));
        toast.success(share.is_active ? "Share suspended." : "Share restored.");
      } else {
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setTogglingBoardShareId(null);
    }
  };

  return (
    <>
      {revokeTarget && (
        <RevokeShareModal
          kind={revokeTarget.kind}
          shareId={revokeTarget.shareId}
          targetLabel={revokeTarget.targetLabel}
          sharedWithName={revokeTarget.sharedWithName}
          orgId={orgId}
          userId={userId}
          onClose={() => setRevokeTarget(null)}
          onRevoked={shareId => {
            if (revokeTarget.kind === "mainboard") setMainBoardShares(prev => prev.filter(s => s.share_id !== shareId));
            else setBoardShares(prev => prev.filter(s => s.share_id !== shareId));
            setRevokeTarget(null);
            toast.success("Access revoked.");
          }}
        />
      )}

      {showShareMainBoardModal && (
        <ShareMainBoardModal
          orgId={orgId}
          groupId={groupId}
          groupName={groupName}
          userId={userId}
          mainBoards={mainBoards}
          loadingMainBoards={loadingMainBoards}
          defaultMainBoardId={selectedMainBoardId}
          onClose={() => setShowShareMainBoardModal(false)}
          onShared={mainBoardId => {
            setSelectedMainBoardId(mainBoardId);
            fetchMainBoardShares(mainBoardId);
            setShowShareMainBoardModal(false);
            toast.success("Main board shared successfully!");
          }}
        />
      )}

      {showShareBoardModal && (
        <ShareBoardModal
          orgId={orgId}
          groupId={groupId}
          groupName={groupName}
          userId={userId}
          boardOptions={boardOptions}
          loadingBoards={loadingMainBoards}
          defaultBoardId={selectedBoardId}
          onClose={() => setShowShareBoardModal(false)}
          onShared={boardId => {
            setSelectedBoardId(boardId);
            fetchBoardShares(boardId);
            setShowShareBoardModal(false);
            toast.success("Board shared successfully!");
          }}
        />
      )}

      {/* Main Board / Board sub-tabs */}
      <div style={gm.subTabs}>
        <button
          style={{ ...gm.subTab, ...(accessSubTab === "mainboard" ? gm.subTabActive : {}) }}
          onClick={() => setAccessSubTab("mainboard")}
        >
          Main Board
        </button>
        <button
          style={{ ...gm.subTab, ...(accessSubTab === "board" ? gm.subTabActive : {}) }}
          onClick={() => setAccessSubTab("board")}
        >
          Board
        </button>
      </div>

      {accessSubTab === "mainboard" && (
        <>
          <div style={gm.mainBoardPicker}>
            <button style={s.createBtn} onClick={() => setShowShareMainBoardModal(true)}>
              <Lock size={14} style={{ marginRight: 6, display: "inline" }} /> Share Main Board
            </button>
          </div>

          {selectedMainBoard && (
            <div style={gm.tableScroll}>
              {loadingMainBoardShares ? (
                <div style={s.empty}><Spinner /></div>
              ) : mainBoardShares.length === 0 ? (
                <div style={s.empty}>
                  <span style={{ fontSize: 32 }}>🔒</span>
                  <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>This main board hasn't been shared with anyone yet.</p>
                </div>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      {["Shared With", "Role", "Shared By", "Status", "Actions"].map(col => (
                        <th key={col} style={{ ...s.th, ...gm.thSticky }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mainBoardShares.map(share => (
                      <tr key={share.share_id}>
                        <td style={s.td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...gm.typeBadge, ...(share.shared_with_type === "GROUP" ? gm.typeBadgeGroup : gm.typeBadgeUser) }}>
                              {share.shared_with_type === "GROUP" ? <Users size={11} /> : <UserPlus size={11} />}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: "#1e293b" }}>{share.shared_with_name || "—"}</div>
                              {share.shared_with_email && <div style={{ fontSize: 12, color: "#94a3b8" }}>{share.shared_with_email}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={s.td}>{share.shared_with_org_role ? <span style={s.roleBadge}>{share.shared_with_org_role}</span> : "—"}</td>
                        <td style={s.td}>{share.shared_by_name || "—"}</td>
                        <td style={s.td}>
                          <span style={{ ...s.statusBadge, background: share.is_active ? "#dcfce7" : "#f1f5f9", color: share.is_active ? "#16a34a" : "#64748b" }}>
                            {share.is_active ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              style={gm.refreshBtn}
                              onClick={() => handleToggleMainBoardShare(share)}
                              disabled={togglingMainBoardShareId === share.share_id}
                            >
                              {togglingMainBoardShareId === share.share_id ? "…" : share.is_active ? "Suspend" : "Restore"}
                            </button>
                            <button
                              style={gm.removeBtn}
                              onClick={() => setRevokeTarget({
                                kind: "mainboard", shareId: share.share_id, targetLabel: share.main_board_name, sharedWithName: share.shared_with_name,
                              })}
                            >
                              <Trash2 size={13} style={{ marginRight: 5 }} /> Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {accessSubTab === "board" && (
        <>
          <div style={gm.mainBoardPicker}>
            <button style={s.createBtn} onClick={() => setShowShareBoardModal(true)}>
              <Lock size={14} style={{ marginRight: 6, display: "inline" }} /> Share Board
            </button>
          </div>

          {selectedBoard && (
            <div style={gm.tableScroll}>
              {loadingBoardShares ? (
                <div style={s.empty}><Spinner /></div>
              ) : boardShares.length === 0 ? (
                <div style={s.empty}>
                  <span style={{ fontSize: 32 }}>🔒</span>
                  <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>This board hasn't been shared with anyone yet.</p>
                </div>
              ) : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      {["Shared With", "Role", "Shared By", "Status", "Actions"].map(col => (
                        <th key={col} style={{ ...s.th, ...gm.thSticky }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boardShares.map(share => (
                      <tr key={share.share_id}>
                        <td style={s.td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...gm.typeBadge, ...(share.shared_with_type === "GROUP" ? gm.typeBadgeGroup : gm.typeBadgeUser) }}>
                              {share.shared_with_type === "GROUP" ? <Users size={11} /> : <UserPlus size={11} />}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: "#1e293b" }}>{share.shared_with_name || "—"}</div>
                              {share.shared_with_email && <div style={{ fontSize: 12, color: "#94a3b8" }}>{share.shared_with_email}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={s.td}>{share.shared_with_org_role ? <span style={s.roleBadge}>{share.shared_with_org_role}</span> : "—"}</td>
                        <td style={s.td}>{share.shared_by_name || "—"}</td>
                        <td style={s.td}>
                          <span style={{ ...s.statusBadge, background: share.is_active ? "#dcfce7" : "#f1f5f9", color: share.is_active ? "#16a34a" : "#64748b" }}>
                            {share.is_active ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              style={gm.refreshBtn}
                              onClick={() => handleToggleBoardShare(share)}
                              disabled={togglingBoardShareId === share.share_id}
                            >
                              {togglingBoardShareId === share.share_id ? "…" : share.is_active ? "Suspend" : "Restore"}
                            </button>
                            <button
                              style={gm.removeBtn}
                              onClick={() => setRevokeTarget({
                                kind: "board", shareId: share.share_id, targetLabel: share.board_name, sharedWithName: share.shared_with_name,
                              })}
                            >
                              <Trash2 size={13} style={{ marginRight: 5 }} /> Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ── Manage Members Modal ────────────────────────────────────────────────── */
function GroupMembersModal({
  group, orgId, userId, onClose,
}: {
  group: Group;
  orgId: number;
  userId: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"members" | "access">("members");
  const [showAddModal, setShowAddModal] = useState(false);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [memberSearch, setMemberSearch] = useState("");
  const [sortBy, setSortBy] = useState<"id" | "user_name" | "added_by_name" | "created_at" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/groups/${group.id}/members?requester_user_id=${userId}`, {
        headers: { Accept: "application/json", "X-API-Key": API_KEY },
      });
      if (res.ok) setMembers(await res.json());
      else setMembers([]);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";

  const handleRemoveMember = async (member: GroupMember) => {
    if (!member.user_email) return;
    setRemovingId(member.id);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/groups/${group.id}/members?removed_by_user_id=${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ user_email: member.user_email }),
      });
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== member.id));
        toast.success("Member removed from group.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setRemovingId(null);
    }
  };

  const TABS = [
    { id: "members" as const, label: "Members", icon: Users, enabled: true },
    { id: "access" as const, label: "Access", icon: Lock, enabled: true },
  ];

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  };

  const displayedMembers = members
    .filter(mem => {
      const q = memberSearch.trim().toLowerCase();
      if (!q) return true;
      return (mem.user_name || "").toLowerCase().includes(q) || (mem.user_email || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (!sortBy) return 0;
      if (sortBy === "id") return sortDir === "asc" ? a.id - b.id : b.id - a.id;
      const av = (a[sortBy] || "").toString().toLowerCase();
      const bv = (b[sortBy] || "").toString().toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const MemberSortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ArrowUpDown size={12} style={{ marginLeft: 4, opacity: 0.4 }} />;
    return sortDir === "asc"
      ? <ChevronUp size={12} style={{ marginLeft: 4 }} />
      : <ChevronDown size={12} style={{ marginLeft: 4 }} />;
  };

  return (
    <>
      <style>{`
        @keyframes groupDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {showAddModal && (
        <AddGroupMemberModal
          orgId={orgId}
          groupId={group.id}
          userId={userId}
          onClose={() => setShowAddModal(false)}
          onAdded={member => {
            setMembers(prev => [member, ...prev]);
            setShowAddModal(false);
            toast.success("Member added to group!");
          }}
        />
      )}

      <div style={gm.drawerOverlay} onClick={onClose}>
        <div style={gm.drawerPanel} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={gm.header}>
            <div style={gm.headerLeft}>
              <div style={gm.groupIcon}><Users size={20} /></div>
              <div>
                <h3 style={gm.groupName}>{group.name}</h3>
                <div style={gm.groupMeta}>
                  <span>Group #{group.id} · Org #{orgId}</span>
                  <span style={{ ...gm.statusBadge, ...(group.is_active ? gm.statusBadgeActive : gm.statusBadgeInactive) }}>
                    <span style={{ ...gm.statusDot, background: group.is_active ? "#16a34a" : "#94a3b8" }} />
                    {group.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
            <button style={gm.closeIconBtn} onClick={onClose}><X size={18} /></button>
          </div>

          {/* Tabs — only Members is functional for now; Access tabs are previewed but disabled */}
          <div style={gm.tabs}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  style={{ ...gm.tab, ...(isActive ? gm.tabActive : {}), ...(tab.enabled ? {} : gm.tabDisabled) }}
                  onClick={() => tab.enabled && setActiveTab(tab.id)}
                  disabled={!tab.enabled}
                  title={tab.enabled ? undefined : "Coming soon"}
                >
                  <Icon size={14} style={{ marginRight: 6 }} /> {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "members" && (
            <>
              {/* Section header */}
              <div style={gm.sectionHeader}>
                <div>
                  <h4 style={gm.sectionTitle}>Group Members</h4>
                  <p style={gm.sectionSub}>{members.length} member{members.length !== 1 ? "s" : ""}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={gm.refreshBtn} onClick={fetchMembers} disabled={membersLoading}>
                    <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
                  </button>
                  <button style={s.createBtn} onClick={() => setShowAddModal(true)}>
                    <UserPlus size={14} style={{ marginRight: 6, display: "inline" }} /> Add Member
                  </button>
                </div>
              </div>

              {members.length > 0 && (
                <div style={s.searchWrap}>
                  <Search size={16} style={{ color: "#94a3b8", marginRight: 8 }} />
                  <input
                    style={s.searchInput}
                    placeholder="Search members by name or email…"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                  />
                </div>
              )}

              {/* Members table */}
              <div style={gm.tableScroll}>
                {membersLoading ? (
                  <div style={s.empty}><Spinner /></div>
                ) : members.length === 0 ? (
                  <div style={s.empty}>
                    <span style={{ fontSize: 32 }}>👥</span>
                    <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>No members in this group yet.</p>
                  </div>
                ) : displayedMembers.length === 0 ? (
                  <div style={s.empty}>
                    <p style={{ color: "#94a3b8", fontSize: 13 }}>No members match your search.</p>
                  </div>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {([
                          ["ID", "id"], ["User ID", "user_name"], ["Added By", "added_by_name"], ["Added At", "created_at"],
                        ] as const).map(([label, col]) => (
                          <th key={col} style={{ ...s.th, ...gm.thSticky, cursor: "pointer" }} onClick={() => handleSort(col)}>
                            <span style={{ display: "inline-flex", alignItems: "center" }}>{label}<MemberSortIcon col={col} /></span>
                          </th>
                        ))}
                        <th style={{ ...s.th, ...gm.thSticky }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedMembers.map(member => (
                        <tr key={member.id}>
                          <td style={{ ...s.td, color: "#2563eb", fontWeight: 600 }}>#{member.id}</td>
                          <td style={s.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={gm.avatarSm}>{initials(member.user_name || member.user_email || "?")}</div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: "#1e293b" }}>{member.user_name || "—"}</div>
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>ID: {member.user_id}</div>
                              </div>
                            </div>
                          </td>
                          <td style={s.td}>{member.added_by_name || "—"}</td>
                          <td style={s.td}>{member.created_at ? new Date(member.created_at).toLocaleDateString() : "—"}</td>
                          <td style={s.td}>
                            <button
                              style={gm.removeBtn}
                              onClick={() => handleRemoveMember(member)}
                              disabled={removingId === member.id}
                            >
                              <Trash2 size={13} style={{ marginRight: 5 }} />
                              {removingId === member.id ? "Removing…" : "Remove"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {activeTab === "access" && (
            <GroupAccessPanel orgId={orgId} groupId={group.id} groupName={group.name} userId={userId} />
          )}
        </div>
      </div>
    </>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function GroupsPage() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setShowRoleDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userId = getOwnerUserId();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [manageGroup, setManageGroup] = useState<Group | null>(null);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "member_count" | "created_by_name" | "created_at" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const resolveOrg = async () => {
      if (!userId) { setOrgLoading(false); return; }
      setOrgLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/organizations/my-org?owner_user_id=${userId}`, {
          headers: { Accept: "application/json", "X-API-Key": API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          setOrgId(data.id);
        } else {
          setOrgId(null);
        }
      } catch {
        setOrgId(null);
      } finally {
        setOrgLoading(false);
      }
    };
    resolveOrg();
  }, [userId]);

  const fetchGroups = async (id: number) => {
    setGroupsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${id}/groups?requester_user_id=${userId}`, {
        headers: { Accept: "application/json", "X-API-Key": API_KEY },
      });
      if (res.ok) setGroups(await res.json());
      else setGroups([]);
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) fetchGroups(orgId);
    else setGroups([]);
  }, [orgId]);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  };

  const displayedGroups = groups
    .filter(g => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return g.name.toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (!sortBy) return 0;
      if (sortBy === "member_count") return sortDir === "asc" ? a.member_count - b.member_count : b.member_count - a.member_count;
      const av = (a[sortBy] || "").toString().toLowerCase();
      const bv = (b[sortBy] || "").toString().toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ArrowUpDown size={12} style={{ marginLeft: 4, opacity: 0.4 }} />;
    return sortDir === "asc"
      ? <ChevronUp size={12} style={{ marginLeft: 4 }} />
      : <ChevronDown size={12} style={{ marginLeft: 4 }} />;
  };

  return (
    <div style={s.outer}>
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar style={{ zIndex: 99999 }} />

      <header className="bg-white p-3 shadow-sm">
        <div className="flex justify-end items-center gap-2 max-w-screen-xl mx-auto">
          <LanguageSelector />

          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(prev => !prev)}
              className="flex items-center gap-2 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors border border-gray-200 text-sm"
            >
              <span className="text-sm font-medium">
                {pathname === "/Container"
                  ? t("header.consultantRole")
                  : pathname === "/CXO"
                  ? t("header.cxoRole")
                  : t("header.selectScreen")}
              </span>
              <svg
                className={`w-3 h-3 transition-transform ${showRoleDropdown ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showRoleDropdown && (
              <div ref={roleDropdownRef} className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <a href="/Consultant" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  {t("header.consultantRole")}
                </a>
                <a href="/CXO" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  {t("header.cxoRole")}
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={s.page}>

      {modalMode && orgId && (
        <GroupFormModal
          mode={modalMode}
          group={modalMode === "edit" ? editingGroup : null}
          orgId={orgId}
          userId={userId}
          onClose={() => { setModalMode(null); setEditingGroup(null); }}
          onSaved={saved => {
            setGroups(prev => modalMode === "create" ? [saved, ...prev] : prev.map(g => (g.id === saved.id ? saved : g)));
            setModalMode(null);
            setEditingGroup(null);
            toast.success(modalMode === "create" ? "Group created successfully!" : "Group updated successfully!");
          }}
        />
      )}

      {deletingGroup && orgId && (
        <DeleteGroupModal
          group={deletingGroup}
          orgId={orgId}
          userId={userId}
          onClose={() => setDeletingGroup(null)}
          onDeleted={groupId => {
            setGroups(prev => prev.filter(g => g.id !== groupId));
            setDeletingGroup(null);
            toast.success("Group deleted successfully!");
          }}
        />
      )}

      {manageGroup && orgId && (
        <GroupMembersModal
          group={manageGroup}
          orgId={orgId}
          userId={userId}
          onClose={() => { setManageGroup(null); fetchGroups(orgId); }}
        />
      )}

      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Groups</h1>
          <p style={s.pageSub}>Organize your organization's members into groups</p>
        </div>
        {orgId && (
          <button style={s.createBtn} onClick={() => setModalMode("create")}>+ Create Group</button>
        )}
      </div>

      {groups.length > 0 && (
        <div style={s.searchWrap}>
          <Search size={16} style={{ color: "#94a3b8", marginRight: 8 }} />
          <input
            style={s.searchInput}
            placeholder="Search groups by name or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      <div style={s.card}>
        {orgLoading || groupsLoading ? (
          <div style={s.empty}><Spinner /></div>
        ) : !userId ? (
          <div style={s.empty}>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Please log in to view groups.</p>
          </div>
        ) : !orgId ? (
          <div style={s.empty}>
            <span style={{ fontSize: 40 }}>🏢</span>
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 10 }}>No organization found for your account.</p>
          </div>
        ) : groups.length === 0 ? (
          <div style={s.empty}>
            <span style={{ fontSize: 40 }}>👥</span>
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 10 }}>No groups created yet.</p>
            <button style={{ ...s.createBtn, marginTop: 16 }} onClick={() => setModalMode("create")}>+ Create Group</button>
          </div>
        ) : displayedGroups.length === 0 ? (
          <div style={s.empty}>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No groups match your search.</p>
          </div>
        ) : (
          <div style={s.tableScroll}>
            <table style={s.table}>
              <thead>
                <tr>
                  {([
                    ["Name", "name"], ["Members", "member_count"], ["Created By", "created_by_name"], ["Created", "created_at"],
                  ] as const).map(([label, col]) => (
                    <th key={col} style={{ ...s.th, ...s.thSticky, cursor: "pointer" }} onClick={() => handleSort(col)}>
                      <span style={{ display: "inline-flex", alignItems: "center" }}>{label}<SortIcon col={col} /></span>
                    </th>
                  ))}
                  <th style={{ ...s.th, ...s.thSticky }}>Description</th>
                  <th style={{ ...s.th, ...s.thSticky, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedGroups.map(group => (
                  <tr key={group.id}>
                    <td style={{ ...s.td, fontWeight: 600, color: "#1e293b" }}>{group.name}</td>
                    <td style={s.td}><span style={s.countBadge}>{group.member_count}</span></td>
                    <td style={s.td}>{group.created_by_name || "—"}</td>
                    <td style={s.td}>{group.created_at ? new Date(group.created_at).toLocaleDateString() : "—"}</td>
                    <td style={{ ...s.td, color: "#64748b", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {group.description || "—"}
                    </td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button style={s.manageBtn} onClick={() => setManageGroup(group)} title="Manage members">
                          <Users size={14} style={{ marginRight: 6 }} /> Manage Members
                        </button>
                        <button style={s.iconBtn} onClick={() => { setEditingGroup(group); setModalMode("edit"); }} title="Edit group">
                          <Edit2 size={14} />
                        </button>
                        <button style={{ ...s.iconBtn, ...s.iconBtnDanger }} onClick={() => setDeletingGroup(group)} title="Delete group">
                          <Trash2 size={14} />
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

/* ── Styles ───────────────────────────────────────────────────────────────── */
const m: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(2px)" },
  box: { background: "#fff", borderRadius: 18, boxShadow: "0 16px 48px rgba(0,0,0,0.18)", padding: "28px 32px", width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 },
  closeBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, color: "#1e293b", background: "#f9fafb", outline: "none", boxSizing: "border-box" },
  cancelBtn: { padding: "10px 24px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  saveBtn: { padding: "10px 28px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" },
};

const s: Record<string, React.CSSProperties> = {
  outer: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI',sans-serif" },
  page: { padding: "36px 32px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#1e293b", margin: 0 },
  pageSub: { fontSize: 13, color: "#64748b", margin: "4px 0 0" },
  createBtn: { padding: "10px 22px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.25)", whiteSpace: "nowrap" },
  searchWrap: { display: "flex", alignItems: "center", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", padding: "10px 14px", marginBottom: 16, maxWidth: 420 },
  searchInput: { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#1e293b" },
  card: { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  tableScroll: { overflowX: "auto", overflowY: "auto", maxHeight: 480 },
  th: { padding: "13px 16px", background: "#f8faff", color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap", textAlign: "left" },
  thSticky: { position: "sticky", top: 0, zIndex: 5 },
  td: { padding: "13px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#334155", verticalAlign: "middle" },
  countBadge: { background: "#eef2ff", color: "#4338ca", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  iconBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", cursor: "pointer" },
  iconBtnDanger: { border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626" },
  manageBtn: { display: "flex", alignItems: "center", padding: "6px 12px", borderRadius: 8, border: "1.5px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 20px", textAlign: "center" },
};

/* ── Manage Members modal styles ─────────────────────────────────────────── */
const gm: Record<string, React.CSSProperties> = {
  drawerOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(1px)", zIndex: 1000 },
  drawerPanel: { position: "fixed", top: 0, right: 0, height: "100vh", width: "clamp(480px, 50vw, 820px)", background: "#fff", boxShadow: "-16px 0 48px rgba(0,0,0,0.18)", padding: "28px 32px", overflow: "hidden", boxSizing: "border-box", display: "flex", flexDirection: "column", animation: "groupDrawerSlideIn 0.22s ease-out" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexShrink: 0 },
  headerLeft: { display: "flex", alignItems: "flex-start", gap: 12 },
  groupIcon: { width: 44, height: 44, borderRadius: 12, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  groupName: { fontSize: 19, fontWeight: 700, color: "#1e293b", margin: 0 },
  groupMeta: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", marginTop: 4 },
  statusBadge: { display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  statusBadgeActive: { background: "#dcfce7", color: "#16a34a" },
  statusBadgeInactive: { background: "#f1f5f9", color: "#64748b" },
  statusDot: { width: 6, height: 6, borderRadius: "50%", display: "inline-block", marginRight: 5 },
  closeIconBtn: { background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, borderRadius: 6, display: "flex" },
  tabs: { display: "flex", gap: 4, borderBottom: "1.5px solid #e2e8f0", marginBottom: 18, flexShrink: 0 },
  tab: { display: "flex", alignItems: "center", padding: "10px 16px", border: "none", background: "none", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", borderBottom: "2px solid transparent" },
  tabActive: { color: "#2563eb", borderBottom: "2px solid #2563eb" },
  tabDisabled: { color: "#cbd5e1", cursor: "not-allowed" },
  subTabs: { display: "flex", gap: 8, marginBottom: 16, flexShrink: 0 },
  subTab: { padding: "6px 16px", borderRadius: 20, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  subTabActive: { background: "#eef2ff", border: "1.5px solid #c7d2fe", color: "#4338ca" },
  mainBoardPicker: { display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", flexShrink: 0 },
  typeBadge: { display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", flexShrink: 0 },
  typeBadgeGroup: { background: "#eef2ff", color: "#4338ca" },
  typeBadgeUser: { background: "#dbeafe", color: "#2563eb" },
  infoNote: { display: "flex", gap: 8, alignItems: "flex-start", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#1e40af", marginTop: 12, lineHeight: 1.5 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8, flexShrink: 0 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 },
  sectionSub: { fontSize: 12, color: "#94a3b8", margin: "2px 0 0" },
  refreshBtn: { display: "flex", alignItems: "center", padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  selectedCard: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1.5px solid #bfdbfe", background: "#eff6ff", borderRadius: 10 },
  changeBtn: { padding: "6px 12px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#fff", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  avatar: { width: 36, height: 36, borderRadius: "50%", background: "#dbeafe", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
  avatarSm: { width: 30, height: 30, borderRadius: "50%", background: "#dbeafe", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  dropdown: { position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 12px 28px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto", zIndex: 20 },
  dropdownItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" },
  dropdownEmpty: { padding: "16px 12px", fontSize: 13, color: "#94a3b8", textAlign: "center" },
  removeBtn: { display: "inline-flex", alignItems: "center", padding: "6px 14px", borderRadius: 20, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  tableScroll: { flex: 1, overflowX: "auto", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: 10, minHeight: 0 },
  thSticky: { position: "sticky", top: 0, zIndex: 5 },
};
