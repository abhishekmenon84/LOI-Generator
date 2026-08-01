// Documented MANUAL verification steps -- this route needs a real
// authenticated session (NextAuth cookie), which node:test cannot
// establish without a running Next.js server and a real sign-in flow,
// matching the existing convention (e.g. test/usageGating.integration.test.mjs)
// for session-dependent route behavior in this codebase.
//
// Run these by hand against `npm run dev` after this lands, signed in
// as a real user:
// 1. GET /api/users/me -> 200, returns { id, email, name, phone,
//    licenseNumber, image, signatureImageUrl } with phone/licenseNumber/
//    signatureImageUrl all null for a fresh user.
// 2. PATCH /api/users/me with { name: "Jane Realtor", phone: "555-0100",
//    licenseNumber: "NB-12345" } -> 200, all three fields set in the
//    response.
// 3. PATCH /api/users/me with { phone: null } -> 200, phone is null in
//    the response, name/licenseNumber from step 2 unchanged.
// 4. GET /api/users/me without a valid session (e.g. a private/incognito
//    request) -> 401.
import test from "node:test";
test("see file header for manual verification steps", () => {});
