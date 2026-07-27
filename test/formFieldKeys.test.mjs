import test from "node:test";
import assert from "node:assert/strict";
import { slugifyLabel, uniqueKey, labelForBox } from "../lib/formFieldKeys.js";

test("slugifyLabel normalizes to snake_case", () => {
  assert.equal(slugifyLabel("The Buyer"), "the_buyer");
  assert.equal(slugifyLabel("PID(s):"), "pid_s");
  assert.equal(slugifyLabel("  Purchase   Price  "), "purchase_price");
});

test("slugifyLabel survives ligature corruption and empty input", () => {
  // pdf.js extracts "Association" from these PDFs as "AssociaƟon"
  assert.equal(slugifyLabel("AssociaƟon"), "associa_on");
  assert.equal(slugifyLabel(""), "field");
  assert.equal(slugifyLabel("___"), "field");
});

test("uniqueKey appends a counter only on collision", () => {
  const taken = new Set();
  assert.equal(uniqueKey("buyer", taken), "buyer");
  taken.add("buyer");
  assert.equal(uniqueKey("buyer", taken), "buyer_2");
  taken.add("buyer_2");
  assert.equal(uniqueKey("buyer", taken), "buyer_3");
});

test("labelForBox picks the nearest text to the LEFT on the same line", () => {
  const items = [
    { str: "The Buyer", xPct: 4, yPct: 50, widthPct: 12 },
    { str: "Seller", xPct: 4, yPct: 70, widthPct: 8 },
  ];
  const box = { xPct: 20, yPct: 50, widthPct: 60, heightPct: 2 };
  assert.equal(labelForBox(box, items), "The Buyer");
});

test("labelForBox falls back when no text is near", () => {
  assert.equal(labelForBox({ xPct: 20, yPct: 5, widthPct: 10, heightPct: 2 }, []), "");
});
