"use client";

import { useState } from "react";
import PasswordStrengthField from "./PasswordStrengthField";
import { validatePassword } from "../lib/passwordPolicy";

// Lets a user set/replace/remove their password. hasPassword reflects
// whether User.passwordHash is currently set -- when true, signing in with
// a password becomes the primary method (per product decision, magic link
// stays available as a fallback/recovery path, never fully removed).
export default function PasswordSettings({ hasPassword: initialHasPassword }) {
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  async function handleSetPassword(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const { valid, error: policyError } = validatePassword(password);
    if (!valid) {
      setError(policyError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not set password.");
      setHasPassword(true);
      setPassword("");
      setConfirm("");
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePassword() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/users/me/password", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove password.");
      setHasPassword(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", marginBottom: 12, fontSize: 13.5 }}>
        {hasPassword
          ? "Password sign-in is on. You can still use an emailed sign-in link if you ever forget it."
          : "You're currently signing in with emailed links only. Set a password for a faster sign-in — the link will keep working either way."}
      </p>

      <form onSubmit={handleSetPassword} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360, marginBottom: 12 }}>
        <PasswordStrengthField id="new-password" label={hasPassword ? "New password" : "Password"} value={password} onChange={setPassword} />
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
          />
        </label>

        {error && <div className="status-banner status-error" role="alert">⚠️ {error}</div>}
        {saved && <div className="status-banner" role="status">Password saved.</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={saving || !password}
            className="marketing-cta-button"
            style={{ opacity: saving || !password ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : hasPassword ? "Update password" : "Set password"}
          </button>
          {hasPassword && (
            <button
              type="button"
              onClick={handleRemovePassword}
              disabled={saving}
              style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
            >
              Remove password
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
