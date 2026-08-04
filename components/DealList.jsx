"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FolderReasonModal from "./FolderReasonModal";

// Real Ledger.documentType values (see components/KanbanCard.jsx's TYPE_META
// and app/api/ledgers/route.js's VALID_DOC_TYPES) -- kept only for labeling
// existing deals' type pills in the list below. Creation no longer asks for
// a document type up front (see handleCreate) -- that choice now happens
// inside the Folder workspace itself, via its own "+ Add" menu
// (components/FolderTreePanel.jsx), right after the empty folder is created.
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

function workspacePath(folderId) {
  return `/ledgerboard/folder/${folderId}`;
}

// Shows only ACTIVE folders (plus the Favorites filter over them) --
// archived folders and archived individual documents both moved to the
// dedicated /archive page. Trash no longer exists as a concept anywhere
// in the app; a folder is either Active or Archived.
export default function DealList({ initialFolders, userOrgs = [] }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialFolders);
  const [creatingNew, setCreatingNew] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [newDealName, setNewDealName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [nameShake, setNameShake] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // { folderId, action: "archive" }
  const [reasonModal, setReasonModal] = useState(null);

  // "New Ledger" only ever creates a Folder now -- what to put inside it
  // (a built-in document, a custom template, or an uploaded file) is
  // decided afterwards, inside the Folder workspace's own "+ Add" menu
  // (components/FolderTreePanel.jsx), which already offers all three.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("quickCreate") != null) {
      setCreatingNew(true);
      router.replace("/documents", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cancelCreate() {
    setCreatingNew(false);
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
      // The Folder workspace's own empty state / "+ Add" menu asks what
      // document to create (built-in, custom template, or upload) -- no
      // ledger is created here.
      router.push(workspacePath(folder.id));
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  function openReasonModal(folderId, action) {
    setReasonModal({ folderId, action });
  }

  async function handleReasonConfirm(reason) {
    const modal = reasonModal;
    setReasonModal(null);
    if (!modal) return;
    const { folderId } = modal;

    const deal = deals.find((d) => d.id === folderId);
    if (!deal) return;
    setBusyId(folderId);
    setDeals((cur) => cur.filter((d) => d.id !== folderId));
    try {
      const res = await fetch(`/api/folders/${folderId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not archive deal.");
      }
    } catch (err) {
      setDeals((cur) => [...cur, deal]);
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const reasonModalFolderName = (() => {
    if (!reasonModal) return "";
    return deals.find((d) => d.id === reasonModal.folderId)?.name || "";
  })();

  return (
    <div>
      {!creatingNew && (
        <button
          type="button"
          className="marketing-cta-button"
          style={{ marginBottom: 24 }}
          onClick={() => setCreatingNew(true)}
        >
          + New Ledger
        </button>
      )}

      {creatingNew && userOrgs.length > 1 && !selectedOrgId && (
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

      {creatingNew && (userOrgs.length <= 1 || selectedOrgId) && (
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              key={nameShake ? "shaking" : "still"}
              type="text"
              autoFocus
              placeholder="New ledger name, e.g. 123 Main St Acquisition"
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

      {deals.length === 0 ? (
        <p>No ledgers yet — create one above to get started.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {deals.map((deal) => {
            const meta = typeMeta(deal.documentType);
            return (
              <div
                key={deal.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: "white",
                  border: "1px solid oklch(88% 0.008 60)",
                  borderRadius: 16,
                  padding: "18px 20px",
                  flexWrap: "wrap",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 10px 24px rgba(17,17,17,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 650, marginBottom: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {deal.name}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2.5px 9px", borderRadius: 20, border: "1px solid oklch(88% 0.008 60)", color: "oklch(50% 0.012 264)" }}>
                      {meta.badge}
                    </span>
                    {deal.isShared && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2.5px 9px", borderRadius: 20, background: "oklch(93% 0.012 60)", color: "oklch(24% 0.015 264)" }}>
                        {deal.writeAccess ? "Shared (can edit)" : "Shared (view only)"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "oklch(50% 0.012 264)" }}>Edited {relativeTime(deal.updatedAt)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                  <a
                    href={workspacePath(deal.id)}
                    style={{ fontSize: 13, fontWeight: 600, color: "oklch(24% 0.015 264)", textDecoration: "none" }}
                  >
                    Open →
                  </a>
                  {deal.writeAccess && (
                    <button
                      type="button"
                      onClick={() => openReasonModal(deal.id, "archive")}
                      disabled={busyId === deal.id}
                      title="Archive"
                      style={{ border: "none", background: "transparent", color: "oklch(55% 0.015 264)", cursor: "pointer", fontSize: 13, padding: "3px 5px", borderRadius: 6 }}
                    >
                      ▢
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
