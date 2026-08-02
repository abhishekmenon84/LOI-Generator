import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Mirrors lib/customTemplateStamp.js exactly, adapted for FormField's shape:
// answers are keyed by FormField.key (a slugified, unique-per-template
// string) instead of TemplateAnchor's bare `id`, since FormField already has
// a stable natural key field where TemplateAnchor does not.
const PDF_FIXED_DATE = new Date(0);

function fieldRectToPoints(field, pageWidth, pageHeight) {
  const x = (field.xPct / 100) * pageWidth;
  const width = (field.widthPct / 100) * pageWidth;
  const height = (field.heightPct / 100) * pageHeight;
  const yPctFromBottom = 100 - field.yPct - field.heightPct;
  const y = (yPctFromBottom / 100) * pageHeight;
  return { x, y, width, height };
}

function fitFontSize(font, text, maxWidth, startSize) {
  const MIN_SIZE = 6;
  let size = startSize;
  while (size > MIN_SIZE && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function drawTextAnswer(page, font, rect, value) {
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

// Draws each answered, non-signature/initials FormField onto the PDF at its
// position (signature/initials fields are burned in separately once every
// signer has signed, same as CustomTemplate). Each field is stamped inside
// its own try/catch so one malformed field can't fail the whole export.
export async function stampFormTemplate(pdfBuffer, fields, answers) {
  const doc = await PDFDocument.load(pdfBuffer);
  doc.setCreationDate(PDF_FIXED_DATE);
  doc.setModificationDate(PDF_FIXED_DATE);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const field of fields || []) {
    if (field.type === "signature" || field.type === "initials") continue;

    try {
      const page = pages[field.page];
      if (!page) continue;

      const { width: pageWidth, height: pageHeight } = page.getSize();
      const rect = fieldRectToPoints(field, pageWidth, pageHeight);
      const answer = answers ? answers[field.key] : undefined;

      if (field.type === "text" || field.type === "date") {
        drawTextAnswer(page, font, rect, answer);
      } else if (field.type === "checkbox" || field.type === "radio") {
        drawCheckboxAnswer(page, boldFont, rect, !!answer);
      }
    } catch (err) {
      console.error(`stampFormTemplate: failed to stamp field ${field?.key}:`, err.message);
      continue;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
