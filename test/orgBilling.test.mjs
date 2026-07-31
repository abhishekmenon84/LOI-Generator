import test from "node:test";
import assert from "node:assert/strict";
import { getOrgLimits, PERSONAL_TIERS, BUSINESS_SEAT_TIERS, checkAndIncrementUsage } from "../lib/orgBilling.js";

test("getOrgLimits: personal free tier cannot create, export, or e-sign", () => {
  const org = { isPersonal: true, planTier: "free" };
  const limits = getOrgLimits(org);
  assert.equal(limits.canView, true);
  assert.equal(limits.canCreate, false);
  assert.equal(limits.canExport, false);
  assert.equal(limits.canEsign, false);
  assert.equal(limits.hasAudit, false);
  assert.equal(limits.hasBranding, false);
});

test("getOrgLimits: personal_premium allows creation with documented limits", () => {
  const org = { isPersonal: true, planTier: "personal_premium" };
  const limits = getOrgLimits(org);
  assert.equal(limits.canCreate, true);
  assert.equal(limits.canExport, true);
  assert.equal(limits.canEsign, true);
  assert.equal(limits.hasAudit, true);
  assert.equal(limits.hasBranding, true);
  assert.equal(limits.documentsPerPeriod, 5);
  assert.equal(limits.templatesMax, 1);
  assert.equal(limits.esignPerPeriod, 15);
  assert.equal(limits.retentionYears, 1);
});

test("getOrgLimits: personal_premium_plus has higher limits than personal_premium", () => {
  const limits = getOrgLimits({ isPersonal: true, planTier: "personal_premium_plus" });
  assert.equal(limits.documentsPerPeriod, 15);
  assert.equal(limits.templatesMax, 10);
  assert.equal(limits.esignPerPeriod, 30);
});

test("getOrgLimits: business org (any active seat tier) is unlimited with 3-year retention", () => {
  const limits = getOrgLimits({ isPersonal: false, planTier: "tier_1_10" });
  assert.equal(limits.canCreate, true);
  assert.equal(limits.canExport, true);
  assert.equal(limits.canEsign, true);
  assert.equal(limits.hasAudit, true);
  assert.equal(limits.hasBranding, true);
  assert.equal(limits.documentsPerPeriod, Infinity);
  assert.equal(limits.templatesMax, Infinity);
  assert.equal(limits.esignPerPeriod, Infinity);
  assert.equal(limits.retentionYears, 3);
});

test("getOrgLimits: business org honors a negotiated retentionYears override above the 3-year default", () => {
  const limits = getOrgLimits({ isPersonal: false, planTier: "tier_1_10", retentionYears: 7 });
  assert.equal(limits.retentionYears, 7);
});

test("getOrgLimits: expired business org cannot create or export", () => {
  const limits = getOrgLimits({ isPersonal: false, planTier: "expired" });
  assert.equal(limits.canCreate, false);
  assert.equal(limits.canExport, false);
});

test("PERSONAL_TIERS and BUSINESS_SEAT_TIERS have the exact prices from the spec", () => {
  assert.equal(PERSONAL_TIERS.find((t) => t.key === "personal_premium").priceCents, 1500);
  assert.equal(PERSONAL_TIERS.find((t) => t.key === "personal_premium_plus").priceCents, 3000);
  assert.equal(BUSINESS_SEAT_TIERS.find((t) => t.key === "tier_1_10").priceCents, 30000);
  assert.equal(BUSINESS_SEAT_TIERS.find((t) => t.key === "tier_11_30").priceCents, 75000);
  assert.equal(BUSINESS_SEAT_TIERS.find((t) => t.key === "tier_31_50").priceCents, 100000);
  assert.equal(BUSINESS_SEAT_TIERS.find((t) => t.key === "tier_51_100").priceCents, 150000);
});

test("checkAndIncrementUsage: business org always succeeds without touching UsageCounter", async () => {
  const result = await checkAndIncrementUsage("fake-business-org-id", "document", { isPersonal: false, planTier: "tier_1_10" });
  assert.equal(result.ok, true);
});
