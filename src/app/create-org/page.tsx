"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://104.225.218.36:8002";
const API_KEY = "Mnnshh@&!UyqrtvTTXCTvbjjj>ISecuredFCAhyqbjxeg*&@$!7676191005HbghbbwswswIUbwqvQCG1065";

/* ─── Toast ─────────────────────────────────────────────────── */
type ToastType = "success" | "error";
interface Toast { id: number; type: ToastType; title: string; message?: string; }

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div style={toastStyles.container}>
      {toasts.map((t) => (
        <div key={t.id} style={{ ...toastStyles.toast, borderLeft: `4px solid ${t.type === "success" ? "#22c55e" : "#ef4444"}`, animation: "slideIn 0.3s ease" }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{t.type === "success" ? "✅" : "❌"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...toastStyles.toastTitle, color: t.type === "success" ? "#15803d" : "#dc2626" }}>{t.title}</p>
            {t.message && <p style={toastStyles.toastMsg}>{t.message}</p>}
          </div>
          <button style={toastStyles.closeBtn} onClick={() => remove(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ─── Hook ───────────────────────────────────────────────────── */
let toastIdCounter = 0;
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const show = (type: ToastType, title: string, message?: string) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => remove(id), 4000);
  };
  return { toasts, show, remove };
}

/* ─── Form ───────────────────────────────────────────────────── */
export default function CreateOrganizationForm() {
  const router = useRouter();

  const [name,           setName]           = useState("");
  const [org_description, setOrgDescription] = useState("");
  const [userId,         setUserId]         = useState("");
  const [errors,         setErrors]         = useState<{ name?: string; org_description?: string }>({});
  const [loading,        setLoading]        = useState(false);
  const { toasts, show, remove } = useToast();

  const validate = () => {
    const errs: { name?: string; org_description?: string } = {};
    if (!name.trim())            errs.name            = "Organization name is required.";
    if (!org_description.trim()) errs.org_description = "Description is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json",
        "X-API-Key": API_KEY,
      };
      if (userId.trim()) headers["X-User-Id"] = userId.trim();

      const res = await fetch(`${API_BASE}/organizations/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, slug: org_description }),
      });
      const data = await res.json();

      if (res.ok) {
        show("success", `"${data.name}" created successfully!`, `Organization ID: ${data.id}`);
        setName(""); setOrgDescription(""); setUserId(""); setErrors({});
      } else {
        const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data);
        show("error", `Error ${res.status}`, detail);
      }
    } catch (e: any) {
      show("error", "Network Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(""); setOrgDescription(""); setUserId(""); setErrors({});
    router.push("/create-org-list");
  };

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        * { box-sizing: border-box; }
      `}</style>

      <ToastContainer toasts={toasts} remove={remove} />

      <div style={styles.page}>
        <div style={styles.card}>

          <h2 style={styles.title}>Create Organization</h2>
          <p style={styles.sub}>Fill in the details below to create a new organization.</p>

          {/* 1. Organization Name */}
          <div style={styles.field}>
            <label style={styles.label}>
              Organization Name <span style={styles.required}>*</span>
            </label>
            <input
              style={{ ...styles.input, ...(errors.name ? styles.inputError : {}) }}
              placeholder="e.g. Acme Corporation"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p style={styles.errText}>{errors.name}</p>}
          </div>

          {/* 2. Description (org_description) */}
          <div style={styles.field}>
            <label style={styles.label}>
              Description <span style={styles.required}>*</span>
            </label>
            <input
              style={{ ...styles.input, ...(errors.org_description ? styles.inputError : {}) }}
              placeholder="Enter a short description"
              value={org_description}
              onChange={(e) => setOrgDescription(e.target.value)}
            />
            {errors.org_description && <p style={styles.errText}>{errors.org_description}</p>}
          </div>

          {/* 3. User ID */}
          <div style={styles.field}>
            <label style={styles.label}>User ID </label>
            <input
              style={styles.input}
              placeholder="Enter your user ID "
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div style={styles.btnRow}>
            <button style={styles.cancelBtn} onClick={handleCancel} disabled={loading}>
              Cancel
            </button>
            <button style={styles.saveBtn} onClick={handleSave} disabled={loading}>
              {loading ? "Saving…" : "Save Organization"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const toastStyles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
    maxWidth: 360, width: "100%", pointerEvents: "none",
  },
  toast: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "14px 16px", borderRadius: 12, background: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    fontFamily: "'Segoe UI', sans-serif", pointerEvents: "all",
  },
  toastTitle: { fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.4 },
  toastMsg:   { fontSize: 11, color: "#64748b", margin: "3px 0 0", lineHeight: 1.4, wordBreak: "break-all" },
  closeBtn:   { background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 },
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 20px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    padding: "40px 48px",
    width: "100%",
    maxWidth: 520,
  },
  title:    { fontSize: 26, fontWeight: 700, color: "#2563eb", textAlign: "center", marginBottom: 6 },
  sub:      { fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 32 },
  field:    { marginBottom: 22 },
  label:    { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 },
  required: { color: "#ef4444" },
  input: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: "1.5px solid #e2e8f0",
    fontSize: 14,
    color: "#1e293b",
    background: "#f9fafb",
    outline: "none",
  },
  inputError: { borderColor: "#f87171" },
  errText:  { fontSize: 11, color: "#dc2626", marginTop: 4 },
  btnRow:   { display: "flex", gap: 12, marginTop: 32, justifyContent: "flex-end" },
  cancelBtn: {
    padding: "11px 28px", borderRadius: 10,
    border: "1.5px solid #e2e8f0", background: "#fff",
    color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  saveBtn: {
    padding: "11px 36px", borderRadius: 10,
    border: "none", background: "#2563eb",
    color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
  },
};