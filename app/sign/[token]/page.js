"use client";

import { useEffect, useState } from "react";
import SignaturePad from "../../../components/SignaturePad";
import LOIPreview from "../../../components/LOIPreview";
import LeasePreview from "../../../components/LeasePreview";
import ResidentialLeasePreview from "../../../components/ResidentialLeasePreview";
import { buildLOIModel } from "../../../lib/loiEngine";
import { buildLeaseModel } from "../../../lib/leaseEngine";
import { buildResidentialLeaseModel } from "../../../lib/residentialLeaseEngine";

function DocumentPreview({ documentType, formData }) {
  if (documentType === "purchase_loi") return <LOIPreview model={buildLOIModel(formData)} />;
  if (documentType === "commercial_lease") return <LeasePreview model={buildLeaseModel(formData)} />;
  if (documentType === "residential_lease") return <ResidentialLeasePreview model={buildResidentialLeaseModel(formData)} />;
  return null;
}

export default function SignPage({ params }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    fetch(`/api/sign/${params.token}`)
      .then((res) => (res.ok ? res.json() : res.json().then((b) => Promise.reject(new Error(b.error || "Invalid link.")))))
      .then(setInfo)
      .catch((err) => setError(err.message));
  }, [params.token]);

  async function handleSubmit() {
    if (!signatureDataUrl || !consent) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureImageDataUrl: signatureDataUrl,
          consent: true,
          userAgent: navigator.userAgent,
          screenInfo: `${window.screen.width}x${window.screen.height}`,
          timezoneOffset: new Date().getTimezoneOffset(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not submit signature.");
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setDeclineSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${params.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declineReason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not submit your decline.");
      setDeclined(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeclineSubmitting(false);
    }
  }

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <div className="status-banner status-error" role="alert">⚠️ {error}</div>
      </div>
    );
  }

  if (declined) {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <div className="status-banner" role="status">You've declined to sign this document. The sender has been notified.</div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <div className="status-banner" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid #10b981" }} role="status">
          ✅ Signed. You'll receive a copy of the fully signed document by email once everyone has signed.
        </div>
      </div>
    );
  }

  if (!info) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  // Only the surrounding text/controls are width-capped for readability --
  // the document preview itself (previously squeezed into this same
  // 480px column at 50vh, which is why it looked tiny with huge empty
  // margins on anything wider than a phone) now uses the full page width
  // and most of the viewport height instead.
  const readableColumnStyle = { maxWidth: 560, margin: "0 auto", padding: "0 16px" };

  return (
    <div style={{ minHeight: "100dvh", paddingTop: 20, paddingBottom: 40 }}>
      <div style={{ ...readableColumnStyle, marginBottom: 16 }}>
        {info.brandName && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            {info.brandLogoUrl && (
              <img src={info.brandLogoUrl} alt={info.brandName} style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover" }} />
            )}
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{info.brandName}</span>
          </div>
        )}
        <h1 style={{ fontSize: "1.2rem", marginBottom: 4 }}>{info.dealName}</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
          Signing as {info.signerName} ({info.signerRole})
        </p>

        <p style={{ margin: 0, fontSize: "0.9rem" }}>
          Please review the document, then draw your signature below and confirm your consent to sign electronically.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "0 12px", marginBottom: 20 }}>
        <div style={{ height: "78vh", overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          <DocumentPreview documentType={info.documentType} formData={info.formData} />
        </div>
      </div>

      <div style={readableColumnStyle}>
        <SignaturePad onChange={setSignatureDataUrl} />

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20, fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ width: 22, height: 22, marginTop: 2, flexShrink: 0 }}
          />
          I agree this constitutes my legal signature on this document.
        </label>

        {error && <div className="status-banner status-error" role="alert" style={{ marginTop: 12 }}>⚠️ {error}</div>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!signatureDataUrl || !consent || submitting}
          className="marketing-cta-button"
          style={{ width: "100%", marginTop: 20, minHeight: 48, fontSize: "1rem" }}
        >
          {submitting ? "Submitting…" : "Sign Document"}
        </button>

        {!declining ? (
          <button
            type="button"
            onClick={() => setDeclining(true)}
            style={{ width: "100%", marginTop: 12, padding: "10px 0", background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.85rem", textDecoration: "underline", cursor: "pointer" }}
          >
            I don't want to sign this
          </button>
        ) : (
          <div style={{ marginTop: 16, padding: 14, border: "1px solid var(--border)", borderRadius: 8 }}>
            <p style={{ marginTop: 0, fontSize: "0.85rem" }}>
              Declining will stop this signature request for everyone. Are you sure?
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)", marginBottom: 10, fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeclining(false)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={declineSubmitting}
                style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", background: "oklch(50% 0.17 25)", color: "white", cursor: declineSubmitting ? "not-allowed" : "pointer" }}
              >
                {declineSubmitting ? "Submitting…" : "Confirm decline"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
