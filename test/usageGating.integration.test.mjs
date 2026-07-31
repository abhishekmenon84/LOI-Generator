// These are documented MANUAL verification steps, not automated tests --
// they require a real authenticated session, a real Folder/Org, and
// hitting real Next.js API routes, which is out of scope for this
// project's node:test unit suite (no test-server harness exists yet).
// Run these by hand against `npm run dev` after this lands:
//
// 1. Create a personal org, set planTier to "free" directly in the DB.
//    POST /api/ledgers with a valid folderId -> expect 402, code
//    "UPGRADE_REQUIRED".
// 2. Set planTier to "personal_premium". POST /api/ledgers 5 times ->
//    all succeed. 6th attempt -> 402, code "USAGE_LIMIT_REACHED".
// 3. POST /api/templates (FormTemplate) once -> succeeds. Second attempt
//    -> 402, code "TEMPLATE_LIMIT_REACHED" (personal_premium's
//    templatesMax is 1).
// 4. POST /api/ledgers/[id]/signature-request 15 times on a
//    personal_premium org -> all succeed. 16th -> 402, code
//    "USAGE_LIMIT_REACHED".
// 5. Repeat steps 2-4 against a business org on any active seat tier --
//    all attempts succeed with no limit ever hit.
import test from "node:test";
test("see file header for manual verification steps", () => {});
