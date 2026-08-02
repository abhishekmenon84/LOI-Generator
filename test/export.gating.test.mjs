import test from "node:test";
import assert from "node:assert/strict";
import { getOrgLimits } from "../lib/orgBilling.js";

// These tests exercise the exact condition the export routes use
// (`!getOrgLimits(org).canExport`) rather than hitting the real HTTP
// routes, since those routes require a live database, an authenticated
// session, and a real Deal/Ledger row -- out of scope for a unit test.
// This locks the gating boolean itself; route-level behavior is verified
// manually against the dev server.
test("export gating: personal org (always 'free', pay-per-document, no subscription) is allowed", () => {
  const org = { isPersonal: true, planTier: "free" };
  assert.equal(getOrgLimits(org).canExport, true);
});

test("export gating: business org on active seat tier is allowed", () => {
  const org = { isPersonal: false, planTier: "growth" };
  assert.equal(getOrgLimits(org).canExport, true);
});

test("export gating: business org with expired trial is blocked", () => {
  const org = { isPersonal: false, planTier: "trial", trialEndsAt: new Date(Date.now() - 1000).toISOString() };
  assert.equal(getOrgLimits(org).canExport, false);
});
