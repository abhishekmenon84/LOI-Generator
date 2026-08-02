import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrgLimits,
  getTierForSeatCount,
  quotaForSeatCount,
  BUSINESS_SEAT_TIERS,
  PERSONAL_DOC_PRICE_CENTS,
  PERSONAL_DAILY_CAP,
  PERSONAL_MONTHLY_CAP,
  BUSINESS_OVERAGE_CENTS_PER_DOC,
} from "../lib/orgBilling.js";

// checkAndIncrementUsage and reportPendingOverage are DB-dependent (real
// UsageCounter rows, rolling windows, Stripe invoice items) and are
// documented as manual verification steps at the bottom of this file,
// matching this codebase's existing convention for session/DB-dependent
// behavior (e.g. test/usageGating.integration.test.mjs).

test("getOrgLimits: personal org is never blocked by an inactive-subscription check (no subscription exists)", () => {
  const org = { isPersonal: true, planTier: "free" };
  const limits = getOrgLimits(org);
  assert.equal(limits.canView, true);
  assert.equal(limits.canCreate, true);
  assert.equal(limits.canExport, true);
  assert.equal(limits.canEsign, true);
  assert.equal(limits.hasAudit, true);
  assert.equal(limits.hasBranding, true);
  assert.equal(limits.documentsPerDay, PERSONAL_DAILY_CAP);
  assert.equal(limits.documentsPerMonth, PERSONAL_MONTHLY_CAP);
  assert.equal(limits.templatesMax, Infinity);
});

test("getOrgLimits: business org (active) is unlimited with 3-year retention", () => {
  const limits = getOrgLimits({ isPersonal: false, planTier: "growth" });
  assert.equal(limits.canCreate, true);
  assert.equal(limits.canExport, true);
  assert.equal(limits.canEsign, true);
  assert.equal(limits.hasAudit, true);
  assert.equal(limits.hasBranding, true);
  assert.equal(limits.documentsPerDay, Infinity);
  assert.equal(limits.documentsPerMonth, Infinity);
  assert.equal(limits.templatesMax, Infinity);
  assert.equal(limits.retentionYears, 3);
});

test("getOrgLimits: business org honors a negotiated retentionYears override above the 3-year default", () => {
  const limits = getOrgLimits({ isPersonal: false, planTier: "growth", retentionYears: 7 });
  assert.equal(limits.retentionYears, 7);
});

test("getOrgLimits: expired business org cannot create or export", () => {
  const limits = getOrgLimits({ isPersonal: false, planTier: "expired" });
  assert.equal(limits.canCreate, false);
  assert.equal(limits.canExport, false);
});

test("getOrgLimits: business org still on an unexpired trial can create and export", () => {
  const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const limits = getOrgLimits({ isPersonal: false, planTier: "trial", trialEndsAt });
  assert.equal(limits.canCreate, true);
  assert.equal(limits.canExport, true);
});

test("getOrgLimits: business org on an expired trial cannot create or export", () => {
  const trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const limits = getOrgLimits({ isPersonal: false, planTier: "trial", trialEndsAt });
  assert.equal(limits.canCreate, false);
  assert.equal(limits.canExport, false);
});

test("Personal pay-per-document pricing matches the spec exactly", () => {
  assert.equal(PERSONAL_DOC_PRICE_CENTS, 200);
  assert.equal(PERSONAL_DAILY_CAP, 5);
  assert.equal(PERSONAL_MONTHLY_CAP, 30);
});

test("Business overage rate matches the spec exactly", () => {
  assert.equal(BUSINESS_OVERAGE_CENTS_PER_DOC, 50);
});

test("BUSINESS_SEAT_TIERS have the exact seat ranges and per-seat prices from the spec", () => {
  const growth = BUSINESS_SEAT_TIERS.find((t) => t.key === "growth");
  assert.equal(growth.minSeats, 2);
  assert.equal(growth.maxSeats, 10);
  assert.equal(growth.priceCentsPerSeat, 3000);
  assert.equal(growth.docsPerSeatPerDay, 0.3);

  const professional = BUSINESS_SEAT_TIERS.find((t) => t.key === "professional");
  assert.equal(professional.minSeats, 11);
  assert.equal(professional.maxSeats, 25);
  assert.equal(professional.priceCentsPerSeat, 2800);
  assert.equal(professional.docsPerSeatPerDay, 0.29);

  const business = BUSINESS_SEAT_TIERS.find((t) => t.key === "business");
  assert.equal(business.minSeats, 26);
  assert.equal(business.maxSeats, 50);
  assert.equal(business.priceCentsPerSeat, 2700);
  assert.equal(business.docsPerSeatPerDay, 0.28);

  const enterprise = BUSINESS_SEAT_TIERS.find((t) => t.key === "enterprise");
  assert.equal(enterprise.minSeats, 51);
  assert.equal(enterprise.maxSeats, 100);
  assert.equal(enterprise.priceCentsPerSeat, 2500);
  assert.equal(enterprise.docsPerSeatPerDay, 0.27);

  const scale = BUSINESS_SEAT_TIERS.find((t) => t.key === "scale");
  assert.equal(scale.minSeats, 101);
  assert.equal(scale.priceCentsPerSeat, 2400);
  assert.equal(scale.docsPerSeatPerDay, 0.26);
});

test("getTierForSeatCount picks the correct bracket at range boundaries", () => {
  assert.equal(getTierForSeatCount(2).key, "growth");
  assert.equal(getTierForSeatCount(10).key, "growth");
  assert.equal(getTierForSeatCount(11).key, "professional");
  assert.equal(getTierForSeatCount(25).key, "professional");
  assert.equal(getTierForSeatCount(26).key, "business");
  assert.equal(getTierForSeatCount(50).key, "business");
  assert.equal(getTierForSeatCount(51).key, "enterprise");
  assert.equal(getTierForSeatCount(100).key, "enterprise");
  assert.equal(getTierForSeatCount(101).key, "scale");
  assert.equal(getTierForSeatCount(500).key, "scale");
});

test("getTierForSeatCount returns null below the smallest bracket", () => {
  assert.equal(getTierForSeatCount(1), null);
  assert.equal(getTierForSeatCount(0), null);
});

test("quotaForSeatCount matches the spec's worked examples (5 and 150 seats)", () => {
  // Spec: "Example: 5→150 seats" column -- 5 seats falls in Growth (0.30/seat/day),
  // 150 seats falls in Scale (0.26/seat/day).
  assert.equal(quotaForSeatCount(5), Math.round(5 * 0.3 * 30)); // 45
  assert.equal(quotaForSeatCount(150), Math.round(150 * 0.26 * 30)); // 1170
});

test("quotaForSeatCount is 0 for a seat count with no matching bracket", () => {
  assert.equal(quotaForSeatCount(1), 0);
  assert.equal(quotaForSeatCount(0), 0);
});

// ---------------------------------------------------------------------
// MANUAL verification steps -- checkAndIncrementUsage and
// reportPendingOverage need a real UsageCounter row (rolling day/month
// windows) and, for reportPendingOverage, a real Stripe customer, neither
// of which node:test can set up without a running server and a real DB
// state. Run these by hand after this lands:
//
// 1. Fresh personal org, planTier "free": POST /api/ledgers 5 times in
//    one day -> all succeed, pendingOverageCents on its UsageCounter is
//    5 * 200 = 1000. 6th call same day -> 402 "daily limit of 5".
// 2. Same org, next day: can create again (daily cap reset), until 30
//    total for the rolling 30-day period, then 402 "monthly limit of 30"
//    even though the daily cap isn't hit.
// 3. Business org with 5 seats (Growth tier, quota 45/mo): create 46
//    documents in the period -> all 46 succeed (never blocked), and the
//    46th adds 50 cents to pendingOverageCents (46th is the 1st over the
//    45-doc quota).
// 4. reportPendingOverage(orgId) on an org with a real stripeCustomerId
//    and pendingOverageCents > 0 -> creates a Stripe invoice item for
//    that amount and resets pendingOverageCents to 0. Calling it again
//    immediately -> {billed: 0}, no duplicate invoice item.
