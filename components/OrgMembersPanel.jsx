"use client";

import { useState } from "react";

export default function OrgMembersPanel({ org, currentUserId }) {
  const [members, setMembers] = useState(org.members);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState(null);

  async function handleInvite(e) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${org.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not invite member.");
      setMembers((prev) => [...prev, { userId: null, email, name: null, role: "member" }]);
      setInviteEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId) {
    if (!window.confirm("Remove this member from the organization?")) return;
    const res = await fetch(`/api/orgs/${org.id}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }
  }

  return (
    <div>
      <h2>Members ({members.length})</h2>
      <ul style={{ listStyle: "none", padding: 0, marginBottom: 20 }}>
        {members.map((m) => (
          <li key={m.userId || m.email} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <span>
              {m.name || m.email} <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>({m.role})</span>
            </span>
            {m.userId && m.userId !== currentUserId && (
              <button type="button" onClick={() => handleRemove(m.userId)} className="deal-list-item-delete">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleInvite} style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="teammate@example.com"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="marketing-cta-button" disabled={inviting}>
          {inviting ? "Inviting…" : "Invite"}
        </button>
      </form>
      {error && <div className="status-banner status-error" role="alert" style={{ marginTop: 10 }}>⚠️ {error}</div>}
    </div>
  );
}
