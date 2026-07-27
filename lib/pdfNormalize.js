// Normalizes an uploaded PDF so downstream code (Task 9's template storage,
// the eventual export step) can always load it with pdf-lib.
//
// Background: the real form corpus (see Design/forms/) is flat (no
// AcroForm) and RC4-encrypted. pdf-lib cannot load these files at all --
// `PDFDocument.load()` throws, and `{ ignoreEncryption: true }` does not
// help (it fails deeper with "Expected instance of PDFDict"). pdf.js opens
// all of them fine, including reading page count and rendering, so it is
// used both as the page-count source of truth and as the raster fallback.
//
// This module runs server-side (in Node), not in the browser. Task 1's
// spike (spikes/normalize-spike.mjs) established that pdf.js can render
// pages in Node using @napi-rs/canvas, which pdfjs-dist optionally depends
// on. @napi-rs/canvas is also declared directly in this project's
// package.json (see that file's comment) so its native binary is a
// guaranteed, directly-resolved install rather than a fragile transitive
// optional dependency.
import { PDFDocument } from "pdf-lib";

// Print-resolution scale factor for rasterized fallback pages, matching the
// brief's instruction ("render each page with pdf.js at print resolution,
// scale 2").
const RASTER_SCALE = 2;

async function getPdfjs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

// Reads the true page count via pdf.js, which works on encrypted files
// unlike pdf-lib. Used regardless of which normalization strategy is taken.
async function readPageCount(bytes) {
  const pdfjsLib = await getPdfjs();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdfDoc = await loadingTask.promise;
  try {
    return pdfDoc.numPages;
  } finally {
    if (typeof pdfDoc.destroy === "function") await pdfDoc.destroy();
  }
}

// Attempts the common case: an ordinary, unencrypted PDF that pdf-lib can
// load directly. Re-saves it (rather than returning the input bytes
// untouched) so the output has gone through pdf-lib's own writer, matching
// what every other "passthrough" document downstream will look like.
async function tryPassthrough(bytes) {
  const doc = await PDFDocument.load(bytes);
  const out = await doc.save();
  return out;
}

// Fallback for files pdf-lib cannot load (e.g. the encrypted, flat corpus
// PDFs): render each page with pdf.js at print resolution, encode to PNG,
// and embed each page image into a fresh PDFDocument sized to match the
// original page's dimensions.
async function tryRaster(bytes) {
  const pdfjsLib = await getPdfjs();
  const { createCanvas } = await import("@napi-rs/canvas");

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdfDoc = await loadingTask.promise;

  const outDoc = await PDFDocument.create();

  try {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const renderViewport = page.getViewport({ scale: RASTER_SCALE });

      const canvas = createCanvas(
        Math.ceil(renderViewport.width),
        Math.ceil(renderViewport.height)
      );
      const ctx = canvas.getContext("2d");

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: renderViewport,
      });
      await renderTask.promise;

      const pngBytes = canvas.toBuffer("image/png");
      const pngImage = await outDoc.embedPng(pngBytes);

      // Size the output page to the PDF's original (unscaled) dimensions so
      // the rasterized document prints/displays at the same physical size
      // as the source, with the higher-resolution image scaled down to fit.
      const outPage = outDoc.addPage([
        unscaledViewport.width,
        unscaledViewport.height,
      ]);
      outPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: unscaledViewport.width,
        height: unscaledViewport.height,
      });
    }
  } finally {
    if (typeof pdfDoc.destroy === "function") await pdfDoc.destroy();
  }

  return outDoc.save();
}

// Normalizes `bytes` (a Buffer/Uint8Array of an uploaded PDF) so that the
// result can always be loaded by pdf-lib downstream. Tries a direct
// pdf-lib passthrough first (the common case for ordinary PDFs); falls
// back to rasterizing each page via pdf.js for PDFs pdf-lib cannot load
// (e.g. flat, encrypted forms).
//
// Returns { bytes, strategy, pageCount } where strategy is exactly
// "passthrough" or "raster".
//
// Throws, naming `filename` when available, if both paths fail -- an
// upload should fail loudly rather than store an unusable template.
export async function normalizePdf(bytes, filename) {
  const label = filename ? `"${filename}"` : "PDF";
  const pageCount = await readPageCount(bytes);

  try {
    const out = await tryPassthrough(bytes);
    return { bytes: out, strategy: "passthrough", pageCount };
  } catch (passthroughErr) {
    try {
      const out = await tryRaster(bytes);
      return { bytes: out, strategy: "raster", pageCount };
    } catch (rasterErr) {
      throw new Error(
        `normalizePdf: failed to normalize ${label} via both passthrough ` +
          `(${passthroughErr.message}) and raster (${rasterErr.message}) strategies.`
      );
    }
  }
}
