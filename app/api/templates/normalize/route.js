import { NextResponse } from "next/server";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup } from "pdf-lib";
import { auth } from "../../../../lib/auth";
import { uploadFile } from "../../../../lib/blobStorage";
import { normalizePdf } from "../../../../lib/pdfNormalize";

// Server-side first stage of the template-creation pipeline (Task 9): given
// a raw uploaded PDF, (a) checks for real AcroForm fields on the ORIGINAL
// bytes -- normalizePdf's raster fallback rasterizes pages to images and
// would destroy any AcroForm fields, so this must happen before/independent
// of normalization -- and (b) normalizes + uploads the PDF so the client
// always gets back a pdf-lib-loadable, blob-hosted URL to hand to
// AnchorEditor. The client (app/templates/new/page.js) decides what to do
// next based on `sourceTier`: "acroform" means skip ML detection entirely
// (exact geometry beats a guess), "detected" means run formDetect.js
// client-side against the returned pdfUrl.
//
// classifyField/resolveWidgetPageIndex are copied from the established
// pattern in app/api/folders/[id]/files/route.js (same reasoning: minified
// production builds rename pdf-lib classes, so `instanceof` is used instead
// of `constructor.name`) rather than factored into a shared module, to
// avoid touching that already-reviewed, already-shipped route as a side
// effect of this task.

function classifyField(field) {
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFTextField) return "text";
  return "text";
}

function resolveWidgetPageIndex(pdfDoc, widget) {
  const pages = pdfDoc.getPages();

  const pageRef = widget.P();
  if (pageRef) {
    const byRef = pages.findIndex((p) => p.ref.toString() === pageRef.toString());
    if (byRef >= 0) return byRef;
  }

  for (let i = 0; i < pages.length; i++) {
    const annots = pages[i].node.Annots();
    if (!annots) continue;
    for (let j = 0; j < annots.size(); j++) {
      const dict = annots.lookup(j);
      if (dict === widget.dict) return i;
    }
  }

  return 0;
}

// Extracts AcroForm fields from `buffer` as anchor-shaped objects (0-based
// page, percentage geometry, top-origin yPct -- same conventions as
// app/api/folders/[id]/files/route.js). Returns [] on any failure or when
// the PDF has no AcroForm at all (the common case for this project's real
// form corpus, which is flat and encrypted -- see lib/pdfNormalize.js).
//
// Iterates over EVERY widget a field has, not just the first
// (getWidgets()[0]). A single logical AcroForm field can legitimately have
// several widget annotations:
//   - A PDFRadioGroup's options are each their own widget sharing one
//     field name -- taking only the first widget silently drops every
//     other option and mislabels the one box that survives as if it were
//     the whole field.
//   - Any field type can be "multi-widget" (the same logical field
//     repeated across pages, e.g. an initials box on every page) -- taking
//     only the first widget drops every occurrence after the first page.
// One anchor is emitted per widget. For a radio group, every option's
// anchor shares `radioGroup = field.getName()` (the field name is the
// natural, already-available stable identifier tying the options
// together) so the group renders as a single logical choice in
// AnchorEditor, matching how app/templates/new/page.js's own ML-detected
// checkbox grouping sets radioGroup for the "detected" sourceTier.
async function extractAcroFormFields(buffer) {
  const fields = [];
  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(buffer);
  } catch {
    return fields;
  }

  const form = pdfDoc.getForm();
  const acroFields = form.getFields();
  for (const field of acroFields) {
    const type = classifyField(field);
    const radioGroup = type === "radio" ? field.getName() : "";
    const widgets = field.acroField.getWidgets();

    for (const widget of widgets) {
      // Each widget's rectangle/page resolution is isolated in its own
      // try/catch (matching app/api/folders/[id]/files/route.js): one
      // malformed widget must not discard the anchors already built for
      // every other widget of this same field, let alone every other
      // field.
      try {
        const rect = widget.getRectangle();
        const pageIndex = resolveWidgetPageIndex(pdfDoc, widget);
        const page = pdfDoc.getPage(pageIndex);
        const { width: pw, height: ph } = page.getSize();

        const xPct = (rect.x / pw) * 100;
        const widthPct = (rect.width / pw) * 100;
        const heightPct = (rect.height / ph) * 100;
        const yPctFromBottom = (rect.y / ph) * 100;
        const yPct = 100 - yPctFromBottom - heightPct;

        fields.push({
          type,
          label: field.getName(),
          page: pageIndex,
          xPct,
          yPct,
          widthPct,
          heightPct,
          required: false,
          radioGroup,
          signerRole: "",
          confidence: null,
        });
      } catch {
        continue;
      }
    }
  }
  return fields;
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const acroFields = await extractAcroFormFields(buffer);
  const sourceTier = acroFields.length > 0 ? "acroform" : "detected";

  let normalized;
  try {
    normalized = await normalizePdf(buffer, file.name);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  let uploaded;
  try {
    uploaded = await uploadFile(Buffer.from(normalized.bytes), file.name, "application/pdf");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({
    pdfUrl: uploaded.url,
    pageCount: normalized.pageCount,
    strategy: normalized.strategy,
    sourceTier,
    acroFields: sourceTier === "acroform" ? acroFields : [],
  });
}
