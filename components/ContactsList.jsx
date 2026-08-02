"use client";

import { useState } from "react";

function relativeTime(isoString) {
  if (!isoString) return null;
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

function initialsFor(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ContactsList({ initialContacts, userOrgs = [] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState(userOrgs[0]?.orgId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function cancelAdd() {
    setAdding(false);
    setName("");
    setRole("");
    setEmail("");
    setError(null);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: role.trim(), email: email.trim() || null, orgId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not add contact.");
      setContacts((cur) => [body, ...cur]);
      cancelAdd();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const prev = contacts;
    setContacts((cur) => cur.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove contact.");
    } catch (err) {
      setContacts(prev);
      setError(err.message);
    }
  }

  return (
    <div>
      {!adding ? (
        <button type="button" className="marketing-cta-button" style={{ marginBottom: 24 }} onClick={() => setAdding(true)}>
          + Add contact
        </button>
      ) : (
        <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, maxWidth: 420 }}>
          {userOrgs.length > 1 && (
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
              {userOrgs.map((o) => (
                <option key={o.orgId} value={o.orgId}>{o.isPersonal ? "Personal" : o.orgName}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            autoFocus
            placeholder="Name, e.g. John Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
          <input
            type="text"
            placeholder="Role, e.g. Buyer, Seller, Loan Officer"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
          {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="marketing-cta-button" disabled={saving}>
              {saving ? "Adding…" : "Add contact"}
            </button>
            <button
              type="button"
              onClick={cancelAdd}
              style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && !adding && <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

      {contacts.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No contacts yet — add the people you deal with (buyers, sellers, lenders, etc).</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {contacts.map((c) => (
            <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 20, position: "relative" }}>
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                title="Remove contact"
                style={{ position: "absolute", top: 14, right: 14, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}
              >
                ✕
              </button>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--bg-panel)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                {initialsFor(c.name)}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{c.name}</div>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--bg-panel)",
                  marginBottom: 12,
                }}
              >
                {c.role}
              </span>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {c.documentCount} document{c.documentCount === 1 ? "" : "s"}
              </div>
              {c.lastActivityAt && (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Last activity {relativeTime(c.lastActivityAt)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
