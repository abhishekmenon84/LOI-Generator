"use client";

import { useEffect, useState } from "react";
import AnchorEditor from "./AnchorEditor";

export default function KeeperTemplates({ orgId }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // full detail incl. anchors

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/templates`)
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setError("Could not load templates."))
      .finally(() => setLoading(false));
  }, [orgId]);

  async function handleUpload(file) {
    // Default to the uploaded file's own name (extension stripped) when the
    // user leaves the prompt blank or dismisses it, rather than silently
    // aborting the upload -- most users expect "just use the file name" as
    // the fallback, not to be blocked entirely for skipping a rename step.
    const fileNameFallback = file.name.replace(/\.pdf$/i, "");
    const promptResult = window.prompt("Template name?", fileNameFallback);
    if (promptResult === null) return; // user explicitly cancelled
    const name = promptResult.trim() || fileNameFallback;
    if (!name) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("name", name);
      const res = await fetch(`/api/orgs/${orgId}/templates`, { method: "POST", body });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(created.error || "Could not upload template.");
      setTemplates((prev) => [{ id: created.id, name: created.name, pageCount: created.pageCount }, ...prev]);
      openEditor(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function openEditor(templateId) {
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/templates/${templateId}`);
      if (!res.ok) throw new Error("Could not load template.");
      setEditingTemplate(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveAnchors(anchors) {
    const res = await fetch(`/api/orgs/${orgId}/templates/${editingTemplate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchors: anchors.map((a) => ({ ...a, role: a.label })) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not save anchors.");
      return;
    }
    setEditingTemplate(null);
  }

  async function handleDelete(templateId) {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    const res = await fetch(`/api/orgs/${orgId}/templates/${templateId}`, { method: "DELETE" });
    if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }

  if (editingTemplate) {
    return (
      <div style={{ position: "fixed", top: "var(--site-header-height)", left: 0, right: 0, bottom: 0, background: "var(--bg-page, white)", zIndex: 10 }}>
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 256,
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-panel, white)",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <button type="button" onClick={() => setEditingTemplate(null)} style={{ background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            ← Back
          </button>
          <strong style={{ fontSize: 13 }}>{editingTemplate.name}</strong>
        </div>
        <AnchorEditor
          fileUrl={editingTemplate.pdfUrl}
          pageCount={editingTemplate.pageCount}
          anchors={editingTemplate.anchors.map((a) => ({ ...a, label: a.role }))}
          onSave={handleSaveAnchors}
          onCancel={() => setEditingTemplate(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Templates</h2>
        <label className="marketing-cta-button" style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
          {uploading ? "Uploading…" : "+ Add template"}
          <input
            type="file"
            accept="application/pdf"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
      </div>
      {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : templates.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No templates yet. Add one to get started.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {templates.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 650, fontSize: 13 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{t.pageCount} pages</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => openEditor(t.id)} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                  Edit anchors
                </button>
                <button type="button" onClick={() => handleDelete(t.id)} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: "#ef4444" }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
