// Shared helper so every built-in document type (Purchase LOI, Commercial
// Lease, Residential Lease) resolves its optional/renamable section
// headings the same way, rather than three copies of the same numbering
// logic. A "section" here means one of the document's fixed, ordered
// numbered headings (e.g. "1. PURCHASE PRICE AND ALLOCATION") -- this does
// NOT let a user add a brand-new section, only rename or hide one of the
// document type's existing ones (see customClauses, already a separate,
// pre-existing mechanism for genuinely new free-text content).
//
// sectionDefs: ordered array of { key, defaultTitle } -- defaultTitle has
// NO number prefix; the number is always computed here, sequentially, over
// only the currently-enabled sections, so hiding one never leaves a gap
// (e.g. hiding "3." makes the old "4." become "3." automatically).
//
// overrides: data.sectionOverrides, shaped { [key]: { title?, enabled? } }.
// Missing/undefined always means "use the default" (title) or "true"
// (enabled), so existing documents saved before this feature existed
// render identically to before -- an absent sectionOverrides is exactly
// equivalent to every section enabled with its default title.
//
// formatNumber(n, title): builds the final display string for an enabled
// section's sequential position n (1-based) and its (possibly custom)
// title. Defaults to "N. TITLE" (Purchase LOI, Commercial Lease); the
// Residential Lease standard form instead passes "SECTION N — TITLE" to
// match its own pre-existing numbering convention.
export function resolveSectionHeadings(sectionDefs, overrides = {}, formatNumber = (n, title) => `${n}. ${title}`) {
  const headings = {};
  const enabled = {};
  let n = 0;
  for (const def of sectionDefs) {
    const ov = overrides[def.key] || {};
    const isEnabled = ov.enabled !== false;
    enabled[def.key] = isEnabled;
    if (isEnabled) {
      n += 1;
      const customTitle = (ov.title || "").trim();
      headings[def.key] = formatNumber(n, customTitle || def.defaultTitle);
    } else {
      headings[def.key] = "";
    }
  }
  return { headings, enabled };
}
