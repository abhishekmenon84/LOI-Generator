"use client";

import { useEffect, useState } from "react";

export default function DocumentAuditPanel({ ledgerId, isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !ledgerId) return;
    fetch(`/api/ledgers/${ledgerId}/signature-audit`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load audit trail."))))
      .then(setData)
      .catch((err) => setError(err.message));
  }, [isOpen, ledgerId]);

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
            {r.deliveryError && (
              <div className="status-banner status-error" role="alert" style={{ marginBottom: 8, fontSize: "0.8rem" }}>
                ⚠️ The document was fully signed, but the completion email failed to send: {r.deliveryError}
              </div>
            )}
            {r.status === "fully_executed" && (
              <a
                href={`/api/ledgers/${ledgerId}/signature-audit/${r.id}/certificate`}
                style={{ display: "inline-block", marginBottom: 8, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}
              >
                Download Certificate of Completion
              </a>
            )}
            {/* Name + role + status + timestamps only -- IP address,
                geolocation, device/browser string, and email are collected
                and retained in the database for legal/compliance defense
                but are deliberately not surfaced here (see this route's
                own comment for the PIPEDA reasoning). */}
            {r.signers.map((s, i) => (
              <div key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", borderTop: "1px solid var(--border)", padding: "8px 0" }}>
                <p style={{ margin: 0 }}>
                  <strong>{s.name}</strong> — {s.role} ({s.kind === "notify_only" ? "notify only" : s.signed ? "signed" : "pending"})
                </p>
                {s.tokenUsedAt && (
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Link opened: {new Date(s.tokenUsedAt).toLocaleString()}
                  </p>
                )}
                {s.signed && s.signedAt && (
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Signed: {new Date(s.signedAt).toLocaleString()}
                  </p>
                )}
                {s.signatureImageUrl && (
                  <img
                    src={s.signatureImageUrl}
                    alt={`${s.name}'s signature`}
                    style={{ marginTop: 6, maxHeight: 50, background: "white", borderRadius: 4, padding: 4 }}
                  />
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
