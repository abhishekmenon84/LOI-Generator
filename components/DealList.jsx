"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FolderReasonModal from "./FolderReasonModal";

// Real Ledger.documentType values (see components/KanbanCard.jsx's TYPE_META
// and app/api/ledgers/route.js's VALID_DOC_TYPES) -- this list intentionally
// differs from the old Deal-era DOCUMENT_TYPES (which used
// "commercial_lease_loi" and per-type page-builder paths); those old paths
// are moot now anyway since creation navigates to the Folder workspace route.
const DOCUMENT_TYPES = [
  { value: "purchase_loi", label: "Business + Real Estate Purchase LOI", badge: "Purchase LOI" },
  { value: "commercial_lease", label: "Commercial Lease LOI", badge: "Lease LOI" },
  { value: "residential_lease", label: "Residential Lease (New Brunswick)", badge: "Residential Lease" },
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

// NOTE: `/ledgerboard/folder/[folderId]` (the real three-panel workspace
// route) does not exist yet -- Task 3 builds it. Until then, use the same
// placeholder destination Task 2's KanbanDashboard.jsx uses for its "onOpen"
// handler, so both dashboard views agree on one placeholder pending Task 3.
function workspacePlaceholderPath(folderId) {
  return `/dashboard?folder=${folderId}`;
}

export default function DealList({ initialFolders, initialArchived = [], initialTrashed = [], userOrgs = [] }) {
  const router = useRouter();
  const [view, setView] = useState("active");
  const [deals, setDeals] = useState(initialFolders);
  const [archivedDeals, setArchivedDeals] = useState(initialArchived);
  const [trashedDeals, setTrashedDeals] = useState(initialTrashed);
  const [pickingType, setPickingType] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [newDealName, setNewDealName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [nameShake, setNameShake] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // { folderId, action: "archive" | "trash" | "restore", from: "archive" | "trash" | undefined }
  const [reasonModal, setReasonModal] = useState(null);

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
      const folderRes = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(selectedOrgId ? { orgId: selectedOrgId } : {}) }),
      });
      if (!folderRes.ok) {
        const body = await folderRes.json().catch(() => ({}));
        throw new Error(body.error || "Could not create folder.");
      }
      const folder = await folderRes.json();

      const ledgerRes = await fetch("/api/ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folder.id, documentType: selectedType, name }),
      });
      if (!ledgerRes.ok) {
        const body = await ledgerRes.json().catch(() => ({}));
        throw new Error(body.error || "Folder was created, but could not create its ledger.");
      }

      router.push(workspacePlaceholderPath(folder.id));
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  function openReasonModal(folderId, action, from) {
    setReasonModal({ folderId, action, from });
  }

  async function handleReasonConfirm(reason) {
    const modal = reasonModal;
    setReasonModal(null);
    if (!modal) return;
    const { folderId, action, from } = modal;

    if (action === "archive") {
      const deal = deals.find((d) => d.id === folderId);
      if (!deal) return;
      setBusyId(folderId);
      setDeals((cur) => cur.filter((d) => d.id !== folderId));
      setArchivedDeals((cur) => [...cur, { ...deal }]);
      try {
        const res = await fetch(`/api/folders/${folderId}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error("Could not archive deal.");
      } catch (err) {
        setDeals((cur) => [...cur, deal]);
        setArchivedDeals((cur) => cur.filter((d) => d.id !== folderId));
        setError(err.message);
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (action === "trash") {
      const deal = deals.find((d) => d.id === folderId);
      if (!deal) return;
      setBusyId(folderId);
      setDeals((cur) => cur.filter((d) => d.id !== folderId));
      setTrashedDeals((cur) => [...cur, { ...deal }]);
      try {
        const res = await fetch(`/api/folders/${folderId}/trash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error("Could not move deal to trash.");
      } catch (err) {
        setDeals((cur) => [...cur, deal]);
        setTrashedDeals((cur) => cur.filter((d) => d.id !== folderId));
        setError(err.message);
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (action === "restore") {
      const source = from === "trash" ? trashedDeals : archivedDeals;
      const deal = source.find((d) => d.id === folderId);
      if (!deal) return;
      setBusyId(folderId);
      if (from === "trash") setTrashedDeals((cur) => cur.filter((d) => d.id !== folderId));
      else setArchivedDeals((cur) => cur.filter((d) => d.id !== folderId));
      setDeals((cur) => [...cur, { ...deal }]);
      try {
        const res = await fetch(`/api/folders/${folderId}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error("Could not restore deal.");
      } catch (err) {
        setDeals((cur) => cur.filter((d) => d.id !== folderId));
        if (from === "trash") setTrashedDeals((cur) => [...cur, deal]);
        else setArchivedDeals((cur) => [...cur, deal]);
        setError(err.message);
      } finally {
        setBusyId(null);
      }
    }
  }

  const reasonModalFolderName = (() => {
    if (!reasonModal) return "";
    const all = [...deals, ...archivedDeals, ...trashedDeals];
    return all.find((d) => d.id === reasonModal.folderId)?.name || "";
  })();

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
                  {view === "active" ? (
                    <>
                      <a className="marketing-cta-button" href={workspacePlaceholderPath(deal.id)}>Resume</a>
                      {deal.writeAccess && (
                        <>
                          <button
                            type="button"
                            onClick={() => openReasonModal(deal.id, "archive")}
                            disabled={busyId === deal.id}
                            style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            onClick={() => openReasonModal(deal.id, "trash")}
                            disabled={busyId === deal.id}
                            className="deal-list-item-delete"
                          >
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
                          onClick={() => openReasonModal(deal.id, "restore", "archive")}
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
                        <button
                          type="button"
                          onClick={() => openReasonModal(deal.id, "restore", "trash")}
                          disabled={busyId === deal.id}
                          className="marketing-cta-button"
                        >
                          {busyId === deal.id ? "Restoring…" : "Restore"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FolderReasonModal
        action={reasonModal?.action}
        folderName={reasonModalFolderName}
        onConfirm={handleReasonConfirm}
        onCancel={() => setReasonModal(null)}
      />
    </div>
  );
}
