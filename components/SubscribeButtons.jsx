"use client";

import { useState } from "react";

export default function SubscribeButtons({ orgId, tiers }) {
  const [loadingTier, setLoadingTier] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubscribe(tierKey) {
    setLoadingTier(tierKey);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierKey }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not start checkout.");
      window.location.href = body.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setLoadingTier(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {tiers.map((t) => (
          <button
            key={t.key}
            type="button"
            className="marketing-cta-button"
            disabled={loadingTier !== null}
            onClick={() => handleSubscribe(t.key)}
          >
            {loadingTier === t.key ? "Redirecting…" : `${t.label} — $${(t.priceCents / 100).toFixed(0)}/mo`}
          </button>
        ))}
        <a
          href="mailto:abhi@menonrealty.ca?subject=50%2B%20seat%20pricing"
          className="marketing-cta-button"
          style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          50+ seats — Contact us
        </a>
      </div>
      {error && <div className="status-banner status-error" role="alert" style={{ marginTop: 10 }}>⚠️ {error}</div>}
    </div>
  );
}
