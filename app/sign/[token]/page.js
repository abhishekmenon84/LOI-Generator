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
  if (documentType === "commercial_lease_loi") return <LeasePreview model={buildLeaseModel(formData)} />;
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

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <div className="status-banner status-error" role="alert">⚠️ {error}</div>
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

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto", minHeight: "100dvh" }}>
      <h1 style={{ fontSize: "1.2rem", marginBottom: 4 }}>{info.dealName}</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        Signing as {info.signerName} ({info.signerRole})
      </p>

      <p style={{ marginBottom: 16, fontSize: "0.9rem" }}>
        Please review the document, then draw your signature below and confirm your consent to sign electronically.
      </p>

      <div style={{ maxHeight: "50vh", overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 16 }}>
        <DocumentPreview documentType={info.documentType} formData={info.formData} />
      </div>

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
    </div>
  );
}
