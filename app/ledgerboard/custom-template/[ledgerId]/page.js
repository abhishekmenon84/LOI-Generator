"use client";

// Signer-role-assignment screen for a Ledger created from a CustomTemplate
// (Phase 7b Task 4). Reached from the Folder workspace's "New Ledger from
// template" flow (app/ledgerboard/folder/[folderId]/page.js), since a
// custom_template Ledger has no dynamic-form editor in that page's
// DOC_TYPE_CONFIG -- it needs this dedicated screen instead.
//
// orgId resolution chain: the Ledger's own `formData` doesn't carry orgId
// directly, so it's resolved the same way the folder workspace page does it:
// GET /api/ledgers/[ledgerId] -> folderId -> GET /api/folders/[folderId] ->
// orgId -> GET /api/orgs/[orgId]/templates/[templateId].
//
// "Send for signature" is a visible button that shows "Coming soon" when
// clicked, matching FolderFileViewer's / the folder workspace page's own
// handleExport precedent for an out-of-scope feature (an honest disclosed
// limitation rather than silent partial wiring or a hidden button). Real
// e-signature integration (percentage-anchor -> PDF point-coordinate
// conversion into the SignatureRequest/SignerSlot system) is explicitly out
// of scope for this task.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CustomTemplateSignerAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const ledgerId = params.ledgerId;

  const [ledger, setLedger] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  // One {role, name, email} row per distinct TemplateAnchor.role, keyed by
  // role string in this component's state.
  const [assignments, setAssignments] = useState({}); // { [role]: {name, email} }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sendMessage, setSendMessage] = useState(null);

  useEffect(() => {
    if (!ledgerId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    async function load() {
      // 1. Ledger -> formData.templateId + folderId
      const ledgerRes = await fetch(`/api/ledgers/${ledgerId}`).catch(() => null);
      if (!ledgerRes || !ledgerRes.ok) throw new Error("Ledger not found.");
      const ledgerData = await ledgerRes.json();
      if (cancelled) return;
      setLedger(ledgerData);

      const templateId = ledgerData.formData?.templateId;
      if (!templateId) throw new Error("This Ledger has no associated template.");

      // 2. Ledger.folderId -> Folder -> orgId
      const folderRes = await fetch(`/api/folders/${ledgerData.folderId}`).catch(() => null);
      if (!folderRes || !folderRes.ok) throw new Error("Folder not found.");
      const folderData = await folderRes.json();
      if (cancelled) return;
      const orgId = folderData.orgId;
      if (!orgId) throw new Error("Could not resolve this Ledger's organization.");

      // 3. orgId + templateId -> template detail (pdfUrl, anchors)
      const templateRes = await fetch(`/api/orgs/${orgId}/templates/${templateId}`).catch(() => null);
      if (!templateRes || !templateRes.ok) throw new Error("Template not found.");
      const templateData = await templateRes.json();
      if (cancelled) return;
      setTemplate(templateData);

      // Seed assignments: one row per DISTINCT role, deduplicated. Multiple
      // TemplateAnchors sharing the same role (e.g. 3 anchors all
      // role: "Buyer") collapse to exactly one row, not one per anchor.
      const distinctRoles = [];
      const seen = new Set();
      for (const anchor of templateData.anchors || []) {
        if (!seen.has(anchor.role)) {
          seen.add(anchor.role);
          distinctRoles.push(anchor.role);
        }
      }
      const existing = Array.isArray(ledgerData.formData?.signerRoleAssignments)
        ? ledgerData.formData.signerRoleAssignments
        : [];
      const existingByRole = new Map(existing.map((a) => [a.role, a]));
      const seeded = {};
      for (const role of distinctRoles) {
        const prior = existingByRole.get(role);
        seeded[role] = { name: prior?.name || "", email: prior?.email || "" };
      }
      setAssignments(seeded);
    }

    load()
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ledgerId]);

  function updateAssignment(role, field, value) {
    setAssignments((prev) => ({ ...prev, [role]: { ...prev[role], [field]: value } }));
    setSaveSuccess(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const signerRoleAssignments = Object.entries(assignments).map(([role, v]) => ({
      role,
      name: v.name || "",
      email: v.email || "",
    }));

    const res = await fetch(`/api/ledgers/${ledgerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formData: { templateId: template.id, signerRoleAssignments },
      }),
    }).catch(() => null);

    setSaving(false);
    if (!res || !res.ok) {
      setSaveError("Could not save signer assignments. Please try again.");
      return;
    }
    setSaveSuccess(true);
  }

  // Out-of-scope "Send for signature" -- honest disclosure rather than dead
  // silence or partial wiring, matching the Folder workspace page's own
  // handleExport precedent for its own out-of-scope export button.
  function handleSendForSignature() {
    setSendMessage("Sending for signature isn't available yet. Coming soon.");
  }

  if (loadError) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        <div style={{ color: "oklch(45% 0.18 25)", marginBottom: "12px" }}>⚠️ {loadError}</div>
        <button type="button" onClick={() => router.back()}>Back</button>
      </div>
    );
  }

  if (loading || !template) {
    return (
      <div style={{ padding: "40px", fontFamily: "'Inter',-apple-system,system-ui,sans-serif" }}>
        Loading…
      </div>
    );
  }

  const roles = Object.keys(assignments);

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "'Inter',-apple-system,system-ui,sans-serif",
        color: "oklch(24% 0.015 264)",
        background: "oklch(97% 0.006 60)",
        padding: "28px 32px",
      }}
    >
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "19px", fontWeight: 800, marginBottom: "4px" }}>
          {ledger?.name || "Ledger"}
        </div>
        <div style={{ fontSize: "12.5px", color: "oklch(50% 0.01 264)" }}>
          Assign signers for template &quot;{template.name}&quot;
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 480px", minWidth: "320px" }}>
          {/* Template PDF for reference -- exact <embed> markup/styling
              reused from FolderFileViewer.jsx rather than reinvented. */}
          <embed
            src={template.pdfUrl}
            type="application/pdf"
            style={{ width: "100%", height: "500px", borderRadius: "8px", border: "1px solid var(--border)" }}
          />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            flex: "1 1 340px",
            minWidth: "300px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "white",
            borderRadius: "12px",
            padding: "20px",
            border: "1px solid oklch(91% 0.006 60)",
          }}
        >
          <div style={{ fontSize: "12.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "oklch(50% 0.01 264)" }}>
            Signer roles
          </div>

          {roles.length === 0 ? (
            <div style={{ fontSize: "13px", color: "oklch(50% 0.01 264)" }}>
              This template has no signer-role fields defined.
            </div>
          ) : (
            roles.map((role) => (
              <div key={role} style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "12px", borderBottom: "1px solid oklch(93% 0.006 60)" }}>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>{role}</div>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11.5px", fontWeight: 600, color: "oklch(45% 0.01 264)" }}>Name</span>
                  <input
                    type="text"
                    value={assignments[role]?.name || ""}
                    onChange={(e) => updateAssignment(role, "name", e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11.5px", fontWeight: 600, color: "oklch(45% 0.01 264)" }}>Email</span>
                  <input
                    type="email"
                    value={assignments[role]?.email || ""}
                    onChange={(e) => updateAssignment(role, "email", e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  />
                </label>
              </div>
            ))
          )}

          {saveError ? (
            <div style={{ color: "oklch(45% 0.18 25)", fontSize: "12.5px" }}>⚠️ {saveError}</div>
          ) : null}
          {saveSuccess ? (
            <div style={{ color: "oklch(45% 0.14 155)", fontSize: "12.5px" }}>Saved.</div>
          ) : null}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 18px",
                borderRadius: "9px",
                border: "none",
                background: "oklch(45% 0.15 300)",
                color: "white",
                fontWeight: 600,
                fontSize: "13px",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save assignments"}
            </button>
            <button
              type="button"
              onClick={handleSendForSignature}
              style={{
                padding: "10px 18px",
                borderRadius: "9px",
                border: "1px solid oklch(45% 0.15 300)",
                background: "white",
                color: "oklch(45% 0.15 300)",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Send for signature
            </button>
          </div>

          {sendMessage ? (
            <div style={{ color: "oklch(50% 0.01 264)", fontSize: "12.5px" }}>{sendMessage}</div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
