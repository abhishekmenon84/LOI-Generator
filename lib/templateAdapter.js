// Normalizes a FormTemplate (+ its FormFields) into the exact same shape
// GET /api/orgs/[id]/templates/[templateId] already returns for a
// CustomTemplate (+ its TemplateAnchors) -- {id, orgId, name, pdfUrl,
// pageCount, anchors: [{id, type, role, page, xPct, yPct, widthPct,
// heightPct, customQuestion}]}. This lets the existing CustomTemplate
// signer-assignment and fill-wizard pages (and lib/customTemplateQuestions.mjs's
// generateQuestionLabel/groupAnchorsForWizard, which only ever read that
// anchor shape) work unchanged for a FormTemplate-based Ledger too, per the
// product decision that both template systems follow identical signing
// rules -- FormTemplate is just the org-shared one, CustomTemplate the
// creator-private one.
export function formTemplateToAnchorShape(template) {
  return {
    id: template.id,
    orgId: template.orgId,
    name: template.name,
    pdfUrl: template.pdfUrl,
    pageCount: template.pageCount,
    anchors: (template.fields || []).map((f) => ({
      id: f.key,
      type: f.type,
      role: f.signerRole || "",
      label: f.label,
      page: f.page,
      xPct: f.xPct,
      yPct: f.yPct,
      widthPct: f.widthPct,
      heightPct: f.heightPct,
      radioGroup: f.radioGroup,
      customQuestion: null,
    })),
  };
}
