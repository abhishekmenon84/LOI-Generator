"use client";

import { useState } from "react";
import { ROLES_BY_DOCUMENT_TYPE, ROLE_LABELS } from "../lib/signerRoles";

export default function SendForSignatureModal({ dealId, documentType, isOpen, onClose, onSent }) {
  const [participants, setParticipants] = useState([
    { kind: "signer", role: ROLES_BY_DOCUMENT_TYPE[documentType]?.[0] || "other", roleOtherLabel: "", name: "", email: "" },
  ]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const availableRoles = ROLES_BY_DOCUMENT_TYPE[documentType] || ["other"];

  function updateParticipant(index, patch) {
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, { kind: "signer", role: availableRoles[0], roleOtherLabel: "", name: "", email: "" }]);
  }

  function removeParticipant(index) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/signature-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not send for signature.");
      onSent();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

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

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button type="button" onClick={handleSend} disabled={sending} className="marketing-cta-button">
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
