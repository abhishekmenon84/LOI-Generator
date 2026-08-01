import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Fixed constant date so stampCustomTemplate's output is byte-deterministic
// given the same inputs, matching lib/pdfSignatureBurn.js's and
// lib/pdfBuilder.jsx's identical convention -- pdf-lib's PDFDocument.load
// unconditionally stamps ModificationDate (and CreationDate if unset) with
// `new Date()` otherwise, which would break the tamper-detection hash
// comparison in lib/signatureFinalize.js / lib/signatureEngine.js.
const PDF_FIXED_DATE = new Date(0);

// Converts an anchor's top-left-origin percentage geometry into PDF
// point coordinates. Inverse of the extraction math in
// app/api/templates/normalize/route.js's extractAcroFormFields (that
// route computes `yPct = 100 - yPctFromBottom - heightPct` from a known
// PDF-space rect; this is that same equation solved for the PDF-space
// bottom-left y, which is what pdf-lib's drawText/drawRectangle expect).
function anchorRectToPoints(anchor, pageWidth, pageHeight) {
  const x = (anchor.xPct / 100) * pageWidth;
  const width = (anchor.widthPct / 100) * pageWidth;
  const height = (anchor.heightPct / 100) * pageHeight;
  const yPctFromBottom = 100 - anchor.yPct - anchor.heightPct;
  const y = (yPctFromBottom / 100) * pageHeight;
  return { x, y, width, height };
}

// Shrinks font size until the given text fits within `maxWidth` at a given
// font, down to a minimum readable size -- no new font-metrics system,
// just pdf-lib's own font.widthOfTextAtSize in a small bounded loop.
function fitFontSize(font, text, maxWidth, startSize) {
  const MIN_SIZE = 6;
  let size = startSize;
  while (size > MIN_SIZE && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function drawTextAnswer(page, font, anchor, rect, value) {
  const text = String(value ?? "");
  if (!text) return;
  const fontSize = fitFontSize(font, text, rect.width, Math.min(11, rect.height * 0.6 || 11));
  page.drawText(text, {
    x: rect.x + 2,
    y: rect.y + Math.max(0, (rect.height - fontSize) / 2),
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawCheckboxAnswer(page, boldFont, rect, checked) {
  if (!checked) return;
  const fontSize = Math.min(rect.width, rect.height) * 0.9 || 10;
  page.drawText("X", {
    x: rect.x + rect.width * 0.15,
    y: rect.y + rect.height * 0.15,
    size: fontSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
}

// Draws each answered, non-signature/initials anchor onto the PDF at its
// position. Every anchor is stamped independently inside its own
// try/catch (mirrors lib/pdfSignatureBurn.js's per-slot try/catch for
// signature images) -- one malformed anchor (e.g. referencing a page
// index the document doesn't have) must never fail the whole export.
export async function stampCustomTemplate(pdfBuffer, anchors, answers) {
  const doc = await PDFDocument.load(pdfBuffer);
  doc.setCreationDate(PDF_FIXED_DATE);
  doc.setModificationDate(PDF_FIXED_DATE);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const anchor of anchors || []) {
    if (anchor.type === "signature" || anchor.type === "initials") continue;

    try {
      const page = pages[anchor.page];
      if (!page) continue; // out-of-range page reference: skip, not fatal

      const { width: pageWidth, height: pageHeight } = page.getSize();
      const rect = anchorRectToPoints(anchor, pageWidth, pageHeight);
      const answer = answers ? answers[anchor.id] : undefined;

      if (anchor.type === "text" || anchor.type === "date") {
        drawTextAnswer(page, font, anchor, rect, answer);
      } else if (anchor.type === "checkbox" || anchor.type === "radio") {
        drawCheckboxAnswer(page, boldFont, rect, !!answer);
      }
    } catch (err) {
      console.error(`stampCustomTemplate: failed to stamp anchor ${anchor?.id}:`, err.message);
      continue;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
