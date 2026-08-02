"use client";

import { useState } from "react";

// Tier/price is derived server-side from the org's actual seat count (see
// POST /api/orgs/[id]/billing/checkout) -- there is no tier picker here
// since pricing is strictly per-seat-bracket, not a user choice.
export default function SubscribeButtons({ orgId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not start checkout.");
      window.location.href = body.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className="marketing-cta-button" disabled={loading} onClick={handleSubscribe}>
        {loading ? "Redirecting…" : "Subscribe"}
      </button>
      {error && <div className="status-banner status-error" role="alert" style={{ marginTop: 10 }}>⚠️ {error}</div>}
    </div>
  );
}
