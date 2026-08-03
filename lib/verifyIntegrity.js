import { hashDocument } from "./signatureEngine";
import { burnSignatures } from "./pdfSignatureBurn";
import { buildDealPdf } from "./dealPdfBuilder";
import { getRoleLabel } from "./signerRoles";

// Regenerates a fully-executed SignatureRequest's final PDF from its own
// frozen snapshot and compares the hash against finalDocumentHash --
// shared by the on-demand public verify endpoint (app/api/verify/
// [verifyCode]/route.js) and the periodic re-verification cron
// (app/api/cron/verify-integrity/route.js), so both use one
// implementation of "did this document's stored hash originally match, and
// does regenerating it from the same snapshot still match now."
//
// `sigRequest` must include `signers: { include: { signatureEvent: true } }`.
export async function checkSignatureRequestIntegrity(sigRequest) {
  const signerSlots = sigRequest.signers.filter((s) => s.kind === "signer" && s.signatureEvent);

  const snapshot = {
    documentType: sigRequest.snapshotDocumentType,
    formData: sigRequest.snapshotFormData,
    templateId: sigRequest.snapshotTemplateId,
  };
  const pdfBuffer = await buildDealPdf(snapshot);
  const signedSlots = signerSlots.map((s) => ({
    name: s.name,
    roleLabel: getRoleLabel(s.role, s.roleOtherLabel),
    signatureImageDataUrl: s.signatureEvent.signatureImageUrl,
    signedAt: s.signatureEvent.signedAt.toISOString(),
  }));
  const regenerated = await burnSignatures(pdfBuffer, signedSlots);
  const regeneratedHash = hashDocument(regenerated);
  return regeneratedHash === sigRequest.finalDocumentHash;
}
