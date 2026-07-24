import path from "path";
import { prisma } from "./prisma";
import { getRoleLabel } from "./signerRoles";
import { hashDocument } from "./signatureEngine";
import { burnSignatures } from "./pdfSignatureBurn";
import { buildLOIModel } from "./loiEngine";
import { buildLeaseModel } from "./leaseEngine";
import { buildResidentialLeaseModel } from "./residentialLeaseEngine";
import { buildLOIPdf, buildLeasePdf, buildResidentialLeasePdf } from "./pdfBuilder";
import { mergePdfBuffers } from "./pdfMerge";
import { Resend } from "resend";

const ATTACHMENT_A_PATH = path.join(process.cwd(), "public", "legal", "nb-residential-lease-attachment-a.pdf");

// Duplicated here (not imported from a shared helper in the API route) on
// purpose: this module has no HTTP request/response concerns and must be
// safely callable from a background-style trigger (today, synchronously
// from the last signer's POST; potentially from a retry/cron path later)
// without depending on anything route-specific.
async function buildDealPdf(deal) {
  if (deal.documentType === "purchase_loi") {
    return buildLOIPdf(buildLOIModel(deal.formData));
  }
  if (deal.documentType === "commercial_lease_loi") {
    return buildLeasePdf(buildLeaseModel(deal.formData));
  }
  if (deal.documentType === "residential_lease") {
    const generated = await buildResidentialLeasePdf(buildResidentialLeaseModel(deal.formData));
    return mergePdfBuffers(generated, ATTACHMENT_A_PATH);
  }
  throw new Error("Unsupported document type.");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function finalizeSignatureRequest(requestId) {
  const sigRequest = await prisma.signatureRequest.findUnique({
    where: { id: requestId },
    include: { deal: true, signers: { include: { signatureEvent: true } } },
  });
  if (!sigRequest || sigRequest.status !== "pending") return;

  const signerSlots = sigRequest.signers.filter((s) => s.kind === "signer");
  const allSigned = signerSlots.every((s) => !!s.signatureEvent);
  if (!allSigned) return;

  const pdfBuffer = await buildDealPdf(sigRequest.deal);
  const signedSlots = signerSlots.map((s) => ({
    name: s.name,
    roleLabel: getRoleLabel(s.role, s.roleOtherLabel),
    signatureImageDataUrl: s.signatureEvent.signatureImageUrl,
    signedAt: s.signatureEvent.signedAt.toISOString(),
  }));
  const finalPdf = await burnSignatures(pdfBuffer, signedSlots);
  const finalHash = hashDocument(finalPdf);

  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id: sigRequest.id },
      data: { status: "fully_executed", finalDocumentHash: finalHash },
    }),
    prisma.deal.update({ where: { id: sigRequest.dealId }, data: { locked: true } }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const verifyUrl = `${appUrl}/verify/${sigRequest.verifyCode}`;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const allRecipients = sigRequest.signers;
  await Promise.all(
    allRecipients.map((s) =>
      resend.emails.send({
        from: "LOI Builder <onboarding@resend.dev>",
        to: s.email,
        subject: `Fully signed: ${sigRequest.deal.name}`,
        html: `<p><strong>${escapeHtml(sigRequest.deal.name)}</strong> has been signed by all parties.</p><p>Verify this document's authenticity at <a href="${verifyUrl}">${verifyUrl}</a>.</p>`,
        attachments: [{ filename: `${sigRequest.deal.name.replace(/[^a-z0-9]+/gi, "_")}_signed.pdf`, content: finalPdf.toString("base64") }],
      })
    )
  );

  return { finalHash };
}
