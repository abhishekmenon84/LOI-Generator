import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { findSignatureLines } from "./findSignatureLines";
import { findBestNameForLine } from "./signatureAnchors.js";

// Fixed constant date so burnSignatures() output is byte-deterministic given
// the same pdfBuffer/signedSlots input. Matches the epoch constant used in
// lib/pdfBuilder.jsx for the same reason. Without this, pdf-lib's
// PDFDocument.load(...) unconditionally calls updateInfoDict() (see
// node_modules/pdf-lib/cjs/api/PDFDocument.js ~line 1335-1344), which stamps
// both ModificationDate (always) and CreationDate (if unset) with
// `new Date()`, so doc.save() below would still produce a different buffer
// on every call even for byte-identical input — breaking the tamper-detection
// hash comparison in lib/signatureFinalize.js / app/api/verify/[verifyCode].
const PDF_FIXED_DATE = new Date(0);

// Matches a found signature line to whichever unmatched signer's name
// appears in that line's nearby text (see findSignatureLines.js's comment
// on why `nearbyText` covers both this app's markup patterns). Each slot
// can only be claimed once, by its first (topmost) matching line.
// findBestNameForLine is shared with the preview route (see
// lib/signatureAnchors.js), which needs the identical matching logic
// before any SignerSlot exists yet.
function findBestSlotForLine(line, unmatchedSlots) {
  const name = findBestNameForLine(line, unmatchedSlots.map((s) => s.name));
  return name ? unmatchedSlots.find((s) => s.name === name) : null;
}

// Burns each signer's captured signature image onto the final PDF. Two
// paths:
//  - Anchor-aware (built-in doc types: purchase_loi, commercial_lease,
//    residential_lease): locates each document's own signature-line
//    placeholders via findSignatureLines() (a real PDF text-content scan,
//    not a hardcoded coordinate -- these documents are laid out with
//    @react-pdf/renderer's flowing layout, so a line's position varies
//    per document instance) and draws each signer's image directly above
//    their matched line. If a line can't be confidently matched to any
//    signer (e.g. a document type change since Task 1, or a name that
//    doesn't appear verbatim in the rendered text), that signer falls
//    back to the trailing signature page below -- never silently dropped.
//  - Trailing page (custom_template/form_template, and any built-in signer
//    that couldn't be anchor-matched): appended exactly as before.
export async function burnSignatures(pdfBuffer, signedSlots) {
  const doc = await PDFDocument.load(pdfBuffer);
  doc.setCreationDate(PDF_FIXED_DATE);
  doc.setModificationDate(PDF_FIXED_DATE);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let unplacedSlots = [...signedSlots];

  try {
    const lines = await findSignatureLines(pdfBuffer);
    if (lines.length > 0) {
      const pages = doc.getPages();
      const stillUnplaced = [];
      const claimedSlotIds = new Set();

      for (const line of lines) {
        const available = unplacedSlots.filter((s) => !claimedSlotIds.has(s));
        const slot = findBestSlotForLine(line, available);
        if (!slot) continue;
        claimedSlotIds.add(slot);

        const page = pages[line.page];
        if (!page) continue;

        if (slot.signatureImageDataUrl && slot.signatureImageDataUrl.startsWith("data:image/png")) {
          try {
            const base64 = slot.signatureImageDataUrl.split(",")[1];
            const pngBytes = Buffer.from(base64, "base64");
            const pngImage = await doc.embedPng(pngBytes);
            // Fit the signature image just above the line, scaled to the
            // line's own width so it never overlaps neighboring text.
            const maxWidth = Math.max(line.width, 80);
            const scale = Math.min(maxWidth / pngImage.width, 24 / pngImage.height);
            const w = pngImage.width * scale;
            const h = pngImage.height * scale;
            page.drawImage(pngImage, { x: line.x, y: line.y + line.height + 2, width: w, height: h });
          } catch (err) {
            page.drawText("[signature image could not be rendered]", { x: line.x, y: line.y + line.height + 4, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
          }
        }
        page.drawText(`Signed: ${slot.signedAt}`, { x: line.x, y: Math.max(line.y - 10, 20), size: 7, font, color: rgb(0.4, 0.4, 0.4) });
      }

      unplacedSlots = unplacedSlots.filter((s) => !claimedSlotIds.has(s));
    }
  } catch (err) {
    // Anchor detection failing (e.g. an unexpected PDF structure) must
    // never break signing entirely -- fall back to the trailing page for
    // every signer instead.
    console.error("burnSignatures: anchor-based placement failed, falling back to trailing page:", err.message);
  }

  if (unplacedSlots.length > 0) {
    const page = doc.addPage([612, 792]);
    let y = 740;
    page.drawText("Signatures", { x: 50, y, size: 16, font: boldFont, color: rgb(0, 0, 0) });
    y -= 40;

    for (const slot of unplacedSlots) {
      if (y < 160) {
        y = 740;
      }
      const roleLabel = slot.roleLabel;
      page.drawText(`${slot.name} — ${roleLabel}`, { x: 50, y, size: 11, font: boldFont, color: rgb(0, 0, 0) });
      y -= 18;

      if (slot.signatureImageDataUrl && slot.signatureImageDataUrl.startsWith("data:image/png")) {
        try {
          const base64 = slot.signatureImageDataUrl.split(",")[1];
          const pngBytes = Buffer.from(base64, "base64");
          const pngImage = await doc.embedPng(pngBytes);
          const scaled = pngImage.scale(0.35);
          page.drawImage(pngImage, { x: 50, y: y - scaled.height, width: scaled.width, height: scaled.height });
          y -= scaled.height + 10;
        } catch (err) {
          page.drawText("[signature image could not be rendered]", { x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
          y -= 16;
        }
      }

      page.drawText(`Signed: ${slot.signedAt}`, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 30;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
