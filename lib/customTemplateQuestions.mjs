// Generates a human-readable wizard question for a TemplateAnchor, and
// groups/orders anchors into the wizard's per-page presentation. Pure
// functions, no DOM/DB access, so the exact question wording and
// grouping/ordering rules are unit-testable in isolation from the wizard
// UI that consumes them (app/ledgerboard/custom-template/[ledgerId]/fill/page.js).

// A label is treated as "generic" (auto-numbered placeholder, not a real
// human-authored label) when it matches the client-side detector's own
// fallback naming convention -- see components/NewTemplateForm.jsx's
// `Field ${fieldCounter}` and KeeperTemplates.jsx's anchors, which use the
// same "Field N" shape for anything the detector couldn't label from
// nearby text.
const GENERIC_LABEL_RE = /^Field \d+$/;

function isGenericLabel(label) {
  return !label || GENERIC_LABEL_RE.test(label);
}

export function generateQuestionLabel(anchor) {
  if (anchor.customQuestion && anchor.customQuestion.trim()) {
    return anchor.customQuestion.trim();
  }

  const role = (anchor.role || "").trim();
  const label = (anchor.label || "").trim();

  if (anchor.type === "text") {
    if (!isGenericLabel(label)) {
      return `What is the ${role || "signer"}'s ${label}?`;
    }
    return `What is the ${role || "signer"}'s answer for this field?`;
  }

  if (anchor.type === "date") {
    return role ? `What is the ${role} date?` : "What date applies to this field?";
  }

  if (anchor.type === "checkbox") {
    return `Does this apply: ${!isGenericLabel(label) ? label : role || "this field"}?`;
  }

  if (anchor.type === "radio") {
    return `Which option applies: ${anchor.radioGroup || "this choice"}?`;
  }

  // signature/initials never reach the wizard (filtered out in
  // groupAnchorsForWizard), but keep a safe fallback for direct callers.
  return `Please provide: ${role || "this field"}.`;
}

export function groupAnchorsForWizard(anchors) {
  const eligible = (anchors || []).filter((a) => a.type !== "signature" && a.type !== "initials");

  const byPage = new Map();
  for (const anchor of eligible) {
    const list = byPage.get(anchor.page) || [];
    list.push(anchor);
    byPage.set(anchor.page, list);
  }

  const pages = [...byPage.keys()].sort((a, b) => a - b);

  return pages.map((page) => {
    const pageAnchors = byPage.get(page).slice().sort((a, b) => a.yPct - b.yPct);

    const items = [];
    const seenRadioGroups = new Set();
    for (const anchor of pageAnchors) {
      if (anchor.type === "radio" && anchor.radioGroup) {
        if (seenRadioGroups.has(anchor.radioGroup)) continue;
        seenRadioGroups.add(anchor.radioGroup);
        const groupAnchors = pageAnchors.filter((a) => a.type === "radio" && a.radioGroup === anchor.radioGroup);
        items.push({ kind: "radioGroup", radioGroup: anchor.radioGroup, anchors: groupAnchors });
      } else {
        items.push({ kind: "field", anchor });
      }
    }

    return { page, items };
  });
}
