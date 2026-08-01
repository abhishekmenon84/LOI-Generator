import test from "node:test";
import assert from "node:assert/strict";
import { generateQuestionLabel, groupAnchorsForWizard } from "../lib/customTemplateQuestions.mjs";

test("generateQuestionLabel: uses customQuestion verbatim when set", () => {
  const anchor = { type: "text", role: "Buyer", label: "Name", customQuestion: "Full legal name, please?" };
  assert.equal(generateQuestionLabel(anchor), "Full legal name, please?");
});

test("generateQuestionLabel: text anchor with a real label", () => {
  const anchor = { type: "text", role: "Buyer", label: "Name" };
  assert.equal(generateQuestionLabel(anchor), "What is the Buyer's Name?");
});

test("generateQuestionLabel: text anchor with a generic placeholder label falls back to a generic question", () => {
  const anchor = { type: "text", role: "Buyer", label: "Field 3" };
  assert.equal(generateQuestionLabel(anchor), "What is the Buyer's answer for this field?");
});

test("generateQuestionLabel: date anchor with a role", () => {
  const anchor = { type: "date", role: "Closing" };
  assert.equal(generateQuestionLabel(anchor), "What is the Closing date?");
});

test("generateQuestionLabel: date anchor with no role", () => {
  const anchor = { type: "date", role: "" };
  assert.equal(generateQuestionLabel(anchor), "What date applies to this field?");
});

test("generateQuestionLabel: checkbox anchor prefers label over role", () => {
  const anchor = { type: "checkbox", role: "Buyer", label: "Financing contingency" };
  assert.equal(generateQuestionLabel(anchor), "Does this apply: Financing contingency?");
});

test("generateQuestionLabel: checkbox anchor with no label falls back to role", () => {
  const anchor = { type: "checkbox", role: "Buyer", label: "" };
  assert.equal(generateQuestionLabel(anchor), "Does this apply: Buyer?");
});

test("generateQuestionLabel: radio anchor uses its radioGroup", () => {
  const anchor = { type: "radio", radioGroup: "financing_type" };
  assert.equal(generateQuestionLabel(anchor), "Which option applies: financing_type?");
});

test("groupAnchorsForWizard: excludes signature and initials anchors entirely", () => {
  const anchors = [
    { id: "a1", type: "signature", page: 0, yPct: 10 },
    { id: "a2", type: "initials", page: 0, yPct: 20 },
    { id: "a3", type: "text", page: 0, yPct: 30, role: "Buyer" },
  ];
  const groups = groupAnchorsForWizard(anchors);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[0].items[0].anchor.id, "a3");
});

test("groupAnchorsForWizard: groups by page ascending, orders by yPct ascending within a page", () => {
  const anchors = [
    { id: "a1", type: "text", page: 1, yPct: 50, role: "X" },
    { id: "a2", type: "text", page: 0, yPct: 80, role: "Y" },
    { id: "a3", type: "text", page: 0, yPct: 20, role: "Z" },
  ];
  const groups = groupAnchorsForWizard(anchors);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].page, 0);
  assert.equal(groups[0].items[0].anchor.id, "a3"); // yPct 20, comes first
  assert.equal(groups[0].items[1].anchor.id, "a2"); // yPct 80
  assert.equal(groups[1].page, 1);
  assert.equal(groups[1].items[0].anchor.id, "a1");
});

test("groupAnchorsForWizard: collapses same-radioGroup anchors into one wizard entry", () => {
  const anchors = [
    { id: "a1", type: "radio", page: 0, yPct: 10, radioGroup: "financing_type" },
    { id: "a2", type: "radio", page: 0, yPct: 15, radioGroup: "financing_type" },
    { id: "a3", type: "text", page: 0, yPct: 5, role: "Buyer" },
  ];
  const groups = groupAnchorsForWizard(anchors);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 2); // one text field entry + one collapsed radioGroup entry
  const radioEntry = groups[0].items.find((i) => i.kind === "radioGroup");
  assert.ok(radioEntry);
  assert.equal(radioEntry.radioGroup, "financing_type");
  assert.equal(radioEntry.anchors.length, 2);
});
