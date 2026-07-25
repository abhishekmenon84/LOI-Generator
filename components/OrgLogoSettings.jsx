"use client";

import { useState } from "react";

export default function OrgLogoSettings({ orgId, initialLogoUrl }) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || "");
  const [saved, setSaved] = useState(initialLogoUrl || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const trimmed = logoUrl.trim();
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: trimmed || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save logo.");
      setSaved(body.logoUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: null }),
      });
      if (!res.ok) throw new Error("Could not remove logo.");
      setLogoUrl("");
      setSaved(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2>Company Logo</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 12 }}>
        Paste a link to your logo image. It replaces the default LOI Builder logo in the header for everyone in this organization.
      </p>
      {saved && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <img src={saved} alt="Current organization logo" style={{ height: 32, maxWidth: 160, objectFit: "contain", borderRadius: 6, background: "var(--bg-panel)", padding: 4 }} />
          <button type="button" onClick={handleRemove} disabled={saving} className="deal-list-item-delete">
            Remove logo
          </button>
        </div>
      )}
      <form onSubmit={handleSave} style={{ display: "flex", gap: 8 }}>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://yourcompany.com/logo.png"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="marketing-cta-button" disabled={saving || !logoUrl.trim()}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {error && <div className="status-banner status-error" role="alert" style={{ marginTop: 10 }}>⚠️ {error}</div>}
    </div>
  );
}
