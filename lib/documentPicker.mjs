// Merges built-in document types (LOI, lease, etc.) with an org's custom
// uploaded FormTemplates into one flat list of equally-weighted options
// for the "new ledger" picker -- see components/DealList.jsx. Pulled out
// as a pure function (rather than inlined in the component) so the
// merge/label logic can be tested without a DOM or fetch mock.
export function mergeDocumentTypeOptions(builtInTypes, templates) {
  const builtIn = builtInTypes.map((t) => ({ kind: "built-in", value: t.value, label: t.label, badge: t.badge }));
  const custom = (templates || []).map((t) => ({ kind: "template", value: t.id, label: t.name, badge: "Custom template" }));
  return [...builtIn, ...custom];
}
