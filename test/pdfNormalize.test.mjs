import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { normalizePdf } from "../lib/pdfNormalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_FILE = path.join(
  __dirname,
  "..",
  "Design",
  "forms",
  "Fulfillment and_or Waiver of Conditions.pdf"
);

test("normalizePdf takes the passthrough branch for an ordinary unencrypted PDF", async () => {
  // Synthesize a plain PDF in-test (not committed) rather than depending on
  // a fixture file: create a two-page unencrypted document with pdf-lib.
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  const bytes = await doc.save();

  const result = await normalizePdf(bytes, "synthetic-passthrough.pdf");

  assert.equal(result.strategy, "passthrough");
  assert.equal(result.pageCount, 2);

  const reloaded = await PDFDocument.load(result.bytes);
  assert.equal(reloaded.getPageCount(), 2);
});

test("normalizePdf takes the raster branch for a real encrypted corpus PDF", async () => {
  const bytes = fs.readFileSync(CORPUS_FILE);

  const result = await normalizePdf(
    bytes,
    "Fulfillment and_or Waiver of Conditions.pdf"
  );

  assert.equal(result.strategy, "raster");
  assert.equal(result.pageCount, 1);

  const reloaded = await PDFDocument.load(result.bytes);
  assert.equal(reloaded.getPageCount(), 1);
});
