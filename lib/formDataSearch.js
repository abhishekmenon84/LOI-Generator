// Flattens every string value out of a Ledger's formData (arbitrary nested
// JSON -- shape varies per documentType, and custom_template/form_template
// answers are keyed by anchor id/field key rather than a fixed schema) into
// one lowercase-joined string, so a search query can substring-match
// against actual document CONTENT (buyer name, property address, custom
// template answers, etc), not just the Ledger's own title. Booleans/numbers
// are skipped -- searching "true" or "42" as free text isn't useful here.
export function flattenFormDataText(value, depth = 0) {
  if (depth > 6 || value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => flattenFormDataText(v, depth + 1)).join(" ");
  if (typeof value === "object") return Object.values(value).map((v) => flattenFormDataText(v, depth + 1)).join(" ");
  return "";
}

export function formDataMatchesQuery(formData, queryLower) {
  if (!formData) return false;
  return flattenFormDataText(formData).toLowerCase().includes(queryLower);
}
