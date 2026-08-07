// Pure, DOM-free / I-O-free helpers shared between the signature-request
// preview route (app/api/ledgers/[id]/signature-request/preview/route.js),
// the create route's validation (app/api/ledgers/[id]/signature-request/
// route.js), and burn-time placement (lib/pdfSignatureBurn.js). Kept
// side-effect-free and dependency-free so it can be unit tested without a
// DB or a rendered PDF (see lib/signatureAnchors.test.js).

export const ANCHOR_TYPES = ["signature", "initials", "date"];

// Converts a sender-placed box (top-left corner, TOP-origin percent --
// AnchorEditor.jsx's own convention: xPct/yPct come from
// `(e.clientY - rect.top) / rect.height`) into pdf-lib's point space
// (bottom-left origin), for a page of the given real width/height.
export function percentBoxToPoints(box, pageWidth, pageHeight) {
  const width = (box.widthPct / 100) * pageWidth;
  const height = (box.heightPct / 100) * pageHeight;
  const x = (box.xPct / 100) * pageWidth;
  const topOffset = (box.yPct / 100) * pageHeight;
  const y = pageHeight - topOffset - height;
  return { x, y, width, height };
}

// Matches a found signature line (see lib/findSignatureLines.js) to
// whichever unmatched signer's name appears in that line's nearby text.
// Shared by the burn path (lib/pdfSignatureBurn.js, matching against real
// SignerSlots) and the preview path (matching against submitted
// participants before any SignerSlot exists yet) -- both only need "which
// name", not a whole slot object, so this stays name-in/name-out.
export function findBestNameForLine(line, unmatchedNames) {
  for (const name of unmatchedNames) {
    if (name && line.nearbyText.includes(name)) return name;
  }
  return null;
}

// Groups a SignatureRequest's persisted signatureAnchors by which
// SignerSlot they belong to (matched by `order`, not by any stored id --
// see prisma/schema.prisma's comment on signatureAnchors for why). Drops
// any anchor whose signerOrder doesn't match a real slot rather than
// throwing -- burnSignatures must never fail closed on a stale/malformed
// anchor; it just treats that slot as if no anchor existed.
export function groupAnchorsBySlot(signerSlots, signatureAnchors) {
  const map = new Map();
  if (!Array.isArray(signatureAnchors)) return map;
  for (const anchor of signatureAnchors) {
    const slot = signerSlots.find((s) => s.order === anchor.signerOrder);
    if (!slot) continue;
    if (!map.has(slot.id)) map.set(slot.id, []);
    map.get(slot.id).push(anchor);
  }
  return map;
}

// Whitelists exactly the fields that get persisted to
// SignatureRequest.signatureAnchors -- strips client-only bookkeeping
// (e.g. AnchorEditor-style _cid) and any unexpected extra keys, mirroring
// the whitelist pattern already used for TemplateAnchor's own client ->
// server boundary (see AnchorEditor.jsx's comment on _cid).
export function sanitizeSignatureAnchors(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => ({
    signerOrder: a.signerOrder,
    type: a.type,
    page: a.page,
    xPct: a.xPct,
    yPct: a.yPct,
    widthPct: a.widthPct,
    heightPct: a.heightPct,
  }));
}

// Validates a (sanitized) signatureAnchors array against the set of valid
// signer orders for this request. Returns an array of human-readable error
// strings (empty = valid). `signatureAnchors` being null/undefined is NOT
// an error -- it's how a not-yet-migrated caller (or the older,
// anchor-less flow) opts out entirely; every signer-must-have-a-signature
// rule below only applies once the caller opts in by sending the array.
export function validateSignatureAnchors(signatureAnchors, signerOrders) {
  if (signatureAnchors === undefined || signatureAnchors === null) return [];
  const errors = [];
  if (!Array.isArray(signatureAnchors)) {
    return ["signatureAnchors must be an array."];
  }
  const orderSet = new Set(signerOrders);
  signatureAnchors.forEach((a, i) => {
    if (!ANCHOR_TYPES.includes(a.type)) {
      errors.push(`signatureAnchors[${i}]: type must be one of ${ANCHOR_TYPES.join(", ")}.`);
    }
    if (!Number.isInteger(a.page) || a.page < 0) {
      errors.push(`signatureAnchors[${i}]: page must be a non-negative integer.`);
    }
    if (!orderSet.has(a.signerOrder)) {
      errors.push(`signatureAnchors[${i}]: signerOrder does not match any signer participant.`);
    }
    for (const field of ["xPct", "yPct", "widthPct", "heightPct"]) {
      const value = a[field];
      if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) {
        errors.push(`signatureAnchors[${i}]: ${field} must be a number between 0 and 100.`);
      }
    }
  });
  const signatureOrdersCovered = new Set(
    signatureAnchors.filter((a) => a.type === "signature").map((a) => a.signerOrder)
  );
  for (const order of signerOrders) {
    if (!signatureOrdersCovered.has(order)) {
      errors.push(`Signer at position ${order} has no signature anchor placed.`);
    }
  }
  return errors;
}
