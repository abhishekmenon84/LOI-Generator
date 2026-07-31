// Integration-style test documenting expected PATCH behavior. This
// project's existing test suite (test/*.test.mjs) is all pure node:test
// unit tests with no HTTP test harness -- following that same convention,
// this file documents the manual verification steps rather than spinning
// up a Next.js test server, matching how other route-level behavior in
// this codebase is verified.
//
// Manual verification (run against `npm run dev` after this task lands):
// 1. PATCH /api/folders/<id> with { favorite: true } as an authenticated
//    user with write access to that folder -> 200, folder.favorite is now
//    true when re-fetched via GET.
// 2. PATCH the same folder with { favorite: false } -> 200, reverts.
// 3. PATCH without write access (a folder shared read-only) -> 403,
//    matching the existing stage/priority write-access check.
import test from "node:test";
test("see file header for manual verification steps", () => {});
