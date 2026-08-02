// These are documented MANUAL verification steps, not automated tests --
// they require a real authenticated session, a real Folder/Org, and
// hitting real Next.js API routes, which is out of scope for this
// project's node:test unit suite (no test-server harness exists yet).
// Run these by hand against `npm run dev` after this lands:
//
// 1. Fresh personal org (planTier is always "free" now -- there is no
//    subscription): POST /api/ledgers with a valid folderId -> succeeds
//    (Personal is never blocked by "no active subscription", only by the
//    daily/monthly caps below).
// 2. POST /api/ledgers 5 times in one calendar day on that org -> all 5
//    succeed. 6th attempt same day -> 402, code "USAGE_LIMIT_REACHED",
//    message mentions the daily limit of 5.
// 3. Across enough days to reach 30 total documents in the rolling
//    30-day window (without exceeding 5/day) -> the 31st document that
//    month -> 402, code "USAGE_LIMIT_REACHED", message mentions the
//    monthly limit of 30.
// 4. POST /api/templates (FormTemplate) any number of times on a personal
//    org -> always succeeds (Personal's templatesMax is now Infinity --
//    no template cap under the pay-per-document model).
// 5. POST /api/ledgers/[id]/signature-request any number of times on a
//    personal org -> always succeeds (no e-sign cap under the new
//    model).
// 6. Business org, any seat count/tier: POST /api/ledgers repeatedly,
//    well past its monthly quota (see quotaForSeatCount) -> every
//    request still succeeds (Business is never blocked by quota).
//    Inspect the org's UsageCounter row directly: pendingOverageCents
//    should start incrementing by 50 (cents) once monthCount exceeds the
//    quota, and NOT before.
import test from "node:test";
test("see file header for manual verification steps", () => {});
