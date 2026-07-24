import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Burns each signer's captured signature image and role label onto the
// final PDF. For this round, without per-document anchor coordinates (that
// concept belongs to the still-unbuilt custom-templates round), signatures
// are appended as a dedicated signature page at the end of the document
// rather than positioned inline — simpler, always correct regardless of
// each document type's specific layout, and avoids needing coordinate data
// this round's built-in document types don't have.
export async function burnSignatures(pdfBuffer, signedSlots) {
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([612, 792]);
  let y = 740;
  page.drawText("Signatures", { x: 50, y, size: 16, font: boldFont, color: rgb(0, 0, 0) });
  y -= 40;

  for (const slot of signedSlots) {
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

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
