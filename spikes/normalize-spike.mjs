// Throwaway spike: probe PDF normalization paths against the real form corpus.
// See .superpowers/sdd/2026-07-27-universal-form-framework/task-1-brief.md
//
// Step 1/2: for each corpus PDF, try loading it directly with pdf-lib.
// Step 3: determine whether pdf.js can rasterize pages in Node (via the
// @napi-rs/canvas optional dependency it already declares) or whether
// rendering must happen in the browser.
//
// IMPORTANT: this script does NOT install anything. @napi-rs/canvas is
// already present in node_modules because pdfjs-dist lists it as an
// `optionalDependencies` entry, and npm resolved/installed it automatically
// for this platform (darwin-arm64) when node_modules was populated. We are
// only using what's already there to get a verified answer instead of an
// inferred one.

import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";

const DIR = "Design/forms";

async function tryPdfLib(buf) {
  try {
    const doc = await PDFDocument.load(buf);
    const out = await doc.save();
    return { ok: true, bytes: out.length };
  } catch (err) {
    return { ok: false, error: err.message.slice(0, 80) };
  }
}

async function tryPdfLibIgnoreEncryption(buf) {
  try {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const out = await doc.save();
    return { ok: true, bytes: out.length };
  } catch (err) {
    return { ok: false, error: err.message.slice(0, 80) };
  }
}

// --- Step 3: can pdf.js rasterize a page in Node? ---
async function tryNodeRender(buf) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let NodeCanvasFactory;
  try {
    ({ NodeCanvasFactory } = await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    ));
  } catch {
    // fall through; we build our own factory below using @napi-rs/canvas directly
  }

  const { createCanvas } = await import("@napi-rs/canvas");

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buf),
    // Corpus PDFs are RC4-encrypted with (per prior investigation) no
    // user password required for reading text/rendering.
    isEvalSupported: false,
  });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });

  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height)
  );
  const ctx = canvas.getContext("2d");

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    // pdf.js's render() also wants a "canvas factory" style object in some
    // versions; @napi-rs/canvas's context is Canvas2D-API-compatible so we
    // pass the 2d context directly, mirroring pdf.js's own Node examples.
  });
  await renderTask.promise;

  const pngBuffer = canvas.toBuffer("image/png");
  const pageCount = pdfDoc.numPages;
  if (typeof pdfDoc.destroy === "function") {
    await pdfDoc.destroy();
  } else if (typeof loadingTask.destroy === "function") {
    await loadingTask.destroy();
  }
  return { ok: true, pngBytes: pngBuffer.length, pageCount };
}

const results = [];

for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith(".pdf"))) {
  const buf = fs.readFileSync(path.join(DIR, name));
  const direct = await tryPdfLib(buf);
  const ignoreEnc = await tryPdfLibIgnoreEncryption(buf);

  let render;
  try {
    render = await tryNodeRender(buf);
  } catch (err) {
    render = { ok: false, error: (err && err.message ? err.message : String(err)).slice(0, 200) };
  }

  const row = {
    name,
    sourceBytes: buf.length,
    pdfLibDirect: direct,
    pdfLibIgnoreEncryption: ignoreEnc,
    nodeRasterViaNapiCanvas: render,
  };
  results.push(row);
  console.log(name, "|", JSON.stringify(row));
}

console.log("\n--- summary ---");
console.log(JSON.stringify(results, null, 2));
