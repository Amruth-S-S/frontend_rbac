"use client";

import { useState } from "react";

export default function CreateOrganizationForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [userId, setUserId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  };

  const validate = () => {
    const errs: { name?: string; slug?: string } = {};
    if (!name.trim()) errs.name = "Organization name is required.";
    if (!slug.trim()) errs.slug = "Slug is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    setResult(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json",
      };
      if (userId) headers["X-User-Id"] = userId;
      const res = await fetch("http://104.225.218.36:8002/organizations/", {
        method: "POST",
        headers,
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `"${name}" was created successfully.` });
      } else {
        setResult({ ok: false, message: `Error ${res.status}`, detail: data.detail || JSON.stringify(data) });
      }
    } catch (e: any) {
      setResult({ ok: false, message: "Network Error", detail: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(""); setSlug(""); setUserId("");
    setErrors({}); setResult(null);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Create Organization</h2>
        <p style={styles.sub}>Fill in the details below to create a new organization.</p>

        {/* Name */}
        <div style={styles.field}>
          <label style={styles.label}>Organization Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            style={{ ...styles.input, ...(errors.name ? styles.inputError : {}) }}
            placeholder="e.g. Acme Corporation"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          {errors.name && <p style={styles.errText}>{errors.name}</p>}
        </div>

        {/* Slug */}
        <div style={styles.field}>
          <label style={styles.label}>Slug <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            style={{ ...styles.input, ...(errors.slug ? styles.inputError : {}) }}
            placeholder="e.g. acme-corporation"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <p style={styles.hint}>Used in URLs. Auto-filled from name — you can edit it.</p>
          {errors.slug && <p style={styles.errText}>{errors.slug}</p>}
        </div>

        {/* User ID */}
        <div style={styles.field}>
          <label style={styles.label}>User ID (X-User-Id)</label>
          <input
            style={styles.input}
            placeholder="Enter your user ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div style={styles.btnRow}>
          <button style={styles.cancelBtn} onClick={handleCancel} disabled={loading}>Cancel</button>
          <button style={styles.saveBtn} onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Organization"}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div style={{ ...styles.resultBox, background: result.ok ? "#f0fdf4" : "#fef2f2", borderColor: result.ok ? "#bbf7d0" : "#fecaca" }}>
            <span style={{ fontSize: 18 }}>{result.ok ? "✓" : "✗"}</span>
            <div>
              <strong style={{ color: result.ok ? "#16a34a" : "#dc2626", fontSize: 13 }}>{result.message}</strong>
              {result.detail && <p style={{ fontSize: 12, color: result.ok ? "#15803d" : "#b91c1c", marginTop: 2 }}>{result.detail}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#e8f4fd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 16px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(59,130,246,0.12)",
    padding: "36px 40px",
    width: "100%",
    maxWidth: 480,
  },
  title: { fontSize: 22, fontWeight: 700, color: "#1e293b", marginBottom: 4 },
  sub: { fontSize: 13, color: "#64748b", marginBottom: 28 },
  field: { marginBottom: 20 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 },
  input: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: "1.5px solid #e2e8f0",
    fontSize: 14,
    color: "#1e293b",
    background: "#f9fafb",
    outline: "none",
    boxSizing: "border-box",
  },
  inputError: { borderColor: "#f87171" },
  hint: { fontSize: 11, color: "#94a3b8", marginTop: 5 },
  errText: { fontSize: 11, color: "#dc2626", marginTop: 5 },
  btnRow: { display: "flex", gap: 12, marginTop: 28 },
  cancelBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    border: "1.5px solid #e2e8f0", background: "#fff",
    color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  saveBtn: {
    flex: 2, padding: 12, borderRadius: 10,
    border: "none", background: "#3b82f6",
    color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
  },
  resultBox: {
    display: "flex", alignItems: "flex-start", gap: 10,
    marginTop: 18, border: "1.5px solid", borderRadius: 10, padding: "12px 16px",
  },
};