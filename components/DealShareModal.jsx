"use client";

import { useEffect, useState } from "react";

export default function DealShareModal({ dealId, isOpen, onClose }) {
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("read");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !dealId) return;
    fetch(`/api/deals/${dealId}/shares`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load shares."))))
      .then((body) => setShares(body.shares))
      .catch((err) => setError(err.message));
  }, [isOpen, dealId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permission }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not share deal.");
      setShares((prev) => [{ id: body.id, email: email.trim(), permission: body.permission }, ...prev]);
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(shareId) {
    const res = await fetch(`/api/deals/${dealId}/shares/${shareId}`, { method: "DELETE" });
    if (res.ok) setShares((prev) => prev.filter((s) => s.id !== shareId));
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share this document"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 420, width: "100%", padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Share this document</h2>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="email"
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
          />
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
          >
            <option value="read">Can view</option>
            <option value="write">Can edit</option>
          </select>
          <button type="submit" className="marketing-cta-button" disabled={loading} style={{ padding: "8px 14px" }}>
            Add
          </button>
        </form>
        {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {shares.map((s) => (
            <li key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.85rem" }}>
                {s.email} <span style={{ color: "var(--text-muted)" }}>({s.permission === "write" ? "can edit" : "view only"})</span>
              </span>
              <button type="button" onClick={() => handleRemove(s.id)} className="deal-list-item-delete">
                Remove
              </button>
            </li>
          ))}
        </ul>
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
