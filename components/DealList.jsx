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

export default function DealList({ initialDeals, initialArchived = [], initialTrashed = [], userOrgs = [] }) {
  const router = useRouter();
  const [view, setView] = useState("active");
  const [deals, setDeals] = useState(initialDeals);
  const [archivedDeals, setArchivedDeals] = useState(initialArchived);
  const [trashedDeals, setTrashedDeals] = useState(initialTrashed);
  const [pickingType, setPickingType] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [newDealName, setNewDealName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [nameShake, setNameShake] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const visibleDeals = view === "active" ? deals : view === "archive" ? archivedDeals : trashedDeals;

  function startCreate(documentType) {
    setSelectedType(documentType);
    setPickingType(false);
  }

  function cancelCreate() {
    setSelectedType(null);
    setSelectedOrgId(null);
    setNewDealName("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newDealName.trim();
    if (!name) {
      setNameShake(true);
      return;
    }
    if (!selectedType) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, documentType: selectedType, ...(selectedOrgId ? { orgId: selectedOrgId } : {}) }),
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
        const deal = deals.find((d) => d.id === id);
        setDeals((prev) => prev.filter((d) => d.id !== id));
        if (deal) setTrashedDeals((cur) => [...cur, { ...deal }]);
      } else {
        setError("Could not delete deal.");
      }
    } finally {
      setDeleting(false);
      setConfirmingDeleteId(null);
    }
  }

  async function handleArchive(id) {
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    setBusyId(id);
    setDeals((cur) => cur.filter((d) => d.id !== id));
    setArchivedDeals((cur) => [...cur, { ...deal }]);
    try {
      const res = await fetch(`/api/deals/${id}/archive`, { method: "POST" });
      if (!res.ok) throw new Error("Could not archive deal.");
    } catch (err) {
      setDeals((cur) => [...cur, deal]);
      setArchivedDeals((cur) => cur.filter((d) => d.id !== id));
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore(id) {
    const fromView = view;
    const source = fromView === "trash" ? trashedDeals : archivedDeals;
    const deal = source.find((d) => d.id === id);
    if (!deal) return;
    setBusyId(id);
    if (fromView === "trash") setTrashedDeals((cur) => cur.filter((d) => d.id !== id));
    else setArchivedDeals((cur) => cur.filter((d) => d.id !== id));
    setDeals((cur) => [...cur, { ...deal }]);
    try {
      const res = await fetch(`/api/deals/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Could not restore deal.");
    } catch (err) {
      setDeals((cur) => cur.filter((d) => d.id !== id));
      if (fromView === "trash") setTrashedDeals((cur) => [...cur, deal]);
      else setArchivedDeals((cur) => [...cur, deal]);
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handlePermanentDelete(id) {
    if (!window.confirm("Permanently delete this deal? This cannot be undone.")) return;
    setBusyId(id);
    setTrashedDeals((cur) => cur.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/deals/${id}/permanent`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not permanently delete deal.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
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

      {selectedType && userOrgs.length > 1 && !selectedOrgId && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Which organization?</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {userOrgs.map((o) => (
              <button key={o.orgId} type="button" className="marketing-cta-button" onClick={() => setSelectedOrgId(o.orgId)}>
                {o.isPersonal ? "Personal" : o.orgName}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={cancelCreate}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem", alignSelf: "flex-start" }}
          >
            Cancel
          </button>
        </div>
      )}

      {selectedType && (userOrgs.length <= 1 || selectedOrgId) && (
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              key={nameShake ? "shaking" : "still"}
              type="text"
              autoFocus
              placeholder={`New ${typeMeta(selectedType).badge} name, e.g. 123 Main St Acquisition`}
              value={newDealName}
              onChange={(e) => {
                setNewDealName(e.target.value);
                if (nameShake) setNameShake(false);
              }}
              onAnimationEnd={() => setNameShake(false)}
              className={nameShake ? "input-shake" : ""}
              aria-invalid={nameShake}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: nameShake ? "2px solid #ef4444" : "1px solid var(--border)",
                background: "var(--bg-panel)",
                color: "var(--text-primary)",
              }}
            />
            {nameShake && (
              <span style={{ fontSize: "0.78rem", color: "#ef4444" }} role="alert">
                Please enter a name before creating.
              </span>
            )}
          </div>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["active", "archive", "trash"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: view === v ? "var(--accent-subtle)" : "transparent",
              color: view === v ? "var(--accent-light)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {visibleDeals.length === 0 ? (
        <p>
          {view === "active"
            ? "No deals yet — create one above to get started."
            : view === "archive"
            ? "No archived deals."
            : "Trash is empty."}
        </p>
      ) : (
        <ul className="deal-list">
          {visibleDeals.map((deal) => {
            const meta = typeMeta(deal.documentType);
            return (
              <li key={deal.id} className="deal-list-item">
                <div>
                  <div className="deal-list-item-name">
                    {deal.name}
                    <span className="deal-list-item-type-badge">{meta.badge}</span>
                    {deal.isShared && (
                      <span
                        className="deal-list-item-type-badge"
                        style={{ background: "var(--accent-subtle)", color: "var(--accent-light)", marginLeft: 6 }}
                      >
                        {deal.writeAccess ? "Shared (can edit)" : "Shared (view only)"}
                      </span>
                    )}
                  </div>
                  <div className="deal-list-item-meta">Edited {relativeTime(deal.updatedAt)}</div>
                </div>
                <div className="deal-list-item-actions">
                  {view === "active" && confirmingDeleteId === deal.id ? (
                    <>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Move to trash?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(deal.id)}
                        disabled={deleting}
                        className="deal-list-item-delete"
                      >
                        {deleting ? "Moving…" : "Confirm"}
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
                  ) : view === "active" ? (
                    <>
                      <a className="marketing-cta-button" href={`${meta.buildPath}?deal=${deal.id}`}>Resume</a>
                      {deal.writeAccess && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleArchive(deal.id)}
                            disabled={busyId === deal.id}
                            style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}
                          >
                            Archive
                          </button>
                          <button type="button" onClick={() => setConfirmingDeleteId(deal.id)} className="deal-list-item-delete">
                            Delete
                          </button>
                        </>
                      )}
                    </>
                  ) : view === "archive" ? (
                    <>
                      {deal.writeAccess && (
                        <button
                          type="button"
                          onClick={() => handleRestore(deal.id)}
                          disabled={busyId === deal.id}
                          className="marketing-cta-button"
                        >
                          {busyId === deal.id ? "Restoring…" : "Restore"}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {deal.writeAccess && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRestore(deal.id)}
                            disabled={busyId === deal.id}
                            className="marketing-cta-button"
                          >
                            {busyId === deal.id ? "Restoring…" : "Restore"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePermanentDelete(deal.id)}
                            disabled={busyId === deal.id}
                            className="deal-list-item-delete"
                          >
                            Delete Forever
                          </button>
                        </>
                      )}
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
