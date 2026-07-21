"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DOCUMENT_TYPES = [
  { value: "purchase_loi", label: "Business + Real Estate Purchase LOI", badge: "Purchase LOI", buildPath: "/app" },
  { value: "commercial_lease_loi", label: "Commercial Lease LOI", badge: "Lease LOI", buildPath: "/app/lease" },
  { value: "residential_lease", label: "Residential Lease (New Brunswick)", badge: "Residential Lease", buildPath: "/app/residential-lease" },
];

function typeMeta(documentType) {
  return DOCUMENT_TYPES.find((t) => t.value === documentType) || DOCUMENT_TYPES[0];
}

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
  const [pickingType, setPickingType] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [newDealName, setNewDealName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function startCreate(documentType) {
    setSelectedType(documentType);
    setPickingType(false);
  }

  function cancelCreate() {
    setSelectedType(null);
    setNewDealName("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newDealName.trim();
    if (!name || !selectedType) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, documentType: selectedType }),
      });
      if (!res.ok) throw new Error("Could not create deal.");
      const { id } = await res.json();
      router.push(`${typeMeta(selectedType).buildPath}?deal=${id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeals((prev) => prev.filter((d) => d.id !== id));
      } else {
        setError("Could not delete deal.");
      }
    } finally {
      setDeleting(false);
      setConfirmingDeleteId(null);
    }
  }

  return (
    <div>
      {!pickingType && !selectedType && (
        <button
          type="button"
          className="marketing-cta-button"
          style={{ marginBottom: 24 }}
          onClick={() => setPickingType(true)}
        >
          + New Deal
        </button>
      )}

      {pickingType && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>What kind of document?</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DOCUMENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className="marketing-cta-button"
                onClick={() => startCreate(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPickingType(false)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", alignSelf: "flex-start" }}
          >
            Cancel
          </button>
        </div>
      )}

      {selectedType && (
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input
            type="text"
            autoFocus
            placeholder={`New ${typeMeta(selectedType).badge} name, e.g. 123 Main St Acquisition`}
            value={newDealName}
            onChange={(e) => setNewDealName(e.target.value)}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
          />
          <button type="submit" className="marketing-cta-button" disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={cancelCreate}
            style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}
          >
            Cancel
          </button>
        </form>
      )}

      {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}

      {deals.length === 0 ? (
        <p>No deals yet — create one above to get started.</p>
      ) : (
        <ul className="deal-list">
          {deals.map((deal) => {
            const meta = typeMeta(deal.documentType);
            return (
              <li key={deal.id} className="deal-list-item">
                <div>
                  <div className="deal-list-item-name">
                    {deal.name}
                    <span className="deal-list-item-type-badge">{meta.badge}</span>
                  </div>
                  <div className="deal-list-item-meta">Edited {relativeTime(deal.updatedAt)}</div>
                </div>
                <div className="deal-list-item-actions">
                  {confirmingDeleteId === deal.id ? (
                    <>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Delete this deal?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(deal.id)}
                        disabled={deleting}
                        className="deal-list-item-delete"
                      >
                        {deleting ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={deleting}
                        style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <a className="marketing-cta-button" href={`${meta.buildPath}?deal=${deal.id}`}>Resume</a>
                      <button type="button" onClick={() => setConfirmingDeleteId(deal.id)} className="deal-list-item-delete">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
