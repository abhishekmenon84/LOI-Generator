import { PDFDocument } from "pdf-lib";
import { readFile } from "fs/promises";

// Byte-merges a generated PDF (as a Buffer, e.g. from @react-pdf/renderer) with
// a static PDF file on disk (e.g. the fixed Attachment A document), producing
// one combined PDF with the generated pages first, followed by the static
// file's pages in their original order. Neither input PDF's content is
// modified — pages are copied as-is.
export async function mergePdfBuffers(primaryBuffer, staticFilePath) {
  const mergedDoc = await PDFDocument.create();

  const primaryDoc = await PDFDocument.load(primaryBuffer);
  const primaryPages = await mergedDoc.copyPages(primaryDoc, primaryDoc.getPageIndices());
  primaryPages.forEach((page) => mergedDoc.addPage(page));

  const staticBytes = await readFile(staticFilePath);
  const staticDoc = await PDFDocument.load(staticBytes);
  const staticPages = await mergedDoc.copyPages(staticDoc, staticDoc.getPageIndices());
  staticPages.forEach((page) => mergedDoc.addPage(page));

  const mergedBytes = await mergedDoc.save();
  return Buffer.from(mergedBytes);
}
