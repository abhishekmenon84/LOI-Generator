"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import { CA_PROVINCES } from "../../lib/provinces";
import { getTierForSeatCount, quotaForSeatCount, suggestedRetentionYears, RETENTION_YEAR_OPTIONS } from "../../lib/pricingTiers";

// Business signup collects province/business details/seat-count-preview/
// retention BEFORE the magic-link email is sent, since all of it must
// survive the magic-link click-through as callbackUrl query params (the
// click-through is a separate request with no memory of this form
// submission -- see app/dashboard/page.js, which reads these params and
// creates the actual Organization row exactly once). A verification
// DOCUMENT can't be threaded through a URL, so that's collected in a
// separate step after the org exists (see app/dashboard/verify-business).
function BusinessDetailsFields({ details, onChange }) {
  const [seats, setSeats] = useState(5);
  const tier = getTierForSeatCount(seats);
  const quota = quotaForSeatCount(seats);
  const suggestedYears = suggestedRetentionYears(seats);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Business name</span>
        <input
          type="text"
          required
          value={details.businessName}
          onChange={(e) => onChange({ ...details, businessName: e.target.value })}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Business phone</span>
        <input
          type="tel"
          value={details.businessPhone}
          onChange={(e) => onChange({ ...details, businessPhone: e.target.value })}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Business address</span>
        <input
          type="text"
          value={details.businessAddress}
          onChange={(e) => onChange({ ...details, businessAddress: e.target.value })}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Province</span>
        <select
          required
          value={details.province}
          onChange={(e) => onChange({ ...details, province: e.target.value })}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
        >
          <option value="" disabled>Choose a province…</option>
          {CA_PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
      </label>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
            Estimated team size: {seats} seat{seats === 1 ? "" : "s"}
          </span>
          <input
            type="range"
            min={1}
            max={150}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
          />
        </label>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0 }}>
          {tier ? (
            <>
              <strong>{tier.label}</strong> — ${(tier.priceCentsPerSeat / 100).toFixed(2)}/seat/month, ~{quota} documents/month included.
              Estimated total: <strong>${((tier.priceCentsPerSeat * seats) / 100).toFixed(2)}/month</strong>.
            </>
          ) : (
            "Pricing preview unavailable for this seat count."
          )}
        </p>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 0" }}>
          This is a preview only — actual billing starts after you subscribe from Settings. Seat count and pricing may change once you invite real teammates.
        </p>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
          Document retention (suggested: {suggestedYears} year{suggestedYears === 1 ? "" : "s"})
        </span>
        <select
          value={details.retentionYears}
          onChange={(e) => onChange({ ...details, retentionYears: Number(e.target.value) })}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
        >
          {RETENTION_YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y} year{y === 1 ? "" : "s"}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState("link"); // "link" | "password"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState("personal");
  const [businessDetails, setBusinessDetails] = useState({
    businessName: "",
    businessPhone: "",
    businessAddress: "",
    province: "",
    retentionYears: 1,
  });
  const [status, setStatus] = useState({ loading: false, error: null });

  function buildCallbackUrl() {
    if (accountType !== "business") return "/dashboard";
    const params = new URLSearchParams({
      newAccountType: "business",
      businessName: businessDetails.businessName,
      businessPhone: businessDetails.businessPhone,
      businessAddress: businessDetails.businessAddress,
      province: businessDetails.province,
      retentionYears: String(businessDetails.retentionYears),
    });
    return `/dashboard?${params.toString()}`;
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setStatus({ loading: true, error: null });
    try {
      const res = await signIn("password", { email, password, redirect: false });
      if (res?.error) {
        throw new Error("Incorrect email or password.");
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (accountType === "business" && (!businessDetails.businessName.trim() || !businessDetails.province)) {
      setStatus({ loading: false, error: "Business name and province are required." });
      return;
    }
    setStatus({ loading: true, error: null });
    try {
      const res = await fetch("/api/auth/signin/resend", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          // Every new signup already gets a free personal org (see
          // lib/auth.js's events.createUser). Business signup details are
          // threaded through callbackUrl -- the one thing that survives the
          // magic-link email round trip to the click-through request --
          // and completed by app/dashboard/page.js, which creates the
          // 7-day-trial business org exactly once for a brand-new user.
          callbackUrl: buildCallbackUrl(),
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

        {mode === "password" ? (
          <>
            <p>Sign in with your email and password.</p>
            <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-panel)", color: "var(--text-primary)" }}
              />
              {status.error && (
                <div className="status-banner status-error" role="alert">⚠️ {status.error}</div>
              )}
              <button type="submit" className="marketing-cta-button" disabled={status.loading}>
                {status.loading ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setMode("link"); setStatus({ loading: false, error: null }); }}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0 }}
              >
                Forgot your password, or never set one? Use an email sign-in link instead.
              </button>
            </form>
          </>
        ) : (
          <>
            <p>Enter your email and we&apos;ll send you a sign-in link — no password needed.</p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
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

              {accountType === "business" && (
                <BusinessDetailsFields details={businessDetails} onChange={setBusinessDetails} />
              )}

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
              <button
                type="button"
                onClick={() => { setMode("password"); setStatus({ loading: false, error: null }); }}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0 }}
              >
                Already set a password? Sign in with it instead.
              </button>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
