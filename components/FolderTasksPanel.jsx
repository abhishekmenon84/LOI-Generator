"use client";

import { useEffect, useState } from "react";

// Deal-level checklist/deadlines -- dotloop's most emphasized
// transaction-management feature (financing contingency dates, inspection
// deadlines, closing date countdowns), previously entirely absent from
// this app. Deliberately a slide-over panel (mirrors DocumentAuditPanel/
// ShareLedgerModal's pattern) rather than a new permanent panel in the
// folder workspace's existing 3-panel layout, which is already complex --
// this keeps the addition low-risk and additive.
export default function FolderTasksPanel({ folderId, isOpen, onClose }) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  function load() {
    fetch(`/api/folders/${folderId}/tasks`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load tasks."))))
      .then((data) => setTasks(data.tasks || []))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!isOpen || !folderId) return;
    setTasks(null);
    setError(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, folderId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch(`/api/folders/${folderId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), dueDate: dueDate || null }),
    }).catch(() => null);
    setAdding(false);
    if (!res || !res.ok) {
      const body = await res?.json().catch(() => ({})) ?? {};
      setError(body.error || "Could not add task.");
      return;
    }
    setTitle("");
    setDueDate("");
    load();
  }

  async function handleToggle(task) {
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)));
    const res = await fetch(`/api/folders/${folderId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    }).catch(() => null);
    if (!res || !res.ok) load();
  }

  async function handleDelete(taskId) {
    const res = await fetch(`/api/folders/${folderId}/tasks/${taskId}`, { method: "DELETE" }).catch(() => null);
    if (res && res.ok) load();
  }

  if (!isOpen) return null;

  const overdue = (t) => t.dueDate && !t.completed && new Date(t.dueDate) < new Date();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tasks and deadlines"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Tasks &amp; deadlines</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ flexShrink: 0, background: "none", border: "none", fontSize: "1.3rem", lineHeight: 1, color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            type="text"
            required
            placeholder="e.g. Financing contingency"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ flex: "1 1 200px", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
          />
          <button
            type="submit"
            disabled={adding}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, cursor: adding ? "not-allowed" : "pointer" }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>

        {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
        {!tasks && !error && <p>Loading…</p>}
        {tasks && tasks.length === 0 && <p style={{ color: "var(--text-muted)" }}>No tasks yet.</p>}
        {tasks && tasks.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
            <input type="checkbox" checked={t.completed} onChange={() => handleToggle(t)} style={{ width: 18, height: 18 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.9rem", textDecoration: t.completed ? "line-through" : "none", color: t.completed ? "var(--text-muted)" : "var(--text-primary)" }}>
                {t.title}
              </div>
              {t.dueDate && (
                <div style={{ fontSize: "0.75rem", color: overdue(t) ? "oklch(50% 0.17 25)" : "var(--text-muted)" }}>
                  Due {new Date(t.dueDate).toLocaleDateString()}{overdue(t) ? " — overdue" : ""}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(t.id)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
            >
              Remove
            </button>
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
