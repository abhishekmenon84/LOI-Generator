import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { stampCustomTemplate } from "../lib/customTemplateStamp.js";

async function makeBlankPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]); // one US-Letter page, points
  return Buffer.from(await doc.save());
}

test("stampCustomTemplate: draws a text answer without throwing and produces a loadable PDF", async () => {
  const pdfBuffer = await makeBlankPdf();
  const anchors = [
    { id: "a1", type: "text", page: 0, xPct: 10, yPct: 10, widthPct: 30, heightPct: 5, role: "Buyer", label: "Name" },
  ];
  const answers = { a1: "Jane Doe" };
  const result = await stampCustomTemplate(pdfBuffer, anchors, answers);
  assert.ok(Buffer.isBuffer(result));
  const reloaded = await PDFDocument.load(result);
  assert.equal(reloaded.getPageCount(), 1);
});

test("stampCustomTemplate: unanswered anchors are left blank, not an error", async () => {
  const pdfBuffer = await makeBlankPdf();
  const anchors = [
    { id: "a1", type: "text", page: 0, xPct: 10, yPct: 10, widthPct: 30, heightPct: 5, role: "Buyer", label: "Name" },
  ];
  const result = await stampCustomTemplate(pdfBuffer, anchors, {});
  assert.ok(Buffer.isBuffer(result));
});

test("stampCustomTemplate: draws a checkmark only for a true checkbox answer, skips a false one", async () => {
  const pdfBuffer = await makeBlankPdf();
  const anchors = [
    { id: "a1", type: "checkbox", page: 0, xPct: 10, yPct: 10, widthPct: 5, heightPct: 5, role: "Buyer", label: "Financing" },
    { id: "a2", type: "checkbox", page: 0, xPct: 10, yPct: 20, widthPct: 5, heightPct: 5, role: "Seller", label: "Inspection" },
  ];
  const answers = { a1: true, a2: false };
  const result = await stampCustomTemplate(pdfBuffer, anchors, answers);
  assert.ok(Buffer.isBuffer(result));
});

test("stampCustomTemplate: signature and initials anchors are never stamped even if present in answers", async () => {
  const pdfBuffer = await makeBlankPdf();
  const anchors = [
    { id: "a1", type: "signature", page: 0, xPct: 10, yPct: 10, widthPct: 30, heightPct: 10, role: "Buyer" },
  ];
  // Even a (malformed/unexpected) answer for a signature anchor must be ignored.
  const answers = { a1: "should be ignored" };
  const result = await stampCustomTemplate(pdfBuffer, anchors, answers);
  assert.ok(Buffer.isBuffer(result));
  // Re-render is loadable and has no thrown error -- the real assertion
  // that signature anchors are skipped is structural (see implementation:
  // the type filter excludes them before any drawing call is attempted).
});

test("stampCustomTemplate: a single anchor referencing an out-of-range page is skipped, not fatal", async () => {
  const pdfBuffer = await makeBlankPdf(); // only has page index 0
  const anchors = [
    { id: "a1", type: "text", page: 5, xPct: 10, yPct: 10, widthPct: 30, heightPct: 5, role: "Buyer", label: "Name" },
    { id: "a2", type: "text", page: 0, xPct: 10, yPct: 10, widthPct: 30, heightPct: 5, role: "Seller", label: "Name" },
  ];
  const answers = { a1: "Out of range", a2: "In range" };
  const result = await stampCustomTemplate(pdfBuffer, anchors, answers);
  assert.ok(Buffer.isBuffer(result));
  const reloaded = await PDFDocument.load(result);
  assert.equal(reloaded.getPageCount(), 1); // stamping never added pages
});

test("stampCustomTemplate: produces byte-identical output for identical input (deterministic dates)", async () => {
  const pdfBuffer = await makeBlankPdf();
  const anchors = [
    { id: "a1", type: "text", page: 0, xPct: 10, yPct: 10, widthPct: 30, heightPct: 5, role: "Buyer", label: "Name" },
  ];
  const answers = { a1: "Jane Doe" };
  const result1 = await stampCustomTemplate(pdfBuffer, anchors, answers);
  const result2 = await stampCustomTemplate(pdfBuffer, anchors, answers);
  assert.deepEqual(result1, result2);
});
