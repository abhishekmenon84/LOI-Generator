// Pure pricing/tier constants and math, with zero imports -- safe to use
// from a client component (the business-signup pricing-preview slider)
// as well as from lib/orgBilling.js (which re-exports these for existing
// server-side callers, so there's exactly one definition of the tiers).
export const BUSINESS_SEAT_TIERS = [
  { key: "growth", minSeats: 2, maxSeats: 10, priceCentsPerSeat: 3000, docsPerSeatPerDay: 0.3, label: "Growth (2-10 seats)" },
  { key: "professional", minSeats: 11, maxSeats: 25, priceCentsPerSeat: 2800, docsPerSeatPerDay: 0.29, label: "Professional (11-25 seats)" },
  { key: "business", minSeats: 26, maxSeats: 50, priceCentsPerSeat: 2700, docsPerSeatPerDay: 0.28, label: "Business (26-50 seats)" },
  { key: "enterprise", minSeats: 51, maxSeats: 100, priceCentsPerSeat: 2500, docsPerSeatPerDay: 0.27, label: "Enterprise (51-100 seats)" },
  { key: "scale", minSeats: 101, maxSeats: Infinity, priceCentsPerSeat: 2400, docsPerSeatPerDay: 0.26, label: "Scale (101+ seats)" },
];

export function getTierForSeatCount(seatCount) {
  if (seatCount <= 0) return null;
  if (seatCount === 1) return BUSINESS_SEAT_TIERS[0];
  return BUSINESS_SEAT_TIERS.find((t) => seatCount >= t.minSeats && seatCount <= t.maxSeats) || null;
}

export function quotaForSeatCount(seatCount) {
  const tier = getTierForSeatCount(seatCount);
  return tier ? Math.round(seatCount * tier.docsPerSeatPerDay * 30) : 0;
}

// Suggested retention (years) by business size, shown as a hint on the
// business-signup slider -- purely advisory, the user can pick any value
// from RETENTION_YEAR_OPTIONS regardless of seat count.
export function suggestedRetentionYears(seatCount) {
  if (seatCount <= 10) return 1;
  if (seatCount <= 50) return 3;
  return 5;
}

export const RETENTION_YEAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export function retentionYearsToDays(years) {
  return years * 365;
}
