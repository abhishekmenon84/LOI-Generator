"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "ledgerlot:set-password-banner-dismissed";

// Nudges a magic-link-only user toward setting a password, without forcing
// it -- dismissal is remembered per-browser (not server-persisted; this is
// a convenience nudge, not a compliance gate, so a lightweight localStorage
// flag is enough).
export default function SetPasswordBanner({ hasPassword }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!hasPassword) {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    }
  }, [hasPassword]);

  if (hasPassword || dismissed) return null;

  return (
    <div
      className="status-banner"
      role="status"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}
    >
      <span>Want a faster sign-in? Set a password in Settings — your email sign-in link keeps working either way.</span>
      <div style={{ display: "flex", gap: 10, flex: "0 0 auto" }}>
        <Link href="/settings" style={{ fontWeight: 600, color: "var(--accent-light)" }}>Set password</Link>
        <button
          type="button"
          onClick={() => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}
          style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
