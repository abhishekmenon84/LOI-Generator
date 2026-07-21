# Legal document assets

## nb-residential-lease-attachment-a.pdf

This is currently a **placeholder** (8 pages of "PLACEHOLDER" text), generated during
implementation so the PDF-merge and zip-bundling code paths could be built and tested
before the real document was available.

**Before the Residential Lease template goes live**, replace this file with the official
New Brunswick government Attachment A PDF (Form 6, Parts 1-9, "Additional Information")
from the Residential Tenancies Tribunal. The replacement must:

- Keep the exact filename `nb-residential-lease-attachment-a.pdf` (referenced by path in
  `app/api/export/residential-lease/pdf/route.js` and the docx/gdoc routes).
- Be the complete, unmodified government document — this tool never edits or regenerates
  Attachment A's content, per the form's own legal notice that alterations are void.

No code changes are needed to swap the file — the merge/zip logic reads it by path at
request time.
