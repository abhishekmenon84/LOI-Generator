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
// "Send for signature" creates a real SignatureRequest via
// POST /api/ledgers/[id]/signature-request, the same route the 3 built-in
// document types use -- see handleSendForSignature below and
// lib/signerRoles.js's isValidRole, which now accepts this document
// type's dynamic (per-template) roles. Note: burnSignatures() (called
// from lib/signatureFinalize.js once every signer has signed) now uses
// this template's own signature-anchor coordinates (confirmed by the
// sender in the placement-review step below, seeded from TemplateAnchor
// rows) to position each signature -- the trailing-page append is only a
// fallback for a signer with no explicit anchor.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SignatureAnchorReview from "../../../../components/SignatureAnchorReview";

export default function CustomTemplateSignerAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const ledgerId = params.ledgerId;

  const [ledger, setLedger] = useState(null);
  const [template, setTemplate] = useState(null);
  const [pageImages, setPageImages] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  // One {role, name, email} row per distinct TemplateAnchor.role, keyed by
  // role string in this component's state.
  const [assignments, setAssignments] = useState({}); // { [role]: {name, email} }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sendMessage, setSendMessage] = useState(null);
  const [sending, setSending] = useState(false);
  // Two-step flow: participants-step (existing form, above) -> placementStep
  // (drag/confirm signature placement, see SignatureAnchorReview) -> submit.
  const [placementStep, setPlacementStep] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  // Separate from sendMessage: sendMessage renders in the participants-step
  // JSX, which is unreachable while placementStep is true, so a failed final
  // send needs its own slot threaded into SignatureAnchorReview's
  // externalError prop instead (mirrors SendForSignatureModal.jsx's `error`).
  const [placementError, setPlacementError] = useState(null);

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

      // custom_template stores its template reference in formData.templateId
      // (set via a follow-up PATCH after creation); form_template uses the
      // real Ledger.templateId FK instead, set directly at creation time.
      const templateId = ledgerData.documentType === "form_template" ? ledgerData.templateId : ledgerData.formData?.templateId;
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

      // Client-side page rendering (same approach as the fill wizard and
      // AnchorEditor.jsx) so the answers already saved via "Edit answers"
      // can be overlaid directly on the PDF here too -- an <embed> gives
      // no coordinate system to overlay onto, so this replaces it with a
      // rendered <img> per page.
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const doc = await pdfjsLib.getDocument({ url: templateData.pdfUrl }).promise;
      const images = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL());
      }
      if (!cancelled) setPageImages(images);
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

    // formData is replaced wholesale by the PATCH route (not merged), so the
    // existing answers (customTemplateAnswers/formTemplateAnswers, saved via
    // the fill wizard) must be carried forward here, not dropped.
    const isFormTemplate = ledger?.documentType === "form_template";
    const nextFormData = {
      ...(ledger?.formData || {}),
      ...(isFormTemplate ? {} : { templateId: template.id }),
      signerRoleAssignments,
    };

    const res = await fetch(`/api/ledgers/${ledgerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData: nextFormData }),
    }).catch(() => null);

    setSaving(false);
    if (!res || !res.ok) {
      setSaveError("Could not save signer assignments. Please try again.");
      return;
    }
    setSaveSuccess(true);
  }

  // Sends the current role assignments to POST /api/ledgers/[id]/signature-request
  // -- the same SignatureRequest/SignerSlot/SignatureEvent pipeline the 3
  // built-in document types already use. That route validates each
  // participant's role via lib/signerRoles.js's isValidRole, which now
  // accepts any non-empty role string for documentType "custom_template"
  // (there's no fixed role enum for a user-uploaded template -- its roles
  // come from that template's own TemplateAnchor.role values instead).
  // lib/signatureFinalize.js's buildDealPdf already fully supports
  // "custom_template" (stamps customTemplateAnswers via
  // stampCustomTemplate, then burns signatures) -- that part required no
  // changes, only this UI's wiring and the role-validation gap above.
  function buildParticipants() {
    return Object.keys(assignments).map((role) => ({
      kind: "signer",
      role,
      name: assignments[role].name.trim(),
      email: assignments[role].email.trim(),
    }));
  }

  async function handleContinueToPlacement() {
    setSendMessage(null);
    const roles = Object.keys(assignments);
    const incomplete = roles.filter((r) => !assignments[r]?.name?.trim() || !assignments[r]?.email?.trim());
    if (incomplete.length > 0) {
      setSendMessage(`Please fill in a name and email for: ${incomplete.join(", ")}.`);
      return;
    }
    if (roles.length === 0) {
      setSendMessage("This template has no signer roles to send to.");
      return;
    }

    setLoadingPreview(true);
    const participants = buildParticipants();
    const res = await fetch(`/api/ledgers/${ledgerId}/signature-request/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participants }),
    }).catch(() => null);
    setLoadingPreview(false);

    const body = await res?.json().catch(() => ({})) ?? {};
    if (!res || !res.ok) {
      setSendMessage(body.error || "Could not prepare a preview of this document.");
      return;
    }
    setPreview(body);
    setPlacementError(null);
    setPlacementStep(true);
  }

  // On failure this sets placementError (not sendMessage) and stays on
  // placementStep -- sendMessage's display lives in the participants-step
  // JSX below, which is unreachable while placementStep is true, so a failed
  // final send must surface via SignatureAnchorReview's externalError prop
  // instead, with the user's anchors kept intact for a retry.
  async function handleSendForSignature(signatureAnchors) {
    setSending(true);
    setPlacementError(null);
    const participants = buildParticipants();

    const res = await fetch(`/api/ledgers/${ledgerId}/signature-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participants, signatureAnchors }),
    }).catch(() => null);
    setSending(false);

    const body = await res?.json().catch(() => ({})) ?? {};
    if (!res || !res.ok) {
      setPlacementError(body.error || "Could not send for signature. Please try again.");
      setPlacementStep(true);
      return;
    }
    setPlacementStep(false);
    setSendMessage(
      body.emailWarning
        ? `Sent, but: ${body.emailWarning}`
        : "Sent! Each signer will receive an email with a link to sign."
    );
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

  if (placementStep && preview) {
    return (
      <SignatureAnchorReview
        pdfBase64={preview.pdfBase64}
        pageSizes={preview.pageSizes}
        suggestedAnchors={preview.suggestedAnchors}
        participants={buildParticipants()}
        onCancel={() => setPlacementStep(false)}
        onConfirm={handleSendForSignature}
        submitting={sending}
        externalError={placementError}
      />
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
        {ledger?.folderId && (
          <button
            type="button"
            onClick={() => router.push(`/ledgerboard/folder/${ledger.folderId}`)}
            style={{ marginBottom: "10px", background: "none", border: "none", padding: 0, color: "oklch(24% 0.015 264)", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
          >
            ← Back to folder
          </button>
        )}
        <div style={{ fontSize: "19px", fontWeight: 800, marginBottom: "4px" }}>
          {ledger?.name || "Ledger"}
        </div>
        <div style={{ fontSize: "12.5px", color: "oklch(50% 0.01 264)" }}>
          Assign signers for template &quot;{template.name}&quot;
        </div>
        <button
          type="button"
          onClick={() => router.push(`/ledgerboard/custom-template/${ledgerId}/fill`)}
          style={{ marginTop: "8px", padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          Edit answers
        </button>
      </div>

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 480px", minWidth: "320px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Rendered per-page images (not <embed>) so answers already
              saved via "Edit answers" can be overlaid directly on the PDF
              -- an <embed>'s native PDF viewer gives no coordinate system
              to position an overlay against. Client-side only, same
              approach as the fill wizard: doesn't match the final PDF's
              exact font/kerning (that only happens via stampCustomTemplate
              at signing time), just immediate visual feedback. */}
          {pageImages.map((src, pageIdx) => (
            <div key={pageIdx} style={{ position: "relative" }}>
              <img
                src={src}
                alt={`Page ${pageIdx + 1}`}
                style={{ width: "100%", display: "block", borderRadius: "8px", border: "1px solid var(--border)" }}
              />
              {(template.anchors || [])
                .filter((a) => a.page === pageIdx)
                .map((anchor) => {
                  const overlayStyle = {
                    position: "absolute",
                    left: `${anchor.xPct}%`,
                    top: `${anchor.yPct}%`,
                    width: `${anchor.widthPct}%`,
                    height: `${anchor.heightPct}%`,
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                    overflow: "hidden",
                    fontSize: "clamp(8px, 1.4vw, 13px)",
                    color: "oklch(30% 0.15 264)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  };

                  // signature/initials anchors have no customTemplateAnswers
                  // entry (stampCustomTemplate never stamps them as text --
                  // the real signature image is only burned in once every
                  // signer has actually signed). Here, before signing, show
                  // the assigned signer's name in italics as a placeholder
                  // so this screen's own "Signer roles" assignments are
                  // reflected on the PDF too, not just customTemplateAnswers.
                  if (anchor.type === "signature" || anchor.type === "initials") {
                    const signerName = assignments[anchor.role]?.name;
                    if (!signerName) return null;
                    return (
                      <div key={anchor.id} style={{ ...overlayStyle, fontStyle: "italic", color: "oklch(50% 0.1 264)" }}>
                        {signerName}
                      </div>
                    );
                  }

                  const answersKey = ledger?.documentType === "form_template" ? "formTemplateAnswers" : "customTemplateAnswers";
                  const answers = ledger?.formData?.[answersKey] || {};
                  const answer = answers[anchor.id];
                  if (anchor.type === "checkbox" || anchor.type === "radio") {
                    if (!answer) return null;
                    return (
                      <div key={anchor.id} style={{ ...overlayStyle, justifyContent: "center", fontWeight: 800 }}>
                        ✕
                      </div>
                    );
                  }
                  if (typeof answer !== "string" || !answer) return null;
                  return (
                    <div key={anchor.id} style={overlayStyle}>
                      {answer}
                    </div>
                  );
                })}
            </div>
          ))}
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
                background: "oklch(24% 0.015 264)",
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
              onClick={handleContinueToPlacement}
              disabled={loadingPreview}
              style={{
                padding: "10px 18px",
                borderRadius: "9px",
                border: "1px solid oklch(24% 0.015 264)",
                background: "white",
                color: "oklch(24% 0.015 264)",
                fontWeight: 600,
                fontSize: "13px",
                cursor: loadingPreview ? "not-allowed" : "pointer",
              }}
            >
              {loadingPreview ? "Preparing…" : "Send for signature"}
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
