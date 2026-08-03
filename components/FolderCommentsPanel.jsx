"use client";

import { useEffect, useRef, useState } from "react";

// In-app deal communication, keeping negotiation/clarification discussion
// auditable in one place instead of scattered across email/text --
// dotloop's other major differentiator alongside tasks (both previously
// entirely absent). Mirrors FolderTasksPanel's slide-over pattern.
export default function FolderCommentsPanel({ folderId, isOpen, onClose }) {
  const [comments, setComments] = useState(null);
  const [error, setError] = useState(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  function load() {
    fetch(`/api/folders/${folderId}/comments`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load comments."))))
      .then((data) => {
        setComments(data.comments || []);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!isOpen || !folderId) return;
    setComments(null);
    setError(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, folderId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/folders/${folderId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    }).catch(() => null);
    setSending(false);
    if (!res || !res.ok) {
      const b = await res?.json().catch(() => ({})) ?? {};
      setError(b.error || "Could not post comment.");
      return;
    }
    setBody("");
    load();
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deal comments"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 520, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", padding: 24 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: "1.05rem" }}>Comments</h2>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto", marginBottom: 12, minHeight: 200 }}>
          {!comments && !error && <p>Loading…</p>}
          {comments && comments.length === 0 && <p style={{ color: "var(--text-muted)" }}>No comments yet. Start the conversation below.</p>}
          {comments && comments.map((c) => (
            <div key={c.id} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: c.isSelf ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "80%",
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: c.isSelf ? "oklch(24% 0.015 264)" : "var(--bg-base)",
                  color: c.isSelf ? "white" : "var(--text-primary)",
                  border: c.isSelf ? "none" : "1px solid var(--border)",
                  fontSize: "0.85rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {c.body}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                {c.isSelf ? "You" : c.author.name || c.author.email} · {new Date(c.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

        <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            rows={2}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", resize: "none", fontFamily: "inherit" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, cursor: sending ? "not-allowed" : "pointer" }}
          >
            {sending ? "…" : "Send"}
          </button>
        </form>

        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", alignSelf: "flex-start" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
