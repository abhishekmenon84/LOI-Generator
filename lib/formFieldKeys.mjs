// Converts a human label into a stable snake_case machine key. Input comes
// from a PDF text layer, so it may contain ligature-substitution artifacts
// (pdf.js renders "ti" in these forms as "Ɵ"), punctuation, and runs of
// underscores from the form's own blank lines -- all of which collapse away.
export function slugifyLabel(label) {
  const slug = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "field";
}

// Returns `base`, or `base_2`, `base_3`, ... if already taken. Does not
// mutate `taken` -- the caller decides when a key is committed.
export function uniqueKey(base, taken) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

// Vertical tolerance, in percent of page height, for treating a text item
// and a detected box as being on the same line.
const SAME_LINE_TOLERANCE_PCT = 1.5;

// Derives a label for a detected field box by finding the closest text item
// that sits on the same line and starts to its left -- the near-universal
// layout of a paper form ("The Buyer ______"). Returns "" when nothing
// qualifies, leaving the caller to fall back to a generic name.
export function labelForBox(box, textItems) {
  const boxMid = box.yPct + box.heightPct / 2;
  let best = null;
  let bestGap = Infinity;
  for (const item of textItems) {
    const text = String(item.str || "").replace(/[_\s]+/g, " ").trim();
    if (!text) continue;
    if (Math.abs(item.yPct - boxMid) > SAME_LINE_TOLERANCE_PCT) continue;
    const itemRight = item.xPct + item.widthPct;
    if (itemRight > box.xPct + 1) continue; // must start left of the box
    const gap = box.xPct - itemRight;
    if (gap < bestGap) {
      bestGap = gap;
      best = text;
    }
  }
  return best || "";
}
