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
    const name = (window.prompt("Template name?") || "").trim();
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
      <div>
        <button type="button" onClick={() => setEditingTemplate(null)} style={{ marginBottom: 16, background: "none", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>
          ← Back to templates
        </button>
        <h3 style={{ marginBottom: 12 }}>{editingTemplate.name}</h3>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ background: "var(--bg-panel)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 10 }}>{t.pageCount} pages</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => openEditor(t.id)} style={{ flex: 1, padding: 6, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                  Edit anchors
                </button>
                <button type="button" onClick={() => handleDelete(t.id)} style={{ flex: 1, padding: 6, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: "#ef4444" }}>
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
