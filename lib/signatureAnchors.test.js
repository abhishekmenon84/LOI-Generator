import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANCHOR_TYPES,
  percentBoxToPoints,
  findBestNameForLine,
  groupAnchorsBySlot,
  sanitizeSignatureAnchors,
  validateSignatureAnchors,
} from "./signatureAnchors.js";

test("ANCHOR_TYPES lists exactly the three sender-placeable types", () => {
  assert.deepEqual(ANCHOR_TYPES, ["signature", "initials", "date"]);
});

test("percentBoxToPoints converts a top-left, top-origin percent box into pdf-lib's bottom-left point space", () => {
  // A box at 10%/20% of a 200x400 page, sized 30%x5%.
  const result = percentBoxToPoints({ xPct: 10, yPct: 20, widthPct: 30, heightPct: 5 }, 200, 400);
  assert.equal(result.width, 60); // 30% of 200
  assert.equal(result.height, 20); // 5% of 400
  assert.equal(result.x, 20); // 10% of 200
  // yPct=20% from the top means the box's top edge is 80 points down from
  // the top (20% of 400). Its bottom edge (pdf-lib's y) is 80 + 20 = 100
  // points down from the top, i.e. 400 - 100 = 300 points up from the
  // bottom-left origin.
  assert.equal(result.y, 300);
});

test("findBestNameForLine returns the first unmatched name that appears in the line's nearby text", () => {
  const line = { nearbyText: "Signature of Jane Buyer: ___" };
  assert.equal(findBestNameForLine(line, ["John Seller", "Jane Buyer"]), "Jane Buyer");
});

test("findBestNameForLine returns null when no candidate name appears", () => {
  const line = { nearbyText: "Signature of Someone Else: ___" };
  assert.equal(findBestNameForLine(line, ["John Seller", "Jane Buyer"]), null);
});

test("groupAnchorsBySlot maps each anchor to the SignerSlot whose order matches signerOrder", () => {
  const slots = [{ id: "s0", order: 0 }, { id: "s1", order: 1 }];
  const anchors = [
    { signerOrder: 1, type: "signature" },
    { signerOrder: 0, type: "date" },
    { signerOrder: 99, type: "signature" }, // no matching slot -- dropped, not thrown
  ];
  const grouped = groupAnchorsBySlot(slots, anchors);
  assert.deepEqual(grouped.get("s1"), [{ signerOrder: 1, type: "signature" }]);
  assert.deepEqual(grouped.get("s0"), [{ signerOrder: 0, type: "date" }]);
  assert.equal(grouped.has("s99"), false);
});

test("groupAnchorsBySlot returns an empty Map for null/undefined input", () => {
  assert.equal(groupAnchorsBySlot([{ id: "s0", order: 0 }], null).size, 0);
  assert.equal(groupAnchorsBySlot([{ id: "s0", order: 0 }], undefined).size, 0);
});

// Regression lock for the fallback-invariant burnSignatures() relies on:
// lib/pdfSignatureBurn.js only enters its explicit-anchor drawing pass when
// `anchorsBySlot.size > 0`. Since a real end-to-end PDF isn't fabricated
// here, this asserts the gating condition itself can never fire when no
// anchors are supplied -- i.e. burnSignatures(pdfBuffer, signedSlots, null)
// (or the old 2-arg call, where signatureAnchors is undefined) must produce
// byte-identical output to what it always did before this feature existed,
// because the explicit-anchor pass is fully skipped in both cases.
test("groupAnchorsBySlot.size is always 0 when signatureAnchors is null/undefined, for any non-empty slot list (burnSignatures fallback invariant)", () => {
  const manySlots = [
    { id: "s0", order: 0 },
    { id: "s1", order: 1 },
    { id: "s2", order: 2 },
  ];
  assert.equal(groupAnchorsBySlot(manySlots, null).size, 0);
  assert.equal(groupAnchorsBySlot(manySlots, undefined).size, 0);
  // Also true for the legacy 2-arg call shape, where the caller never
  // passes a third argument at all.
  assert.equal(groupAnchorsBySlot(manySlots).size, 0);
});

test("sanitizeSignatureAnchors strips unknown keys and coerces to the exact stored shape", () => {
  const raw = [{ signerOrder: 0, type: "signature", page: 1, xPct: 10, yPct: 20, widthPct: 12, heightPct: 4, _cid: "junk", extra: "nope" }];
  assert.deepEqual(sanitizeSignatureAnchors(raw), [
    { signerOrder: 0, type: "signature", page: 1, xPct: 10, yPct: 20, widthPct: 12, heightPct: 4 },
  ]);
});

test("validateSignatureAnchors passes when every signer has a signature anchor and all fields are in range", () => {
  const anchors = [
    { signerOrder: 0, type: "signature", page: 0, xPct: 10, yPct: 10, widthPct: 12, heightPct: 4 },
    { signerOrder: 1, type: "signature", page: 0, xPct: 50, yPct: 10, widthPct: 12, heightPct: 4 },
  ];
  assert.deepEqual(validateSignatureAnchors(anchors, [0, 1]), []);
});

test("validateSignatureAnchors is a no-op (no errors) when signatureAnchors is omitted entirely", () => {
  assert.deepEqual(validateSignatureAnchors(undefined, [0, 1]), []);
  assert.deepEqual(validateSignatureAnchors(null, [0, 1]), []);
});

test("validateSignatureAnchors reports a missing signature anchor for a signer", () => {
  const anchors = [{ signerOrder: 0, type: "signature", page: 0, xPct: 10, yPct: 10, widthPct: 12, heightPct: 4 }];
  const errors = validateSignatureAnchors(anchors, [0, 1]);
  assert.ok(errors.some((e) => e.includes("position 1")));
});

test("validateSignatureAnchors rejects an out-of-range percent and an unknown signerOrder", () => {
  const anchors = [{ signerOrder: 5, type: "signature", page: 0, xPct: 150, yPct: 10, widthPct: 12, heightPct: 4 }];
  const errors = validateSignatureAnchors(anchors, [0]);
  assert.ok(errors.some((e) => e.includes("xPct")));
  assert.ok(errors.some((e) => e.includes("signerOrder")));
});

test("validateSignatureAnchors rejects an invalid type", () => {
  const anchors = [{ signerOrder: 0, type: "checkbox", page: 0, xPct: 10, yPct: 10, widthPct: 12, heightPct: 4 }];
  const errors = validateSignatureAnchors(anchors, [0]);
  assert.ok(errors.some((e) => e.includes("type")));
});
