"use client";

import { useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("personal");
  const [status, setStatus] = useState({ loading: false, error: null });

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ loading: true, error: null });
    try {
      const res = await fetch("/api/auth/signin/resend", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          // Every new signup already gets a free personal org (see
          // lib/auth.js's events.createUser). "Business" is threaded
          // through callbackUrl -- the one thing that survives the
          // magic-link email round trip to the click-through request --
          // and completed by app/dashboard/page.js, which creates the
          // 7-day-trial business org exactly once for a brand-new user.
          callbackUrl: accountType === "business" ? "/dashboard?newAccountType=business" : "/dashboard",
          csrfToken: await getCsrfToken(),
        }),
      });
      if (!res.ok) throw new Error("Could not send sign-in link.");
      window.location.href = "/login/check-email";
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  }

  async function getCsrfToken() {
    const res = await fetch("/api/auth/csrf");
    const data = await res.json();
    return data.csrfToken;
  }

  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Sign in</h1>
        <p>Enter your email and we&apos;ll send you a sign-in link — no password needed.</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>How are you using Ledgerlot?</span>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
            >
              <option value="personal">Personal — build documents for my own deals</option>
              <option value="business">Business — manage my team's deal pipeline (7-day free trial)</option>
            </select>
          </label>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
          />
          {status.error && (
            <div className="status-banner status-error" role="alert">⚠️ {status.error}</div>
          )}
          <button type="submit" className="marketing-cta-button" disabled={status.loading}>
            {status.loading ? "Sending…" : "Send me a sign-in link"}
          </button>
        </form>
      </main>
      <SiteFooter />
    </>
  );
}
