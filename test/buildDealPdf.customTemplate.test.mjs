// Documented MANUAL verification steps -- buildDealPdf's custom_template
// branch needs a real database row (CustomTemplate + TemplateAnchor +
// Ledger), a real blob-hosted PDF URL, and Next.js's module resolution
// for lib/prisma -- out of scope for this project's node:test unit
// suite, matching the existing convention (e.g.
// test/usageGating.integration.test.mjs) for DB-dependent route/pipeline
// behavior in this codebase.
//
// Run these by hand against a local dev database after this lands:
// 1. Create (or reuse) a CustomTemplate with at least one text anchor
//    and one checkbox anchor.
// 2. Create a Ledger with documentType "custom_template" and
//    formData.templateId set to that template's id, plus
//    formData.customTemplateAnswers with answers for those anchors.
// 3. Call buildDealPdf(ledger) directly (e.g. via a one-off node -e
//    script importing lib/signatureFinalize.js) and confirm it resolves
//    to a Buffer, not a thrown error.
// 4. Save that buffer to a .pdf file and open it -- confirm the text
//    answer appears near its anchor's position and the checkbox shows a
//    mark only where answered true.
import test from "node:test";
test("see file header for manual verification steps", () => {});
