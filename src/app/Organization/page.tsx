"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Search, Edit2, Trash2, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import Spinner from "../components/Spinner";
import LanguageSelector from "../components/LanguageSelector";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

interface Organization {
  id: number;
  owner_user_id: number;
  name: string;
  org_code: string;
  industry_type: string;
  registered_country: string;
  address: string;
  company_website: string | null;
  company_size: string | null;
  gst_number: string | null;
  pan_number: string | null;
  billing_email: string | null;
  org_logo_url: string | null;
  business_entity_type: string | null;
  fiscal_year_start_month: number | null;
  hq_timezone: string | null;
  support_contact_phone: string | null;
  support_contact_email: string | null;
  subscription: string;
  trial_end_date: string | null;
  is_trial_active: boolean;
  is_active: boolean;
}

interface OrgMember {
  id: number;
  organization_id: number;
  user_id: number;
  org_role: string;
  status: string;
  joined_at: string | null;
  user_name: string | null;
  user_email: string | null;
  user_department: string | null;
  user_designation: string | null;
}

interface NonMemberUser {
  user_id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  mobile_number: string | null;
  country: string | null;
  department: string | null;
  designation: string | null;
}

const ORG_ROLES = ["SUPER_ADMIN", "ADMIN", "EDITOR", "ANALYST", "VIEWER"];

interface OrgFormValues {
  name: string;
  industry_type: string;
  registered_country: string;
  address: string;
  org_code: string;
  company_website: string;
  company_size: string;
  gst_number: string;
  pan_number: string;
  billing_email: string;
  org_logo_url: string;
  business_entity_type: string;
  fiscal_year_start_month: string;
  hq_timezone: string;
  support_contact_phone: string;
  support_contact_email: string;
}

const emptyForm: OrgFormValues = {
  name: "", industry_type: "", registered_country: "", address: "", org_code: "",
  company_website: "", company_size: "", gst_number: "", pan_number: "", billing_email: "",
  org_logo_url: "", business_entity_type: "", fiscal_year_start_month: "4", hq_timezone: "",
  support_contact_phone: "", support_contact_email: "",
};

function toFormValues(org: Organization): OrgFormValues {
  return {
    name: org.name || "", industry_type: org.industry_type || "", registered_country: org.registered_country || "",
    address: org.address || "", org_code: org.org_code || "", company_website: org.company_website || "",
    company_size: org.company_size || "", gst_number: org.gst_number || "", pan_number: org.pan_number || "",
    billing_email: org.billing_email || "", org_logo_url: org.org_logo_url || "",
    business_entity_type: org.business_entity_type || "",
    fiscal_year_start_month: org.fiscal_year_start_month ? String(org.fiscal_year_start_month) : "4",
    hq_timezone: org.hq_timezone || "", support_contact_phone: org.support_contact_phone || "",
    support_contact_email: org.support_contact_email || "",
  };
}

/* ── Create / Edit Modal ─────────────────────────────────────────────────── */
function OrgFormModal({
  mode, orgId, initial, onClose, onSaved,
}: {
  mode: "create" | "edit";
  orgId: number | null;
  initial: OrgFormValues;
  onClose: () => void;
  onSaved: (org: Organization) => void;
}) {
  const [form, setForm] = useState<OrgFormValues>(initial);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof OrgFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.industry_type.trim() || !form.registered_country.trim() || !form.address.trim()) {
      toast.error("Name, Industry Type, Country and Address are required.");
      return;
    }
    const ownerUserId = getOwnerUserId();
    if (!ownerUserId) { toast.error("Could not determine the logged-in user."); return; }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      industry_type: form.industry_type.trim(),
      registered_country: form.registered_country.trim(),
      address: form.address.trim(),
      company_website: form.company_website.trim() || null,
      company_size: form.company_size.trim() || null,
      gst_number: form.gst_number.trim() || null,
      pan_number: form.pan_number.trim() || null,
      billing_email: form.billing_email.trim() || null,
      org_logo_url: form.org_logo_url.trim() || null,
      business_entity_type: form.business_entity_type.trim() || null,
      fiscal_year_start_month: form.fiscal_year_start_month ? Number(form.fiscal_year_start_month) : null,
      hq_timezone: form.hq_timezone.trim() || null,
      support_contact_phone: form.support_contact_phone.trim() || null,
      support_contact_email: form.support_contact_email.trim() || null,
    };
    if (mode === "create") payload.org_code = form.org_code.trim() || null;

    setSaving(true);
    try {
      const url = mode === "create"
        ? `${API_BASE_URL}/organizations/?owner_user_id=${ownerUserId}`
        : `${API_BASE_URL}/organizations/${orgId}?owner_user_id=${ownerUserId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify(payload),
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
      <div style={m.box} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <h3 style={m.title}>{mode === "create" ? "Create Organization" : "Edit Organization"}</h3>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={m.grid}>
          <Field label="Organization Name" required value={form.name} onChange={set("name")} placeholder="e.g. Acme Corporation" />
          <Field label="Industry Type" required value={form.industry_type} onChange={set("industry_type")} placeholder="e.g. IT Services" />

          <Field label="Registered Country" required value={form.registered_country} onChange={set("registered_country")} placeholder="e.g. India" />
          <Field label="Org Code" value={form.org_code} onChange={set("org_code")} placeholder="Optional code" disabled={mode === "edit"} />

          <div style={{ gridColumn: "span 2" }}>
            <label style={m.label}>Address <span style={{ color: "#ef4444" }}>*</span></label>
            <textarea
              value={form.address}
              onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Registered office address"
              style={{ ...m.input, minHeight: 70, resize: "vertical" }}
            />
          </div>

          <Field label="Company Website" value={form.company_website} onChange={set("company_website")} placeholder="https://example.com" />
          <Field label="Company Size" value={form.company_size} onChange={set("company_size")} placeholder="e.g. 11-50" />

          <Field label="GST Number" value={form.gst_number} onChange={set("gst_number")} />
          <Field label="PAN Number" value={form.pan_number} onChange={set("pan_number")} />

          <Field label="Billing Email" type="email" value={form.billing_email} onChange={set("billing_email")} />
          <Field label="Org Logo URL" value={form.org_logo_url} onChange={set("org_logo_url")} />

          <Field label="Business Entity Type" value={form.business_entity_type} onChange={set("business_entity_type")} placeholder="e.g. Private Limited" />
          <Field label="HQ Timezone" value={form.hq_timezone} onChange={set("hq_timezone")} placeholder="e.g. Asia/Kolkata" />

          <Field label="Fiscal Year Start Month" type="number" value={form.fiscal_year_start_month} onChange={set("fiscal_year_start_month")} />
          <Field label="Support Contact Phone" type="tel" value={form.support_contact_phone} onChange={set("support_contact_phone")} />

          <div style={{ gridColumn: "span 2" }}>
            <Field label="Support Contact Email" type="email" value={form.support_contact_email} onChange={set("support_contact_email")} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={m.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Save Organization" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Member Modal ────────────────────────────────────────────────────── */
function AddMemberModal({
  orgId, ownerUserId, onClose, onAdded,
}: {
  orgId: number;
  ownerUserId: string;
  onClose: () => void;
  onAdded: (member: OrgMember) => void;
}) {
  const [candidates, setCandidates] = useState<NonMemberUser[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [query, setQuery] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<NonMemberUser | null>(null);
  const [orgRole, setOrgRole] = useState("");
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCandidates = async () => {
      setLoadingCandidates(true);
      try {
        const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/non-members?requester_user_id=${ownerUserId}`, {
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
  }, [orgId, ownerUserId]);

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

  const handleSave = async () => {
    if (!selectedUser) { toast.error("Please select a user to add."); return; }
    if (!orgRole) { toast.error("Please select a role for this member."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/members?added_by_user_id=${ownerUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ user_email: selectedUser.email, org_role: orgRole }),
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
      setSaving(false);
    }
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={{ ...m.box, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <h3 style={m.title}>Add Member</h3>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: 18 }} ref={boxRef}>
          <label style={m.label}>User Email <span style={{ color: "#ef4444" }}>*</span></label>

          {selectedUser ? (
            <div style={am.selectedCard}>
              <div style={am.avatar}>{initials(selectedUser.full_name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{selectedUser.full_name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{selectedUser.email}</div>
              </div>
              <button style={am.changeBtn} onClick={() => setSelectedUser(null)}>Change</button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <input
                style={m.input}
                placeholder="Search by name or email…"
                value={query}
                onFocus={() => setShowOptions(true)}
                onChange={e => { setQuery(e.target.value); setShowOptions(true); }}
              />
              {showOptions && (
                <div style={am.dropdown}>
                  {loadingCandidates ? (
                    <div style={am.dropdownEmpty}>Loading users…</div>
                  ) : filteredCandidates.length === 0 ? (
                    <div style={am.dropdownEmpty}>No matching users found.</div>
                  ) : (
                    filteredCandidates.map(u => (
                      <div
                        key={u.user_id}
                        style={am.dropdownItem}
                        onClick={() => { setSelectedUser(u); setShowOptions(false); setQuery(""); }}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <div style={am.avatarSm}>{initials(u.full_name)}</div>
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

        <div style={{ marginBottom: 8 }}>
          <label style={m.label}>Organization Role <span style={{ color: "#ef4444" }}>*</span></label>
          <select value={orgRole} onChange={e => setOrgRole(e.target.value)} style={{ ...m.input, cursor: "pointer" }}>
            <option value="">Select a role</option>
            {ORG_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={m.saveBtn} onClick={handleSave} disabled={saving || !selectedUser || !orgRole}>
            {saving ? "Adding…" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Member Role Modal ──────────────────────────────────────────────── */
function EditMemberRoleModal({
  member, orgId, ownerUserId, onClose, onSaved,
}: {
  member: OrgMember;
  orgId: number;
  ownerUserId: string;
  onClose: () => void;
  onSaved: (member: OrgMember) => void;
}) {
  const [orgRole, setOrgRole] = useState(member.org_role);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!orgRole) { toast.error("Please select a role."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/members/${member.id}?updated_by_user_id=${ownerUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ org_role: orgRole }),
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
      <div style={{ ...m.box, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={m.header}>
          <h3 style={m.title}>Edit Member Role</h3>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={am.selectedCard}>
          <div style={am.avatar}>{(member.user_name || member.user_email || "?").charAt(0).toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{member.user_name || "—"}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{member.user_email}</div>
          </div>
        </div>

        <div style={{ margin: "18px 0 8px" }}>
          <label style={m.label}>Organization Role <span style={{ color: "#ef4444" }}>*</span></label>
          <select value={orgRole} onChange={e => setOrgRole(e.target.value)} style={{ ...m.input, cursor: "pointer" }}>
            {ORG_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={m.saveBtn} onClick={handleSave} disabled={saving || orgRole === member.org_role}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Member Modal ─────────────────────────────────────────────────── */
function DeleteMemberModal({
  member, orgId, ownerUserId, onClose, onDeleted,
}: {
  member: OrgMember;
  orgId: number;
  ownerUserId: string;
  onClose: () => void;
  onDeleted: (memberId: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/members/${member.id}?removed_by_user_id=${ownerUserId}`, {
        method: "DELETE",
        headers: { Accept: "application/json", "X-API-Key": API_KEY },
      });
      if (res.ok) {
        onDeleted(member.id);
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
        <h3 style={m.title}>Remove Member?</h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: "10px 0 20px" }}>
          Remove <strong>{member.user_name || member.user_email}</strong> from this organization?
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button style={m.cancelBtn} onClick={onClose} disabled={deleting}>Cancel</button>
          <button style={{ ...m.saveBtn, background: "#ef4444" }} onClick={handleDelete} disabled={deleting}>
            {deleting ? "Removing…" : "Yes, Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, required, type = "text", placeholder, disabled,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label style={m.label}>{label} {required && <span style={{ color: "#ef4444" }}>*</span>}</label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
        style={{ ...m.input, ...(disabled ? { background: "#f1f5f9", color: "#94a3b8", cursor: "not-allowed" } : {}) }}
      />
    </div>
  );
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

function getStoredOrgData(): Organization | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("currentUserData");
    if (!raw) return null;
    const p = JSON.parse(raw);
    const d = p.orgData;
    if (!d?.id) return null;
    return {
      id: d.id,
      owner_user_id: d.owner_user_id || 0,
      name: d.name || "",
      org_code: d.org_code || "",
      industry_type: d.industry_type || "",
      registered_country: d.registered_country || "",
      address: d.address || "",
      company_website: d.company_website || null,
      company_size: d.company_size || null,
      gst_number: d.gst_number || null,
      pan_number: d.pan_number || null,
      billing_email: d.billing_email || null,
      org_logo_url: d.org_logo_url || null,
      business_entity_type: d.business_entity_type || null,
      fiscal_year_start_month: d.fiscal_year_start_month || null,
      hq_timezone: d.hq_timezone || null,
      support_contact_phone: d.support_contact_phone || null,
      support_contact_email: d.support_contact_email || null,
      subscription: d.subscription || "",
      trial_end_date: d.trial_end_date || null,
      is_trial_active: d.is_trial_active ?? false,
      is_active: d.is_active !== undefined ? d.is_active : true,
    };
  } catch {
    return null;
  }
}

function getSessionOrgRole(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = sessionStorage.getItem("currentUserData");
    if (!raw) return "";
    const p = JSON.parse(raw);
    return (p.orgRole || "").toUpperCase();
  } catch {
    return "";
  }
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function OrganizationPage() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [activeScreenRole, setActiveScreenRole] = useState<"consultant" | "cxo">("consultant");
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

  useEffect(() => {
    if (pathname === "/CXO" || pathname === "/CXODemo") {
      setActiveScreenRole("cxo");
      localStorage.setItem("activeScreenRole", "cxo");
    } else if (pathname === "/Container" || pathname === "/Consultant" || pathname === "/Dashboard") {
      setActiveScreenRole("consultant");
      localStorage.setItem("activeScreenRole", "consultant");
    } else {
      const stored = localStorage.getItem("activeScreenRole") as "consultant" | "cxo" | null;
      setActiveScreenRole(stored || "consultant");
    }
  }, [pathname]);

  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);

  const ownerUserId = getOwnerUserId();
  const sessionOrgRole = getSessionOrgRole();
  const isViewer = sessionOrgRole === 'VIEWER';
  const canCreateOrg = sessionOrgRole !== 'SUPER_ADMIN' && sessionOrgRole !== 'ADMIN';

  const fetchMyOrg = async () => {
    if (!ownerUserId) { setLoading(false); return; }
    setLoading(true);
    // Use org from login response if available — works for all roles including SUPER_ADMIN
    const storedOrg = getStoredOrgData();
    if (storedOrg) { setOrg(storedOrg); setLoading(false); return; }
    // Fallback API call (only resolves for OWNER)
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/my-org?owner_user_id=${ownerUserId}`, {
        headers: { Accept: "application/json", "X-API-Key": API_KEY },
      });
      if (res.status === 404) {
        setOrg(null);
      } else if (res.ok) {
        setOrg(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.detail === "string" ? data.detail : `Error ${res.status}`);
      }
    } catch (e: any) {
      toast.error(`Network error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMyOrg(); }, []);

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const fetchMembers = async (orgId: number) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/organizations/${orgId}/members?requester_user_id=${ownerUserId}`, {
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

  useEffect(() => {
    if (org) fetchMembers(org.id);
    else setMembers([]);
  }, [org?.id]);

  const [memberSearch, setMemberSearch] = useState("");
  const [sortBy, setSortBy] = useState<"user_name" | "user_email" | "org_role" | "status" | "joined_at" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
  const [deletingMember, setDeletingMember] = useState<OrgMember | null>(null);

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
      <header className="bg-white p-3 shadow-sm">
        <div className="flex justify-end items-center gap-2 max-w-screen-xl mx-auto">
          <LanguageSelector />

          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(prev => !prev)}
              className="flex items-center gap-2 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors border border-gray-200 text-sm"
            >
              <span className="text-sm font-medium">
                {activeScreenRole === "cxo" ? t("header.cxoRole") : t("header.consultantRole")}
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
                <button
                  onClick={() => { localStorage.setItem("activeScreenRole", "consultant"); setActiveScreenRole("consultant"); setShowRoleDropdown(false); router.push("/Container"); }}
                  className={`w-full text-left block px-4 py-2 text-sm hover:bg-gray-50 ${activeScreenRole === "consultant" ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"}`}>
                  {t("header.consultantRole")}
                </button>
                <button
                  onClick={() => { localStorage.setItem("activeScreenRole", "cxo"); setActiveScreenRole("cxo"); setShowRoleDropdown(false); router.push("/CXO"); }}
                  className={`w-full text-left block px-4 py-2 text-sm hover:bg-gray-50 ${activeScreenRole === "cxo" ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"}`}>
                  {t("header.cxoRole")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={s.page}>

      {modalMode && (
        <OrgFormModal
          mode={modalMode}
          orgId={org?.id ?? null}
          initial={modalMode === "edit" && org ? toFormValues(org) : emptyForm}
          onClose={() => setModalMode(null)}
          onSaved={updated => {
            setOrg(updated);
            setModalMode(null);
            toast.success(modalMode === "create" ? "Organization created successfully!" : "Organization updated successfully!");
          }}
        />
      )}

      {showAddMemberModal && org && (
        <AddMemberModal
          orgId={org.id}
          ownerUserId={ownerUserId}
          onClose={() => setShowAddMemberModal(false)}
          onAdded={member => {
            setMembers(prev => [member, ...prev]);
            setShowAddMemberModal(false);
            toast.success("Member added successfully!");
          }}
        />
      )}

      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Organization</h1>
          <p style={s.pageSub}>Manage your organization profile</p>
        </div>
        {!org && !loading && canCreateOrg && (
          <button style={isViewer ? { ...s.createBtn, opacity: 0.4, cursor: 'not-allowed' } : s.createBtn} onClick={() => !isViewer && setModalMode("create")} disabled={isViewer}>+ Create Organization</button>
        )}
      </div>

      <div style={s.card}>
        {loading ? (
          <div style={s.empty}><Spinner /></div>
        ) : !ownerUserId ? (
          <div style={s.empty}>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Please log in to view your organization.</p>
          </div>
        ) : !org ? (
          <div style={s.empty}>
            <span style={{ fontSize: 40 }}>🏢</span>
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 10 }}>
              {canCreateOrg ? "You have not created an organization yet." : "No organization found for your account."}
            </p>
            {canCreateOrg && (
              <button style={isViewer ? { ...s.createBtn, marginTop: 16, opacity: 0.4, cursor: 'not-allowed' } : { ...s.createBtn, marginTop: 16 }} onClick={() => !isViewer && setModalMode("create")} disabled={isViewer}>+ Create Organization</button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Org Code", "Name", "Industry", "Country", "Subscription", "Status", "Actions"].map(col => (
                    <th key={col} style={{ ...s.th, textAlign: col === "Actions" ? "center" : "left" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={s.td}><span style={s.codeBadge}>{org.org_code}</span></td>
                  <td style={{ ...s.td, fontWeight: 600, color: "#1e293b" }}>{org.name}</td>
                  <td style={s.td}>{org.industry_type}</td>
                  <td style={s.td}>{org.registered_country}</td>
                  <td style={s.td}>{org.subscription}{org.is_trial_active ? " (Trial)" : ""}</td>
                  <td style={s.td}>
                    <span style={{ ...s.statusBadge, background: org.is_active ? "#dcfce7" : "#fee2e2", color: org.is_active ? "#16a34a" : "#dc2626" }}>
                      {org.is_active ? "● Active" : "● Inactive"}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button style={isViewer ? { ...s.editBtn, opacity: 0.4, cursor: 'not-allowed' } : s.editBtn} onClick={() => !isViewer && setModalMode("edit")} disabled={isViewer}>✏️ Edit</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingMember && org && (
        <EditMemberRoleModal
          member={editingMember}
          orgId={org.id}
          ownerUserId={ownerUserId}
          onClose={() => setEditingMember(null)}
          onSaved={updated => {
            setMembers(prev => prev.map(mem => (mem.id === updated.id ? updated : mem)));
            setEditingMember(null);
            toast.success("Member role updated successfully!");
          }}
        />
      )}

      {deletingMember && org && (
        <DeleteMemberModal
          member={deletingMember}
          orgId={org.id}
          ownerUserId={ownerUserId}
          onClose={() => setDeletingMember(null)}
          onDeleted={memberId => {
            setMembers(prev => prev.filter(mem => mem.id !== memberId));
            setDeletingMember(null);
            toast.success("Member removed successfully!");
          }}
        />
      )}

      {org && (
        <>
          <div style={{ ...s.header, marginTop: 32 }}>
            <div>
              <h2 style={s.sectionTitle}>Add Members to Organization</h2>
              <p style={s.pageSub}>Manage who has access to {org.name}</p>
            </div>
            <button style={isViewer ? { ...s.createBtn, opacity: 0.4, cursor: 'not-allowed' } : s.createBtn} onClick={() => !isViewer && setShowAddMemberModal(true)} disabled={isViewer}>+ Add Member</button>
          </div>

          {members.length > 0 && (
            <div style={s.searchWrap2}>
              <Search size={16} style={{ color: "#94a3b8", marginRight: 8 }} />
              <input
                style={s.searchInput2}
                placeholder="Search members by name or email…"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
              />
            </div>
          )}

          <div style={s.card}>
            {membersLoading ? (
              <div style={s.empty}><Spinner /></div>
            ) : members.length === 0 ? (
              <div style={s.empty}>
                <span style={{ fontSize: 40 }}>👥</span>
                <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 10 }}>No members added yet.</p>
              </div>
            ) : displayedMembers.length === 0 ? (
              <div style={s.empty}>
                <p style={{ color: "#94a3b8", fontSize: 14 }}>No members match your search.</p>
              </div>
            ) : (
              <div style={s.tableScroll}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {([
                        ["Name", "user_name"], ["Email", "user_email"], ["Role", "org_role"],
                        ["Status", "status"], ["Joined", "joined_at"],
                      ] as const).map(([label, col]) => (
                        <th key={col} style={{ ...s.th, ...s.thSticky, cursor: "pointer" }} onClick={() => handleSort(col)}>
                          <span style={{ display: "inline-flex", alignItems: "center" }}>{label}<SortIcon col={col} /></span>
                        </th>
                      ))}
                      <th style={{ ...s.th, ...s.thSticky, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedMembers.map(member => (
                      <tr key={member.id}>
                        <td style={{ ...s.td, fontWeight: 600, color: "#1e293b" }}>{member.user_name || "—"}</td>
                        <td style={s.td}>{member.user_email || "—"}</td>
                        <td style={s.td}><span style={s.roleBadge}>{member.org_role}</span></td>
                        <td style={s.td}>
                          <span style={{ ...s.statusBadge, background: member.status === "ACTIVE" ? "#dcfce7" : "#f1f5f9", color: member.status === "ACTIVE" ? "#16a34a" : "#64748b" }}>
                            {member.status}
                          </span>
                        </td>
                        <td style={s.td}>{member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "—"}</td>
                        <td style={{ ...s.td, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            <button style={isViewer ? { ...s.iconBtn, opacity: 0.4, cursor: 'not-allowed' } : s.iconBtn} onClick={() => !isViewer && setEditingMember(member)} title="Edit role" disabled={isViewer}>
                              <Edit2 size={14} />
                            </button>
                            <button style={isViewer ? { ...s.iconBtn, ...s.iconBtnDanger, opacity: 0.4, cursor: 'not-allowed' } : { ...s.iconBtn, ...s.iconBtnDanger }} onClick={() => !isViewer && setDeletingMember(member)} title="Remove member" disabled={isViewer}>
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
        </>
      )}
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
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 10 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, color: "#1e293b", background: "#f9fafb", outline: "none", boxSizing: "border-box" },
  cancelBtn: { padding: "10px 24px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  saveBtn: { padding: "10px 28px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" },
};

/* ── Add Member styles ───────────────────────────────────────────────────── */
const am: Record<string, React.CSSProperties> = {
  dropdown: { position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, boxShadow: "0 12px 28px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto", zIndex: 20 },
  dropdownItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" },
  dropdownEmpty: { padding: "16px 12px", fontSize: 13, color: "#94a3b8", textAlign: "center" },
  avatar: { width: 36, height: 36, borderRadius: "50%", background: "#dbeafe", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
  avatarSm: { width: 30, height: 30, borderRadius: "50%", background: "#eef2ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  selectedCard: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1.5px solid #bfdbfe", background: "#eff6ff", borderRadius: 10 },
  changeBtn: { padding: "6px 12px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#fff", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
};

const s: Record<string, React.CSSProperties> = {
  outer: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI',sans-serif" },
  page: { padding: "36px 32px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 26, fontWeight: 700, color: "#1e293b", margin: 0 },
  sectionTitle: { fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 },
  pageSub: { fontSize: 13, color: "#64748b", margin: "4px 0 0" },
  createBtn: { padding: "10px 22px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.25)", whiteSpace: "nowrap" },
  card: { background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  tableScroll: { overflowX: "auto", overflowY: "auto", maxHeight: 420 },
  th: { padding: "13px 16px", background: "#f8faff", color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap", textAlign: "left" },
  thSticky: { position: "sticky", top: 0, zIndex: 5 },
  td: { padding: "13px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#334155", verticalAlign: "middle" },
  codeBadge: { background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontFamily: "monospace" },
  statusBadge: { padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  roleBadge: { padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#eef2ff", color: "#4338ca" },
  editBtn: { padding: "6px 14px", borderRadius: 8, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  iconBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", cursor: "pointer" },
  iconBtnDanger: { border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626" },
  searchWrap2: { display: "flex", alignItems: "center", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", padding: "10px 14px", marginBottom: 16, maxWidth: 420 },
  searchInput2: { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#1e293b" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 20px", textAlign: "center" },
};
