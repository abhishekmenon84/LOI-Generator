"use client";

import { useEffect, useState } from "react";

const TABS = ["pending", "verified", "rejected"];

export default function VerificationQueue() {
  const [tab, setTab] = useState("pending");
  const [orgs, setOrgs] = useState(null);
  const [error, setError] = useState(null);
  const [busyOrgId, setBusyOrgId] = useState(null);
  const [rejectingOrgId, setRejectingOrgId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  function load() {
    setOrgs(null);
    fetch(`/api/admin/business-verifications?status=${tab}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load verifications."))))
      .then((data) => setOrgs(data.organizations || []))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleApprove(orgId) {
    setBusyOrgId(orgId);
    const res = await fetch(`/api/admin/business-verifications/${orgId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => null);
    setBusyOrgId(null);
    if (res && res.ok) load();
  }

  async function handleReject(orgId) {
    if (!rejectReason.trim()) return;
    setBusyOrgId(orgId);
    const res = await fetch(`/api/admin/business-verifications/${orgId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
    }).catch(() => null);
    setBusyOrgId(null);
    if (res && res.ok) {
      setRejectingOrgId(null);
      setRejectReason("");
      load();
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "8px 14px",
              border: "none",
              background: "none",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}
      {!orgs && !error && <p>Loading…</p>}
      {orgs && orgs.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No {tab} submissions.</p>}

      {orgs && orgs.map((org) => (
        <div key={org.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{org.businessName || org.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 8 }}>
            {org.province || "No province"} · Submitted {org.verificationSubmittedAt ? new Date(org.verificationSubmittedAt).toLocaleString() : "—"}
          </div>
          {org.document && (
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              <a href={org.document.fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent-light)" }}>
                {org.document.fileName}
              </a>{" "}
              <span style={{ color: "var(--text-muted)" }}>({org.document.documentType.replace(/_/g, " ")})</span>
            </div>
          )}
          {tab === "pending" && (
            <div>
              {rejectingOrgId === org.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection"
                    rows={2}
                    style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleReject(org.id)}
                      disabled={busyOrgId === org.id || !rejectReason.trim()}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "oklch(50% 0.17 25)", color: "white", cursor: "pointer" }}
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectingOrgId(null); setRejectReason(""); }}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleApprove(org.id)}
                    disabled={busyOrgId === org.id}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "oklch(24% 0.015 264)", color: "white", cursor: "pointer" }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingOrgId(org.id)}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer" }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
