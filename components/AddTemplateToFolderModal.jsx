"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Shared "view + add to folder" modal for built-in document types,
// CustomTemplate rows, and FormTemplate rows on /templates -- all three now
// have a real, working path to a signable Ledger. `kind` is "built-in"
// (documentType is one of VALID_DOC_TYPES directly), "custom_template"
// (documentType is always "custom_template", with the actual
// CustomTemplate.id stashed into Ledger.formData.templateId via a second
// PATCH, matching handlePickTemplate's existing convention in
// app/ledgerboard/folder/[folderId]/page.js), or "form_template"
// (documentType "form_template", with the FormTemplate.id passed as the
// real Ledger.templateId field directly at creation -- see
// app/api/ledgers/route.js). CustomTemplate and FormTemplate both route to
// the same signer-assignment page afterward: GET /api/orgs/[id]/templates/
// [templateId] normalizes either template type to the same response shape
// (lib/templateAdapter.js), so that page works unchanged for both.
export default function AddTemplateToFolderModal({ template, kind, onClose }) {
  const router = useRouter();
  const [folders, setFolders] = useState(null);
  const [foldersError, setFoldersError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    fetch("/api/folders")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load your folders."))))
      .then((data) => setFolders(data.folders || []))
      .catch((err) => setFoldersError(err.message));
  }, []);

  async function handleAdd() {
    if (!selectedFolderId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const documentType = kind === "built-in" ? template.value : kind;
      const name = kind === "built-in" ? template.label : template.name;
      const body = { folderId: selectedFolderId, documentType, name };
      if (kind === "form_template") body.templateId = template.id;

      const res = await fetch("/api/ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(created.error || "Could not create the document.");

      if (kind === "custom_template") {
        const patchRes = await fetch(`/api/ledgers/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formData: { templateId: template.id } }),
        });
        if (!patchRes.ok) throw new Error("Could not set up the template on this document.");
        router.push(`/ledgerboard/custom-template/${created.id}`);
        return;
      }
      if (kind === "form_template") {
        router.push(`/ledgerboard/custom-template/${created.id}`);
        return;
      }

      router.push(`/ledgerboard/folder/${selectedFolderId}`);
    } catch (err) {
      setCreateError(err.message);
      setCreating(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(30,25,20,.32)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: 16, padding: "26px 26px 22px", width: 480, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(30,25,15,.25)" }}
      >
        <div style={{ fontWeight: 750, fontSize: 17, marginBottom: 4 }}>
          {kind === "built-in" ? template.label : template.name}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 16 }}>
          {kind === "built-in" ? "Built-in document" : `${template.pageCount} page${template.pageCount === 1 ? "" : "s"} · ${template.fieldCount} field${template.fieldCount === 1 ? "" : "s"}`}
        </div>

        {kind !== "built-in" && template.pdfUrl && (
          <embed
            src={template.pdfUrl}
            type="application/pdf"
            style={{ width: "100%", height: 360, borderRadius: 8, border: "1px solid var(--border)", marginBottom: 16 }}
          />
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Add to folder</span>
          {foldersError ? (
            <div className="status-banner status-error" role="alert">⚠️ {foldersError}</div>
          ) : !folders ? (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Loading your folders…</span>
          ) : folders.length === 0 ? (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>You don&apos;t have any folders yet. Create one from Documents first.</span>
          ) : (
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
            >
              <option value="" disabled>Choose a folder…</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
        </label>

        {createError && <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>⚠️ {createError}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: "oklch(94% 0.005 60)", color: "oklch(35% 0.01 264)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedFolderId || creating}
            style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: "oklch(24% 0.015 264)", color: "white", fontWeight: 600, fontSize: 13, cursor: !selectedFolderId || creating ? "not-allowed" : "pointer" }}
          >
            {creating ? "Adding…" : "Add to folder"}
          </button>
        </div>
      </div>
    </div>
  );
}
