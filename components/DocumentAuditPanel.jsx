"use client";

import { useEffect, useState } from "react";

export default function DocumentAuditPanel({ dealId, isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !dealId) return;
    fetch(`/api/deals/${dealId}/signature-audit`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load audit trail."))))
      .then(setData)
      .catch((err) => setError(err.message));
  }, [isOpen, dealId]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Signature audit trail"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "var(--bg-panel)", borderRadius: 12, maxWidth: 640, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Signature Audit Trail</h2>
        {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}
        {!data && !error && <p>Loading…</p>}
        {data && data.requests.length === 0 && <p style={{ color: "var(--text-muted)" }}>No signature requests yet.</p>}
        {data && data.requests.map((r) => (
          <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
              <strong>Status:</strong> {r.status} · <strong>Verify code:</strong> {r.verifyCode} · {new Date(r.createdAt).toLocaleString()}
            </p>
            {r.voidedAt && (
              <p style={{ margin: "0 0 8px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Voided: {new Date(r.voidedAt).toLocaleString()}
              </p>
            )}
            {r.finalDocumentHash && (
              <p style={{ margin: "0 0 8px", fontFamily: "monospace", fontSize: "0.72rem", wordBreak: "break-all", color: "var(--text-muted)" }}>
                Final document hash: {r.finalDocumentHash}
              </p>
            )}
            {r.signers.map((s, i) => (
              <div key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", borderTop: "1px solid var(--border)", padding: "8px 0" }}>
                <p style={{ margin: 0 }}>
                  <strong>{s.name}</strong> ({s.email}) — {s.role} ({s.kind === "notify_only" ? "notify only" : s.signed ? "signed" : "pending"})
                </p>
                {s.tokenUsedAt && (
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Link opened: {new Date(s.tokenUsedAt).toLocaleString()}
                  </p>
                )}
                {s.signed && (
                  <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: "0.72rem", wordBreak: "break-all" }}>
                    {s.signedAt && `Signed: ${new Date(s.signedAt).toLocaleString()}`} · IP: {s.ipAddress} · {[s.geoCity, s.geoRegion, s.geoCountry].filter(Boolean).join(", ") || "location unavailable"}
                    <br />
                    Device: {s.userAgent} ({s.screenInfo}, tz offset {s.timezoneOffset})
                    <br />
                    Hash: {s.documentHash}
                    {s.signatureImageUrl && (
                      <>
                        <br />
                        Signature image: {s.signatureImageUrl}
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={onClose}
          style={{ marginTop: 8, background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
