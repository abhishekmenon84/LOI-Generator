"use client";

import { useEffect, useState } from "react";

const TYPE_ICONS = {
  folder_event: "📁",
  comment: "💬",
  task_created: "✓",
  task_completed: "✅",
  signature_sent: "📝",
  signature_voided: "⛔",
  signed: "✒️",
  declined: "⚠️",
  fully_signed: "🎉",
};

// A single merged, chronological timeline over every kind of deal-level
// event this app tracks -- previously each lived in its own disconnected
// place (audit panel, signature audit, comments panel, tasks panel). The
// dotloop "Loop Activity" equivalent. Purely a read-only view over
// GET /api/folders/[id]/activity, which does the actual merging/sorting.
export default function FolderActivityPanel({ folderId, isOpen, onClose }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !folderId) return;
    setItems(null);
    setError(null);
    fetch(`/api/folders/${folderId}/activity`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load activity."))))
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message));
  }, [isOpen, folderId]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deal activity"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Activity</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ flexShrink: 0, background: "none", border: "none", fontSize: "1.3rem", lineHeight: 1, color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}
          >
            ×
          </button>
        </div>

        {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}
        {!items && !error && <p>Loading…</p>}
        {items && items.length === 0 && <p style={{ color: "var(--text-muted)" }}>No activity yet.</p>}
        {items && items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
            <span style={{ fontSize: "1rem", flex: "0 0 auto" }}>{TYPE_ICONS[item.type] || "•"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.85rem" }}>{item.text}</div>
              {item.detail && (
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{item.detail}</div>
              )}
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                {new Date(item.at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 16, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
