// Pure, DOM-free state-transition helpers for AnchorEditor.jsx's anchor
// list + selection. Extracted specifically so the C1 regression (see
// .superpowers/sdd/2026-07-27-universal-form-framework/final-review.md)
// can be exercised and asserted on without a DOM/React harness, and so it
// can't quietly reappear: `selectedAnchor` is always DERIVED from the
// updated array by matching `_cid`, rather than built as a second,
// separately-patched object that can drift out of sync with the array.

// Applies `patch` to the anchor in `anchors` whose `_cid` matches
// `selectedCid`, leaving every other anchor untouched. Returns the new
// array plus the updated anchor itself (or null if `selectedCid` didn't
// match anything), read back OUT of that same array -- so the returned
// "selected" object is always reference-identical to the array entry.
export function patchAnchorByCid(anchors, selectedCid, patch) {
  const updatedAnchors = anchors.map((a) => (a._cid === selectedCid ? { ...a, ...patch } : a));
  const selected = updatedAnchors.find((a) => a._cid === selectedCid) || null;
  return { anchors: updatedAnchors, selected };
}

export function removeAnchorByCid(anchors, cid) {
  return anchors.filter((a) => a._cid !== cid);
}
