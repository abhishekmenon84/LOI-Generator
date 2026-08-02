import { NextResponse } from "next/server";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup } from "pdf-lib";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { uploadFile } from "../../../../../lib/blobStorage";

// Classifies an AcroForm field by its concrete class using `instanceof`
// rather than `field.constructor.name`. Next.js production builds minify
// pdf-lib's bundle, which renames classes like `PDFTextField` to
// single-letter identifiers -- `constructor.name` would silently return the
// minified name (e.g. "e") and never match a string-keyed map, causing every
// field to fall through to the default. `instanceof` compares against the
// actual class reference (not its stringified name), so it survives
// minification.
function classifyField(field) {
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFTextField) return "text";
  return "text";
}

// Resolves the page index (0-based) that a given AcroForm widget annotation
// is rendered on.
//
// pdf-lib's widget objects (as returned by `acroField.getWidgets()`) are
// built via `PDFWidgetAnnotation.fromDict(dict)` and do NOT retain their own
// PDFRef, so we can't look the widget up by identity from the outside.
// Instead we use two complementary strategies, verified against the
// installed pdf-lib 1.17.1 API (node_modules/pdf-lib/cjs/core/annotation/
// PDFWidgetAnnotation.d.ts and PDFAnnotation.d.ts):
//
//   1. `widget.P()` returns the widget's optional `/P` (page) entry as a
//      PDFRef. When present, we compare it (via `.toString()`, since PDFRef
//      instances for the same object number/generation are not guaranteed
//      to be the same JS object reference across lookups) against each
//      page's `.ref.toString()`.
//   2. If `/P` is absent (common — it's optional in the PDF spec and many
//      generators omit it, especially for single-page forms), we fall back
//      to scanning each page's `/Annots` array and resolving each entry to
//      a PDFDict via the shared PDFContext, comparing by object identity
//      (`===`) against `widget.dict`. PDFContext interns dicts per indirect
//      reference, so a dict resolved twice from the same ref is the same JS
//      object -- this makes identity comparison reliable here.
//
// Falls back to page 0 if neither strategy resolves (rare, only for
// malformed PDFs), rather than crashing the whole upload.
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

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!folder._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this folder." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  let uploaded;
  try {
    uploaded = await uploadFile(buffer, file.name, mimeType);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  let pageCount = null;
  let fieldTier = "plain";
  const anchorsToCreate = [];

  if (mimeType === "application/pdf") {
    try {
      const pdfDoc = await PDFDocument.load(buffer);
      pageCount = pdfDoc.getPageCount();
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      if (fields.length > 0) {
        for (const field of fields) {
          // Each field's rectangle/page resolution is isolated in its own
          // try/catch: `getRectangle()` genuinely throws on a malformed
          // /Rect in real-world PDFs, and one bad widget must not discard
          // the anchors already successfully built for every other field.
          try {
            const type = classifyField(field);
            const widget = field.acroField.getWidgets()[0];
            if (!widget) continue;
            const rect = widget.getRectangle();
            const pageIndex = resolveWidgetPageIndex(pdfDoc, widget);
            const page = pdfDoc.getPage(pageIndex);
            const { width: pw, height: ph } = page.getSize();

            const xPct = (rect.x / pw) * 100;
            const widthPct = (rect.width / pw) * 100;
            const heightPct = (rect.height / ph) * 100;
            // PDF rectangles are measured from the page's BOTTOM-left
            // origin (rect.y = distance up from the bottom), but this
            // value will be consumed as a CSS `top` percentage (measured
            // from the page's TOP) by the anchor editor UI. Convert here
            // so `yPct` always means "distance from the top" -- do not
            // revert this to the raw bottom-origin value.
            const yPctFromBottom = (rect.y / ph) * 100;
            const yPct = 100 - yPctFromBottom - heightPct;

            anchorsToCreate.push({
              type,
              label: field.getName(),
              page: pageIndex,
              xPct,
              yPct,
              widthPct,
              heightPct,
            });
          } catch (fieldErr) {
            // Skip this one malformed field; keep processing the rest.
            continue;
          }
        }
        if (anchorsToCreate.length > 0) {
          fieldTier = "auto_detected";
        }
      }
    } catch (err) {
      // Not a valid/parseable PDF form structure -- fall back to plain
      // attachment rather than failing the whole upload.
      fieldTier = "plain";
    }
  }

  // Strip the file extension from the stored/displayed name (".pdf",
  // ".docx", etc) -- matches the convention NewTemplateForm.jsx and
  // KeeperTemplates.jsx already use for their own upload flows
  // (`file.name.replace(/\.pdf$/i, "")`), generalized here to any
  // extension since this route accepts any file type, not just PDFs.
  const displayName = file.name.replace(/\.[^./\\]+$/, "") || file.name;

  const created = await prisma.folderFile.create({
    data: {
      folderId: folder.id,
      name: displayName,
      fileUrl: uploaded.url,
      mimeType,
      pageCount,
      fieldTier,
      uploadedByUserId: session.user.id,
      anchors: { create: anchorsToCreate },
    },
    include: { anchors: true },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  const files = await prisma.folderFile.findMany({
    where: { folderId: folder.id },
    select: { id: true, name: true, mimeType: true, fieldTier: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ files });
}
