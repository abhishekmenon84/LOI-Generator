"use client";

import { useState } from "react";

const TIER_LABELS = {
  personal_premium: { name: "Personal Premium", price: "$15/mo", blurb: "5 documents, 1 template, 15 e-signatures/mo" },
  personal_premium_plus: { name: "Personal Premium Plus", price: "$30/mo", blurb: "15 documents, 10 templates, 30 e-signatures/mo" },
};

export default function PersonalSubscribeButtons({ orgId, tiers }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubscribe(tierKey) {
    setLoadingKey(tierKey);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/personal-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not start checkout.");
      window.location.href = body.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setLoadingKey(null);
    }
  }

  return (
    <div>
      {error && <div className="status-banner status-error" role="alert" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {tiers.filter((t) => t.key !== "free").map((t) => {
          const meta = TIER_LABELS[t.key];
          return (
            <div key={t.key} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700 }}>{meta.name}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, margin: "6px 0" }}>{meta.price}</div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>{meta.blurb}</p>
              <button
                type="button"
                className="marketing-cta-button"
                disabled={loadingKey === t.key}
                onClick={() => handleSubscribe(t.key)}
              >
                {loadingKey === t.key ? "Redirecting…" : "Subscribe"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
