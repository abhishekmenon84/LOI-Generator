"use client";

import { useState } from "react";

function LogOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// Mirrors the CSRF-token-then-POST pattern already used for sign-in
// (app/login/page.js) since this project calls NextAuth's REST endpoints
// directly rather than importing the client-only signOut() helper.
export default function SignOutButton({ className = "btn-sign-out", style }) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, callbackUrl: "/" }),
      });
      window.location.href = "/";
    } catch {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className} style={style} onClick={handleSignOut} disabled={loading} title="Sign out">
      <LogOutIcon />
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
