import test from "node:test";
import assert from "node:assert/strict";
import { mergeDocumentTypeOptions } from "../lib/documentPicker.mjs";

const BUILT_IN = [
  { value: "purchase_loi", label: "Business + Real Estate Purchase LOI", badge: "Purchase LOI" },
  { value: "commercial_lease", label: "Commercial Lease LOI", badge: "Lease LOI" },
  { value: "residential_lease", label: "Residential Lease (New Brunswick)", badge: "Residential Lease" },
];

test("mergeDocumentTypeOptions: built-in types come first, unchanged", () => {
  const result = mergeDocumentTypeOptions(BUILT_IN, []);
  assert.equal(result.length, 3);
  assert.equal(result[0].kind, "built-in");
  assert.equal(result[0].value, "purchase_loi");
});

test("mergeDocumentTypeOptions: custom templates appended as their own kind", () => {
  const templates = [{ id: "tpl_1", name: "My NDA Template", pageCount: 3 }];
  const result = mergeDocumentTypeOptions(BUILT_IN, templates);
  assert.equal(result.length, 4);
  const templateOption = result[3];
  assert.equal(templateOption.kind, "template");
  assert.equal(templateOption.value, "tpl_1");
  assert.equal(templateOption.label, "My NDA Template");
  assert.equal(templateOption.badge, "Custom template");
});

test("mergeDocumentTypeOptions: empty templates array returns only built-ins", () => {
  const result = mergeDocumentTypeOptions(BUILT_IN, []);
  assert.equal(result.length, BUILT_IN.length);
});

test("mergeDocumentTypeOptions: multiple templates all appended in order", () => {
  const templates = [{ id: "tpl_1", name: "A" }, { id: "tpl_2", name: "B" }];
  const result = mergeDocumentTypeOptions(BUILT_IN, templates);
  assert.equal(result.length, 5);
  assert.equal(result[3].value, "tpl_1");
  assert.equal(result[4].value, "tpl_2");
});
