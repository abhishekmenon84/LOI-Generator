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

export default function DealList({ initialFolders, initialArchived = [], initialTrashed = [], userOrgs = [] }) {
  const router = useRouter();
  const [view, setView] = useState("active");
  const [deals, setDeals] = useState(initialFolders);
  const [archivedDeals, setArchivedDeals] = useState(initialArchived);
  const [trashedDeals, setTrashedDeals] = useState(initialTrashed);
  const [creatingNew, setCreatingNew] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [newDealName, setNewDealName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [nameShake, setNameShake] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // { folderId, action: "archive" | "trash" | "restore", from: "archive" | "trash" | undefined }
  const [reasonModal, setReasonModal] = useState(null);

// "favorites" is a filter over the active list, not a 4th lifecycle bucket
  // like archive/trash -- a favorited folder still shows up under "active"
  // too, it's just also reachable pre-filtered from the sidebar.
  const visibleDeals =
    view === "active" ? deals :
    view === "favorites" ? deals.filter((d) => d.favorite) :
    view === "archive" ? archivedDeals :
    trashedDeals;

  // "New Ledger" only ever creates a Folder now -- what to put inside it
  // (a built-in document, a custom template, or an uploaded file) is
  // decided afterwards, inside the Folder workspace's own "+ Add" menu
  // (components/FolderTreePanel.jsx), which already offers all three.
  // The Sidebar's Favorites/Archive links land here as /dashboard?view=...
  // to pre-select a tab, same convention as quickCreate below.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let handled = false;
    if (params.get("quickCreate") != null) {
      setCreatingNew(true);
      handled = true;
    }
    const requestedView = params.get("view");
    if (requestedView === "favorites" || requestedView === "archive" || requestedView === "trash") {
      setView(requestedView);
      handled = true;
    }
    if (handled) router.replace("/documents", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cancelCreate() {
    setCreatingNew(false);
    setSelectedOrgId(null);
    setNewDealName("");
  }

  async function toggleFavorite(folderId) {
    const folder = [...deals, ...archivedDeals, ...trashedDeals].find((d) => d.id === folderId);
    if (!folder) return;
    const next = !folder.favorite;
    const updateList = (setter) => setter((cur) => cur.map((d) => (d.id === folderId ? { ...d, favorite: next } : d)));
    updateList(setDeals);
    updateList(setArchivedDeals);
    updateList(setTrashedDeals);
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: next }),
      });
      if (!res.ok) throw new Error("Could not update favorite.");
    } catch (err) {
      const revert = (setter) => setter((cur) => cur.map((d) => (d.id === folderId ? { ...d, favorite: !next } : d)));
      revert(setDeals);
      revert(setArchivedDeals);
      revert(setTrashedDeals);
      setError(err.message);
    }
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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not archive deal.");
        }
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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not move deal to trash.");
        }
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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not restore deal.");
        }
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["active", "favorites", "archive", "trash"].map((v) => (
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
            ? "No ledgers yet — create one above to get started."
            : view === "favorites"
            ? "No favorites yet — star a ledger to pin it here."
            : view === "archive"
            ? "No archived deals."
            : "Trash is empty."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleDeals.map((deal) => {
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
                {(view === "active" || view === "favorites") && (
                  <button
                    type="button"
                    onClick={() => toggleFavorite(deal.id)}
                    style={{ border: "none", background: "transparent", fontSize: 15, color: deal.favorite ? "oklch(72% 0.15 75)" : "oklch(80% 0.01 264)", cursor: "pointer", flex: "0 0 auto" }}
                  >
                    ★
                  </button>
                )}
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
                  {view === "active" || view === "favorites" ? (
                    <>
                      <a
                        href={workspacePath(deal.id)}
                        style={{ fontSize: 13, fontWeight: 600, color: "oklch(24% 0.015 264)", textDecoration: "none" }}
                      >
                        Open →
                      </a>
                      {deal.writeAccess && (
                        <>
                          <button
                            type="button"
                            onClick={() => openReasonModal(deal.id, "archive")}
                            disabled={busyId === deal.id}
                            title="Archive"
                            style={{ border: "none", background: "transparent", color: "oklch(55% 0.015 264)", cursor: "pointer", fontSize: 13, padding: "3px 5px", borderRadius: 6 }}
                          >
                            ▢
                          </button>
                          <button
                            type="button"
                            onClick={() => openReasonModal(deal.id, "trash")}
                            disabled={busyId === deal.id}
                            title="Delete"
                            style={{ border: "none", background: "transparent", color: "oklch(55% 0.015 264)", cursor: "pointer", fontSize: 13, padding: "3px 5px", borderRadius: 6 }}
                          >
                            ✕
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
                          style={{ border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, fontSize: 12.5, padding: "7px 14px", borderRadius: 9, cursor: "pointer" }}
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
                          style={{ border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, fontSize: 12.5, padding: "7px 14px", borderRadius: 9, cursor: "pointer" }}
                        >
                          {busyId === deal.id ? "Restoring…" : "Restore"}
                        </button>
                      )}
                    </>
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
