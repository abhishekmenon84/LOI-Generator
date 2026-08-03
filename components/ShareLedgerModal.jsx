"use client";

import { useEffect, useState } from "react";

// Document-level sharing (LedgerParticipant) -- distinct from the
// folder-level sharing FolderParticipant already provides, which has no
// UI anywhere in the app yet (see app/api/folders/[id]/participants's own
// comment history). This gives someone access to exactly ONE document
// (e.g. a lender who should only see one financing document, not a
// deal's full negotiation history) rather than a whole folder.
export default function ShareLedgerModal({ ledgerId, isOpen, onClose }) {
  const [participants, setParticipants] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("view");
  const [adding, setAdding] = useState(false);

  function load() {
    fetch(`/api/ledgers/${ledgerId}/participants`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load participants."))))
      .then((data) => setParticipants(data.participants || []))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!isOpen || !ledgerId) return;
    setParticipants(null);
    setError(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ledgerId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch(`/api/ledgers/${ledgerId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), permission }),
    }).catch(() => null);
    setAdding(false);
    if (!res || !res.ok) {
      const body = await res?.json().catch(() => ({})) ?? {};
      setError(body.error || "Could not add participant.");
      return;
    }
    setEmail("");
    load();
  }

  async function handleRemove(participantId) {
    const res = await fetch(`/api/ledgers/${ledgerId}/participants/${participantId}`, { method: "DELETE" }).catch(() => null);
    if (res && res.ok) load();
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share this document"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 480, width: "100%", padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Share this document</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: -8, marginBottom: 16 }}>
          Grants access to this one document only, not the rest of the folder.
        </p>

        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            type="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: "1 1 200px", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
          />
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
          >
            <option value="view">View only</option>
            <option value="write">Can edit</option>
          </select>
          <button
            type="submit"
            disabled={adding}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, cursor: adding ? "not-allowed" : "pointer" }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>

        {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
        {!participants && !error && <p>Loading…</p>}
        {participants && participants.length === 0 && <p style={{ color: "var(--text-muted)" }}>Not shared with anyone yet.</p>}
        {participants && participants.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: "0.85rem" }}>
            <div>
              <strong>{p.name || p.email}</strong> — {p.permission === "write" ? "can edit" : "view only"}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(p.id)}
              style={{ background: "none", border: "none", color: "oklch(50% 0.17 25)", cursor: "pointer", fontSize: "0.8rem" }}
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
