"use client";

import { useState } from "react";
import { getTierForSeatCount, quotaForSeatCount } from "../lib/pricingTiers";

// Public, unauthenticated pricing preview -- no form submission here, it
// only computes and displays. "Start 7-day trial" hands the chosen seat
// count to /login via a query param, which pre-fills the same slider
// already embedded in the business signup form (see app/login/page.js),
// so the two never show conflicting numbers for the same seat count.
export default function PublicPricingSlider() {
  const [seats, setSeats] = useState(5);
  const tier = getTierForSeatCount(seats);
  const quota = quotaForSeatCount(seats);

  return (
    <div className="pricing-slider-card">
      <label className="pricing-slider-label">
        <span>Team size: {seats} seat{seats === 1 ? "" : "s"}</span>
        <input type="range" min={1} max={150} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
      </label>

      {tier ? (
        <>
          <div className="pricing-slider-figures">
            <div>
              <span className="pricing-slider-amount">${(tier.priceCentsPerSeat / 100).toFixed(0)}</span>
              <span className="pricing-slider-unit">/seat/mo</span>
            </div>
            <div>
              <span className="pricing-slider-amount">${((tier.priceCentsPerSeat * seats) / 100).toFixed(0)}</span>
              <span className="pricing-slider-unit">/mo total</span>
            </div>
            <div>
              <span className="pricing-slider-amount">{quota}</span>
              <span className="pricing-slider-unit">docs/mo included</span>
            </div>
          </div>
          <p className="pricing-slider-tier">{tier.label}</p>
        </>
      ) : (
        <p className="pricing-slider-tier">100+ seats — contact us for custom pricing.</p>
      )}

      <a className="marketing-cta-button" href={`/login?accountType=business&seats=${seats}`}>
        Start 7-day free trial →
      </a>
      <p className="pricing-slider-note">
        A card is required to start the trial, but nothing is charged until day 7 — cancel
        anytime before then and you won&apos;t be billed.
      </p>
    </div>
  );
}
