"use client";

import { useState } from "react";
import Link from "next/link";
import FolderReasonModal from "./FolderReasonModal";

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

export default function ArchivePageClient({ initialFolders, initialDocuments }) {
  const [folders, setFolders] = useState(initialFolders);
  const [documents, setDocuments] = useState(initialDocuments);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // { folderId, action: "restore" | "permanent" }
  const [reasonModal, setReasonModal] = useState(null);

  function openReasonModal(folderId, action) {
    setReasonModal({ folderId, action });
  }

  async function handleReasonConfirm(reason) {
    const modal = reasonModal;
    setReasonModal(null);
    if (!modal) return;
    const { folderId, action } = modal;
    setBusyId(folderId);
    setError(null);

    if (action === "restore") {
      const folder = folders.find((f) => f.id === folderId);
      setFolders((cur) => cur.filter((f) => f.id !== folderId));
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
        if (folder) setFolders((cur) => [...cur, folder]);
        setError(err.message);
      } finally {
        setBusyId(null);
      }
      return;
    }

    if (action === "permanent") {
      const folder = folders.find((f) => f.id === folderId);
      try {
        const res = await fetch(`/api/folders/${folderId}/permanent`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not permanently delete this folder.");
        }
        setFolders((cur) => cur.filter((f) => f.id !== folderId));
      } catch (err) {
        setError(err.message);
      } finally {
        setBusyId(null);
      }
    }
  }

  async function handleRestoreDocument(doc) {
    setBusyId(doc.id);
    setError(null);
    const prev = documents;
    setDocuments((cur) => cur.filter((d) => d.id !== doc.id));
    try {
      const url = doc.kind === "ledger" ? `/api/ledgers/${doc.id}` : `/api/folders/files/${doc.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      if (!res.ok) throw new Error("Could not restore this document.");
    } catch (err) {
      setDocuments(prev);
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const reasonModalFolderName = (() => {
    if (!reasonModal) return "";
    return folders.find((f) => f.id === reasonModal.folderId)?.name || "";
  })();

  const documentsByFolder = new Map();
  for (const doc of documents) {
    const list = documentsByFolder.get(doc.folderId) || [];
    list.push(doc);
    documentsByFolder.set(doc.folderId, list);
  }

  return (
    <div>
      {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Archived Folders</h2>
      {folders.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>No archived folders.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {folders.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                flexWrap: "wrap",
                opacity: 0.75,
              }}
            >
              <div>
                <div style={{ fontWeight: 650 }}>{f.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Archived {relativeTime(f.archivedAt)}</div>
              </div>
              {f.writeAccess && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => openReasonModal(f.id, "restore")}
                    disabled={busyId === f.id}
                    style={{ border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, fontSize: 12.5, padding: "7px 14px", borderRadius: 9, cursor: "pointer" }}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => openReasonModal(f.id, "permanent")}
                    disabled={busyId === f.id}
                    style={{ border: "1px solid oklch(70% 0.15 25)", background: "white", color: "oklch(50% 0.17 25)", fontWeight: 600, fontSize: 12.5, padding: "7px 14px", borderRadius: 9, cursor: "pointer" }}
                  >
                    Delete permanently
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Archived Documents</h2>
      {documents.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No archived documents.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[...documentsByFolder.entries()].map(([folderId, docs]) => (
            <div key={folderId}>
              <Link
                href={`/ledgerboard/folder/${folderId}`}
                style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)", textDecoration: "none", marginBottom: 8, display: "block" }}
              >
                {docs[0].folderName}
              </Link>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      flexWrap: "wrap",
                      opacity: 0.75,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {doc.kind === "ledger" ? "📝" : "📎"} {doc.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Archived {relativeTime(doc.archivedAt)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreDocument(doc)}
                      disabled={busyId === doc.id}
                      style={{ border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}
                    >
                      {busyId === doc.id ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
