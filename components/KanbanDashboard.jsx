"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import KanbanColumn from "./KanbanColumn";
import FolderReasonModal from "./FolderReasonModal";

const STAGES = [
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "closed", label: "Closed" },
];

export default function KanbanDashboard({ initialFolders, initialArchivedFolders = [], initialTrashedFolders = [], userOrgs = [] }) {
  const router = useRouter();
  const [folders, setFolders] = useState(initialFolders);
  const [archivedFolders, setArchivedFolders] = useState(initialArchivedFolders);
  const [trashedFolders, setTrashedFolders] = useState(initialTrashedFolders);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [parentFolderIdForCreate, setParentFolderIdForCreate] = useState(null);

  // { folderId, action: "archive" | "trash" | "restore", from: "archive" | "trash" | undefined }
  const [reasonModal, setReasonModal] = useState(null);

  // TopBar's "+" button and the dashboard's own quick-create shortcuts
  // navigate here with ?quickCreate=1 rather than duplicating this
  // component's own folder-creation logic -- mirrors DealList.jsx's
  // identical convention for the personal-tier dashboard.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("quickCreate") != null) {
      setCreating(true);
      router.replace("/documents", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStage(folderId, newStage) {
    const prev = folders;
    setFolders((cur) => cur.map((f) => (f.id === folderId ? { ...f, stage: newStage } : f)));
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Could not update stage.");
    } catch (err) {
      setFolders(prev);
      setError(err.message);
    }
  }

  function handleDragStart(e, folderId) {
    e.dataTransfer.setData("text/plain", folderId);
  }

  function handleDrop(e, stage) {
    e.preventDefault();
    const folderId = e.dataTransfer.getData("text/plain");
    if (!folderId) return;
    const folder = folders.find((f) => f.id === folderId);
    if (!folder || !folder.writeAccess || folder.stage === stage) return;
    updateStage(folderId, stage);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    setCreateBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(selectedOrgId ? { orgId: selectedOrgId } : {}),
          ...(parentFolderIdForCreate ? { parentFolderId: parentFolderIdForCreate } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not create folder.");
      }
      const created = await res.json();
      setFolders((cur) => [
        ...cur,
        {
          id: created.id,
          name: created.name,
          stage: created.stage || "draft",
          priority: null,
          updatedAt: new Date().toISOString(),
          isShared: false,
          writeAccess: true,
          parentFolderId: created.parentFolderId || null,
          orgId: selectedOrgId,
          participantNames: [],
          documentType: null,
        },
      ]);
      setCreating(false);
      setSelectedOrgId(null);
      setNewFolderName("");
      setParentFolderIdForCreate(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleUnnestChild(childId) {
    const prevFolders = folders;
    setFolders((cur) => cur.map((f) => (f.id === childId ? { ...f, parentFolderId: null, priority: null } : f)));
    try {
      const res = await fetch(`/api/folders/${childId}/unnest`, { method: "POST" });
      if (!res.ok) throw new Error("Could not pop out folder.");
    } catch (err) {
      setFolders(prevFolders);
      setError(err.message);
    }
  }

  async function handleSetChildPriority(childId, priority) {
    const prevFolders = folders;
    setFolders((cur) => cur.map((f) => (f.id === childId ? { ...f, priority } : f)));
    try {
      const res = await fetch(`/api/folders/${childId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error("Could not set priority.");
    } catch (err) {
      setFolders(prevFolders);
      setError(err.message);
    }
  }

  function handleCyclePriority(childId, currentPriority) {
    const order = ["green", "yellow", "grey"];
    const idx = order.indexOf(currentPriority);
    const next = order[(idx + 1) % order.length];
    handleSetChildPriority(childId, next);
  }

  async function handleNest(childId, parentId) {
    if (childId === parentId) return;
    const prevFolders = folders;
    setFolders((cur) => cur.map((f) => (f.id === childId ? { ...f, parentFolderId: parentId } : f)));
    try {
      const res = await fetch(`/api/folders/${parentId}/nest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childFolderId: childId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not nest folder.");
      }
    } catch (err) {
      setFolders(prevFolders);
      setError(err.message);
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
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return;
      setFolders((cur) => cur.filter((f) => f.id !== folderId));
      setArchivedFolders((cur) => [...cur, { ...folder }]);
      try {
        const res = await fetch(`/api/folders/${folderId}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not archive folder.");
        }
      } catch (err) {
        setFolders((cur) => [...cur, folder]);
        setArchivedFolders((cur) => cur.filter((f) => f.id !== folderId));
        setError(err.message);
      }
      return;
    }

    if (action === "trash") {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return;
      setFolders((cur) => cur.filter((f) => f.id !== folderId));
      setTrashedFolders((cur) => [...cur, { ...folder }]);
      try {
        const res = await fetch(`/api/folders/${folderId}/trash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not move folder to trash.");
        }
      } catch (err) {
        setFolders((cur) => [...cur, folder]);
        setTrashedFolders((cur) => cur.filter((f) => f.id !== folderId));
        setError(err.message);
      }
      return;
    }

    if (action === "restore") {
      const source = from === "trash" ? trashedFolders : archivedFolders;
      const folder = source.find((f) => f.id === folderId);
      if (!folder) return;
      if (from === "trash") setTrashedFolders((cur) => cur.filter((f) => f.id !== folderId));
      else setArchivedFolders((cur) => cur.filter((f) => f.id !== folderId));
      setFolders((cur) => [...cur, { ...folder, stage: folder.stage || "draft" }]);
      try {
        const res = await fetch(`/api/folders/${folderId}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not restore folder.");
        }
      } catch (err) {
        setFolders((cur) => cur.filter((f) => f.id !== folderId));
        if (from === "trash") setTrashedFolders((cur) => [...cur, folder]);
        else setArchivedFolders((cur) => [...cur, folder]);
        setError(err.message);
      }
    }
  }

  const reasonModalFolderName = useMemo(() => {
    if (!reasonModal) return "";
    const all = [...folders, ...archivedFolders, ...trashedFolders];
    return all.find((f) => f.id === reasonModal.folderId)?.name || "";
  }, [reasonModal, folders, archivedFolders, trashedFolders]);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Search failed.");
          return res.json();
        })
        .then((data) => setSearchResults(data.results || []))
        .catch((err) => setSearchError(err.message))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const childrenByParent = useMemo(() => {
    const map = new Map();
    for (const f of folders) {
      if (f.parentFolderId) {
        if (!map.has(f.parentFolderId)) map.set(f.parentFolderId, []);
        map.get(f.parentFolderId).push(f);
      }
    }
    return map;
  }, [folders]);

  return (
    <div>
      <div className="kanban-toolbar">
        <input
          type="text"
          placeholder="Search folders or people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="kanban-search-input"
          aria-label="Search folders or people"
        />
        <button
          type="button"
          className="marketing-cta-button"
          onClick={() => setCreating(true)}
          style={{ marginLeft: "auto" }}
        >
          + New Folder
        </button>
      </div>

      {creating && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-panel)" }}>
          {userOrgs.length > 1 && !selectedOrgId && !parentFolderIdForCreate ? (
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 10 }}>Which organization?</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {userOrgs.map((o) => (
                  <button key={o.orgId} type="button" className="marketing-cta-button" onClick={() => setSelectedOrgId(o.orgId)}>
                    {o.isPersonal ? "Personal" : o.orgName}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setParentFolderIdForCreate(null);
                  }}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                autoFocus
                placeholder="Folder name, e.g. 123 Main St Acquisition"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="kanban-search-input"
                style={{ width: 280 }}
              />
              <button type="submit" className="marketing-cta-button" disabled={createBusy || !newFolderName.trim()}>
                {createBusy ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setSelectedOrgId(null);
                  setNewFolderName("");
                  setParentFolderIdForCreate(null);
                }}
                style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 14px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}

      {error && (
        <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {searchResults !== null ? (
        <div style={{ padding: "8px 4px" }}>
          {searchLoading && <p style={{ color: "var(--text-secondary)" }}>Searching…</p>}
          {searchError && (
            <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>
              ⚠️ {searchError}
            </div>
          )}
          {!searchLoading && !searchError && searchResults.length === 0 && (
            <p style={{ color: "var(--text-secondary)" }}>No folders or ledgers match "{search.trim()}".</p>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {searchResults.map((r) => (
                <div
                  key={`${r.type}-${r.id}`}
                  onClick={() => router.push(`/ledgerboard/folder/${r.folderId}`)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-panel)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {r.type === "ledger" ? "📝 " : "📁 "}
                      {r.name}
                      {r.archived && (
                        <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}> (Archived)</span>
                      )}
                    </div>
                    {r.type === "ledger" && (
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>in {r.folderName}</div>
                    )}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{r.orgName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="kanban-board">
          {STAGES.map((s) => (
            <KanbanColumn
              key={s.key}
              stage={s.key}
              label={s.label}
              folders={folders.filter((f) => f.stage === s.key && !f.parentFolderId)}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onArchive={(id) => openReasonModal(id, "archive")}
              onTrash={(id) => openReasonModal(id, "trash")}
              childrenByParent={childrenByParent}
              onUnnestChild={handleUnnestChild}
              onCyclePriority={handleCyclePriority}
              onNest={handleNest}
              onOpen={(id) => router.push(`/ledgerboard/folder/${id}`)}
            />
          ))}

          <div className="kanban-board-divider" aria-hidden="true" />

          <KanbanColumn
            stage="archive"
            label="Archive"
            folders={archivedFolders}
            onDragStart={handleDragStart}
            onDrop={() => {}}
            side
            onRestore={(id) => openReasonModal(id, "restore", "archive")}
          />
          <KanbanColumn
            stage="trash"
            label="Trash"
            folders={trashedFolders}
            onDragStart={handleDragStart}
            onDrop={() => {}}
            side
            onRestore={(id) => openReasonModal(id, "restore", "trash")}
          />
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
