"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function relativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function DealList({ initialDeals }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [newDealName, setNewDealName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    const name = newDealName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Could not create deal.");
      const { id } = await res.json();
      router.push(`/app?deal=${id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this deal? This can't be undone.")) return;
    const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeals((prev) => prev.filter((d) => d.id !== id));
    }
  }

  return (
    <div>
      <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="New deal name, e.g. 123 Main St Acquisition"
          value={newDealName}
          onChange={(e) => setNewDealName(e.target.value)}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="marketing-cta-button" disabled={creating}>
          {creating ? "Creating…" : "+ New Deal"}
        </button>
      </form>
      {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}

      {deals.length === 0 ? (
        <p>No deals yet — create one above to get started.</p>
      ) : (
        <ul className="deal-list">
          {deals.map((deal) => (
            <li key={deal.id} className="deal-list-item">
              <div>
                <div className="deal-list-item-name">{deal.name}</div>
                <div className="deal-list-item-meta">Edited {relativeTime(deal.updatedAt)}</div>
              </div>
              <div className="deal-list-item-actions">
                <a className="marketing-cta-button" href={`/app?deal=${deal.id}`}>Resume</a>
                <button type="button" onClick={() => handleDelete(deal.id)} className="deal-list-item-delete">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
