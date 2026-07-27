import test from "node:test";
import assert from "node:assert/strict";
import { patchAnchorByCid, removeAnchorByCid } from "../lib/anchorEditorState.mjs";

// Regression test for C1 (final-review.md): AnchorEditor.handleUpdateSelected
// used to build two separately-patched objects -- one folded into the
// `anchors` array, another assigned to `selectedAnchor` -- so after the
// first edit the two were no longer reference-equal and the
// `a === selectedAnchor` guard stopped matching. Every keystroke after the
// first silently patched a stale copy: typing "Buyer" into a label
// persisted only "B". This simulates typing the full word one keystroke at
// a time, exactly the way the property panel's <input onChange> does it.
test("C1 regression: typing a full label across several keystrokes survives in the saved array", () => {
  let anchors = [{ _cid: "cid_1", label: "", type: "text", page: 0 }];
  let selected = anchors[0];

  const word = "Buyer";
  let typed = "";
  for (const ch of word) {
    typed += ch;
    // Each keystroke is its own patch, exactly like AnchorEditor's
    // <input onChange={(e) => handleUpdateSelected({ label: e.target.value })}>.
    const result = patchAnchorByCid(anchors, selected._cid, { label: typed });
    anchors = result.anchors;
    selected = result.selected;
  }

  assert.equal(selected.label, "Buyer", "the panel-facing selectedAnchor must show the full typed value");
  assert.equal(anchors[0].label, "Buyer", "the saved array entry must match what the panel showed");
  assert.equal(selected, anchors[0], "selectedAnchor must stay reference-identical to its array entry");
});

test("C1 regression: selection survives repeated edits (identity used for the 'selected' outline)", () => {
  let anchors = [
    { _cid: "cid_1", label: "A", type: "text", page: 0 },
    { _cid: "cid_2", label: "B", type: "text", page: 0 },
  ];
  let selected = anchors[1];

  for (const patch of [{ label: "Pu" }, { label: "Pur" }, { label: "Purchase Price" }, { required: true }]) {
    const result = patchAnchorByCid(anchors, selected._cid, patch);
    anchors = result.anchors;
    selected = result.selected;
  }

  assert.equal(selected.label, "Purchase Price");
  assert.equal(selected.required, true);
  // The OTHER anchor must be untouched.
  assert.equal(anchors[0].label, "A");
  // "selected" must still be found in the array for the AnchorBox
  // `selected={a._cid === selectedAnchor?._cid}` highlight to hold.
  assert.ok(anchors.some((a) => a._cid === selected._cid && a === selected));
});

test("patchAnchorByCid only touches the matching anchor, never a sibling", () => {
  const anchors = [
    { _cid: "cid_1", label: "A" },
    { _cid: "cid_2", label: "B" },
  ];
  const { anchors: updated } = patchAnchorByCid(anchors, "cid_1", { label: "Changed" });
  assert.equal(updated[0].label, "Changed");
  assert.equal(updated[1].label, "B");
  assert.equal(updated[1], anchors[1], "untouched anchors keep their original reference");
});

test("removeAnchorByCid removes only the targeted anchor", () => {
  const anchors = [{ _cid: "cid_1" }, { _cid: "cid_2" }];
  const result = removeAnchorByCid(anchors, "cid_1");
  assert.equal(result.length, 1);
  assert.equal(result[0]._cid, "cid_2");
});
