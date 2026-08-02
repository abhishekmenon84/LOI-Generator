import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Generates a standalone "Certificate of Completion" PDF -- the standard
// evidentiary artifact DocuSign/dotloop both produce alongside the signed
// document itself. Distinct from the in-app signature-audit UI panel (which
// deliberately omits IP/device/geo per PIPEDA principles 4/5 -- see
// app/api/ledgers/[id]/signature-audit/route.js): this certificate's whole
// purpose is being a complete, self-contained evidence package for a future
// dispute, so it includes everything SignatureEvent captured. It's generated
// once at finalization and emailed as an attachment, not displayed anywhere
// in the day-to-day product UI.
export async function buildCompletionCertificate({ dealName, documentHash, verifyUrl, signedSlots }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([612, 792]);
  let y = 740;

  function ensureSpace(needed) {
    if (y - needed < 60) {
      page = doc.addPage([612, 792]);
      y = 740;
    }
  }

  function text(str, { size = 10, bold = false, color = rgb(0, 0, 0), indent = 50 } = {}) {
    ensureSpace(size + 6);
    page.drawText(str, { x: indent, y, size, font: bold ? boldFont : font, color });
    y -= size + 6;
  }

  text("Certificate of Completion", { size: 20, bold: true });
  y -= 6;
  text(dealName, { size: 13, bold: true });
  y -= 10;

  text(`Document hash (SHA-256): ${documentHash}`, { size: 8, color: rgb(0.4, 0.4, 0.4) });
  text(`Verify at: ${verifyUrl}`, { size: 9, color: rgb(0.2, 0.2, 0.6) });
  y -= 14;

  text("Signers", { size: 13, bold: true });
  y -= 4;

  for (const slot of signedSlots) {
    ensureSpace(90);
    text(`${slot.name} — ${slot.roleLabel}`, { size: 11, bold: true });
    text(`Signed: ${slot.signedAt}`, { size: 9, color: rgb(0.3, 0.3, 0.3) });
    text(`IP address: ${slot.ipAddress}`, { size: 9, color: rgb(0.3, 0.3, 0.3) });
    if (slot.geoCity || slot.geoRegion || slot.geoCountry) {
      const loc = [slot.geoCity, slot.geoRegion, slot.geoCountry].filter(Boolean).join(", ");
      text(`Approximate location: ${loc}`, { size: 9, color: rgb(0.3, 0.3, 0.3) });
    }
    text(`Device/browser: ${slot.userAgent}`, { size: 8, color: rgb(0.45, 0.45, 0.45) });
    text(`Screen: ${slot.screenInfo}   Timezone offset: ${slot.timezoneOffset} min`, { size: 8, color: rgb(0.45, 0.45, 0.45) });
    text(`Per-signing document hash: ${slot.documentHash}`, { size: 8, color: rgb(0.45, 0.45, 0.45) });
    y -= 10;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
