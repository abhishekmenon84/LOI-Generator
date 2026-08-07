// All 3 engines (lib/loiEngine.js, leaseEngine.js, residentialLeaseEngine.js)
// append non-empty data.customClauses entries, in order, as the LAST entries
// of model.conditions -- after every fixed/conditional built-in condition.
// That means the split point is fully recoverable without changing
// model.conditions' shape at all (which would ripple into lib/pdfBuilder.jsx
// and lib/docxBuilder.js, both of which iterate model.conditions expecting
// a plain HTML string per entry): the last N conditions entries correspond,
// in order, to the non-empty entries of data.customClauses, where N is
// however many of those are non-empty.
//
// Returns { fixedCount, clauseIndices } -- `fixedCount` conditions[0..fixedCount)
// are read-only built-in conditions; clauseIndices[k] is the REAL index into
// data.customClauses that conditions[fixedCount + k] came from (skipping
// blank entries, since the engines filter those out before rendering).
export function mapCustomClauseConditions(conditionsLength, customClauses) {
  const clauseIndices = (customClauses || [])
    .map((c, i) => ({ c, i }))
    .filter((x) => x.c && x.c.trim() !== "")
    .map((x) => x.i);
  const fixedCount = conditionsLength - clauseIndices.length;
  return { fixedCount, clauseIndices };
}
