"use client";

import { useEffect, useState } from "react";
import { ROLES_BY_DOCUMENT_TYPE, ROLE_LABELS } from "../lib/signerRoles";
import SignatureAnchorReview from "./SignatureAnchorReview";

export default function SendForSignatureModal({ ledgerId, documentType, isOpen, onClose, onSent }) {
  const [participants, setParticipants] = useState([
    { kind: "signer", role: ROLES_BY_DOCUMENT_TYPE[documentType]?.[0] || "other", roleOtherLabel: "", name: "", email: "" },
  ]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [emailWarning, setEmailWarning] = useState(null);
  // Two-step flow: "participants" (existing form) -> "placement" (drag/
  // confirm signature placement, see SignatureAnchorReview) -> submit.
  const [step, setStep] = useState("participants");
  const [preview, setPreview] = useState(null); // { pdfBase64, pageSizes, suggestedAnchors }
  const [loadingPreview, setLoadingPreview] = useState(false);

  // A ledger can only ever have one "pending" SignatureRequest at a time
  // (see the create route's existingPending check) -- previously that
  // meant a sender who'd already sent could fill out the whole
  // participants form and placement step again, only to be rejected at
  // the very end with a dead-end error. Checking up front (GET
  // .../signature-audit, the same endpoint DocumentAuditPanel already
  // uses for its own "Send reminder" button) lets this modal skip straight
  // to offering a resend instead.
  const [checkingPending, setCheckingPending] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null); // { id, signers } | null
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState(null);
  const [resendError, setResendError] = useState(null);
  const [voiding, setVoiding] = useState(false);

  const availableRoles = ROLES_BY_DOCUMENT_TYPE[documentType] || ["other"];

  // Most call sites mount this modal once and toggle `isOpen` rather than
  // keying it per-ledger, so step/preview/emailWarning/error (React state
  // internal to this component) would otherwise survive a close/reopen of
  // the SAME instance -- leaving a reopened modal stranded on a stale
  // "done" or "placement" step instead of back at the participants form.
  // Reset flow-position state (not `participants` -- the form should still
  // remember what was typed) whenever the modal transitions to open.
  useEffect(() => {
    if (!isOpen) return;
    setStep("participants");
    setPreview(null);
    setEmailWarning(null);
    setError(null);
    setResending(false);
    setResendMessage(null);
    setResendError(null);

    let cancelled = false;
    setCheckingPending(true);
    fetch(`/api/ledgers/${ledgerId}/signature-audit`)
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((body) => {
        if (cancelled) return;
        const pending = (body.requests || []).find((r) => r.status === "pending") || null;
        setPendingRequest(pending);
      })
      .catch(() => {
        if (!cancelled) setPendingRequest(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ledgerId]);

  async function handleResend() {
    setResending(true);
    setResendError(null);
    setResendMessage(null);
    const res = await fetch(`/api/ledgers/${ledgerId}/signature-request/${pendingRequest.id}/remind`, { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => ({})) ?? {};
    setResending(false);
    if (!res || !res.ok) {
      setResendError(body.error || "Could not resend the signing email.");
      return;
    }
    setResendMessage(
      body.emailWarning || `Reminded ${body.remindedCount} signer${body.remindedCount === 1 ? "" : "s"}.`
    );
  }

  async function handleVoidAndStartNew() {
    if (!window.confirm("This will cancel the in-progress signature request (its signing links will stop working) so you can send a new one. Continue?")) return;
    setVoiding(true);
    const res = await fetch(`/api/ledgers/${ledgerId}/signature-request/void`, { method: "POST" }).catch(() => null);
    setVoiding(false);
    if (!res || !res.ok) {
      const body = await res?.json().catch(() => ({})) ?? {};
      setResendError(body.error || "Could not void the in-progress request.");
      return;
    }
    setPendingRequest(null);
  }

  function updateParticipant(index, patch) {
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, { kind: "signer", role: availableRoles[0], roleOtherLabel: "", name: "", email: "" }]);
  }

  function removeParticipant(index) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleContinueToPlacement() {
    setError(null);
    // Client-side completeness check up front (mirrors the custom-template
    // page's equivalent handleContinueToPlacement) so a blank name/email is
    // caught here instead of only much later by the create route, after a
    // full server-side PDF render and a placement-step round-trip.
    const incomplete = participants.filter(
      (p) => p.kind === "signer" && (!p.name?.trim() || !p.email?.trim())
    );
    if (incomplete.length > 0) {
      setError("Please fill in a name and email for every signer.");
      return;
    }

    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/ledgers/${ledgerId}/signature-request/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not prepare a preview of this document.");
      setPreview(body);
      setStep("placement");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleSend(signatureAnchors) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/ledgers/${ledgerId}/signature-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants, signatureAnchors }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not send for signature.");
      onSent();
      // Signing links were created either way -- but if Resend couldn't
      // actually deliver the notification email (e.g. its sandbox sender is
      // restricted to your own address until a domain is verified), keep
      // the modal open to show that instead of silently closing on a
      // request that looked successful but notified no one. This must land
      // on its own "done" step (not "placement") -- the request has already
      // been created, so re-showing the drag-and-drop placement UI would let
      // the user click Continue again and create a duplicate SignatureRequest.
      if (body.emailWarning) {
        setEmailWarning(body.emailWarning);
        setStep("done");
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message);
      setStep("placement");
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  if (checkingPending || pendingRequest) {
    const dialogShellStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
    if (checkingPending) {
      return (
        <div role="dialog" aria-modal="true" aria-label="Send for signature" style={dialogShellStyle}>
          <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 480, width: "100%", padding: 24 }}>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>Checking for an in-progress signature request…</p>
          </div>
        </div>
      );
    }
    return (
      <div role="dialog" aria-modal="true" aria-label="Resend for signature" style={dialogShellStyle}>
        <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 480, width: "100%", padding: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Signature request already sent</h2>
          <div className="status-banner" role="status" style={{ marginBottom: 12, background: "var(--accent-glow, rgba(99,102,241,0.1))", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
            ⚠️ This document already has a signature request in progress
            {pendingRequest.signers?.length > 0 && (
              <>
                {" "}
                (
                {pendingRequest.signers
                  .filter((s) => s.kind === "signer")
                  .map((s) => `${s.name} (${s.role})${s.signed ? " — signed" : s.declinedAt ? " — declined" : ""}`)
                  .join(", ")}
                )
              </>
            )}
            . You can resend the signing email instead of starting a new one.
          </div>

          {resendError && <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>⚠️ {resendError}</div>}
          {resendMessage && <div className="status-banner" role="status" style={{ marginBottom: 12, color: "var(--text-secondary)" }}>{resendMessage}</div>}

          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleVoidAndStartNew}
              disabled={voiding}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", textDecoration: "underline", cursor: voiding ? "not-allowed" : "pointer", fontSize: "0.85rem", padding: 0 }}
            >
              {voiding ? "Voiding…" : "Void it and start a new request instead"}
            </button>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}
              >
                Close
              </button>
              <button type="button" onClick={handleResend} disabled={resending} className="marketing-cta-button">
                {resending ? "Resending…" : "Resend"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send for signature"
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 560, width: "100%", padding: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Send for signature</h2>
          {emailWarning && (
            <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>
              ⚠️ {emailWarning}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="marketing-cta-button">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "placement" && preview) {
    return (
      <SignatureAnchorReview
        pdfBase64={preview.pdfBase64}
        pageSizes={preview.pageSizes}
        suggestedAnchors={preview.suggestedAnchors}
        participants={participants}
        onCancel={() => setStep("participants")}
        onConfirm={handleSend}
        submitting={sending}
        externalError={error}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send for signature"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Send for signature</h2>

        {participants.map((p, i) => (
          <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select
                value={p.role}
                onChange={(e) => updateParticipant(i, { role: e.target.value })}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                ))}
              </select>
              <select
                value={p.kind}
                onChange={(e) => updateParticipant(i, { kind: e.target.value })}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
              >
                <option value="signer">Signer</option>
                <option value="notify_only">Notify only</option>
              </select>
            </div>
            {p.role === "other" && (
              <input
                type="text"
                placeholder="Role label"
                value={p.roleOtherLabel}
                onChange={(e) => updateParticipant(i, { roleOtherLabel: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", marginBottom: 8 }}
              />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Name"
                value={p.name}
                onChange={(e) => updateParticipant(i, { name: e.target.value })}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
              />
              <input
                type="email"
                placeholder="Email"
                value={p.email}
                onChange={(e) => updateParticipant(i, { email: e.target.value })}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)" }}
              />
            </div>
            {participants.length > 1 && (
              <button type="button" onClick={() => removeParticipant(i)} className="deal-list-item-delete" style={{ marginTop: 8 }}>
                Remove
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addParticipant} className="btn-add-clause" style={{ marginBottom: 16 }}>
          + Add Participant
        </button>

        {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
        {emailWarning && (
          <div className="status-banner status-error" role="alert" style={{ marginBottom: 12 }}>
            ⚠️ {emailWarning}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}
          >
            {emailWarning ? "Close" : "Cancel"}
          </button>
          <button type="button" onClick={handleContinueToPlacement} disabled={loadingPreview || !!emailWarning} className="marketing-cta-button">
            {loadingPreview ? "Preparing…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
