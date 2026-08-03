import { prisma } from "./prisma";
import { getRoleLabel } from "./signerRoles";
import { hashDocument } from "./signatureEngine";
import { burnSignatures } from "./pdfSignatureBurn";
import { buildDealPdf } from "./dealPdfBuilder";
import { buildCompletionCertificate } from "./completionCertificate";
import { renderEmail, escapeHtml } from "./emailTemplate";
import { getEmailBranding } from "./orgBranding";
import { dispatchWebhookEvent } from "./webhooks";
import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";

export async function finalizeSignatureRequest(requestId) {
  const sigRequest = await prisma.signatureRequest.findUnique({
    where: { id: requestId },
    include: { ledger: { include: { folder: { select: { orgId: true } } } }, signers: { include: { signatureEvent: true } } },
  });
  if (!sigRequest || sigRequest.status !== "pending") return;

  const signerSlots = sigRequest.signers.filter((s) => s.kind === "signer");
  const allSigned = signerSlots.every((s) => !!s.signatureEvent);
  if (!allSigned) return;

  // Render from this request's own frozen snapshot, not the live Ledger --
  // see prisma/schema.prisma's comment on SignatureRequest.snapshotFormData.
  // Every signer already reviewed/signed against this exact snapshot (see
  // app/api/sign/[token]/route.js), so finalization must render the same
  // content, not whatever the Ledger has been edited to since.
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
  const finalPdf = await burnSignatures(pdfBuffer, signedSlots);
  const finalHash = hashDocument(finalPdf);

  // Atomic compare-and-swap: only one concurrent caller can match a row
  // that's still "pending". If two signers submit near-simultaneously and
  // both reach this point, exactly one of these updateMany calls will
  // affect a row (count === 1); the other(s) will match nothing (count
  // === 0) because the first caller already flipped the status. This
  // closes the TOCTOU race from the early `status !== "pending"` guard
  // above, which is only a fast-path short-circuit, not a correctness
  // guarantee.
  const { count } = await prisma.signatureRequest.updateMany({
    where: { id: sigRequest.id, status: "pending" },
    data: { status: "fully_executed", finalDocumentHash: finalHash },
  });
  if (count === 0) return; // another concurrent call already won the race

  await prisma.ledger.update({ where: { id: sigRequest.ledgerId }, data: { locked: true } });

  if (sigRequest.ledger.folder?.orgId) {
    dispatchWebhookEvent(sigRequest.ledger.folder.orgId, "document.fully_signed", {
      ledgerId: sigRequest.ledgerId,
      ledgerName: sigRequest.ledger.name,
      signatureRequestId: sigRequest.id,
      verifyCode: sigRequest.verifyCode,
      finalDocumentHash: finalHash,
    }).catch((err) => console.error("[signatureFinalize] webhook dispatch failed:", err));
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn(
      "[signatureFinalize] NEXT_PUBLIC_APP_URL is not set; this breaks the verify link in the completion email (it will be emailed as a dead relative path)."
    );
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const verifyUrl = `${appUrl}/verify/${sigRequest.verifyCode}`;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const allRecipients = sigRequest.signers;
  const branding = await getEmailBranding(sigRequest.ledger.folder?.orgId);

  // A standalone Certificate of Completion, the standard evidentiary
  // artifact DocuSign/dotloop both attach -- distinct from the in-app audit
  // panel (which deliberately omits IP/device/geo per PIPEDA principles
  // 4/5), since this certificate's entire purpose is being a complete
  // evidence package for a future dispute, not a daily-use UI view.
  const certificateSlots = signerSlots.map((s) => ({
    name: s.name,
    roleLabel: getRoleLabel(s.role, s.roleOtherLabel),
    signedAt: s.signatureEvent.signedAt.toISOString(),
    ipAddress: s.signatureEvent.ipAddress,
    geoCity: s.signatureEvent.geoCity,
    geoRegion: s.signatureEvent.geoRegion,
    geoCountry: s.signatureEvent.geoCountry,
    userAgent: s.signatureEvent.userAgent,
    screenInfo: s.signatureEvent.screenInfo,
    timezoneOffset: s.signatureEvent.timezoneOffset,
    documentHash: s.signatureEvent.documentHash,
  }));
  let certificatePdf = null;
  try {
    certificatePdf = await buildCompletionCertificate({
      dealName: sigRequest.ledger.name,
      documentHash: finalHash,
      verifyUrl,
      signedSlots: certificateSlots,
    });
  } catch (err) {
    console.error("[signatureFinalize] certificate generation failed:", err);
    Sentry.captureException(err, { tags: { signatureRequestId: sigRequest.id } });
  }

  // The request is already marked fully_executed above (correctly -- the
  // document itself is done and signed, regardless of email delivery).
  // But a failure here must not be silent: record it on the row and report
  // it, so an admin/support flow can detect and manually resend instead of
  // the customer never getting their signed copy with no one the wiser.
  try {
    await Promise.all(
      allRecipients.map((s) =>
        resend.emails.send({
          from: "Ledgerlot <onboarding@resend.dev>",
          to: s.email,
          subject: `Fully signed: ${sigRequest.ledger.name}`,
          html: renderEmail({
            title: "Fully signed",
            body: `<strong>${escapeHtml(sigRequest.ledger.name)}</strong> has been signed by all parties. Your signed copy and Certificate of Completion are attached to this email.`,
            ctaLabel: "Verify this document's authenticity",
            ctaUrl: verifyUrl,
            brandName: branding.brandName,
            brandLogoUrl: branding.brandLogoUrl,
          }),
          attachments: [
            { filename: `${sigRequest.ledger.name.replace(/[^a-z0-9]+/gi, "_")}_signed.pdf`, content: finalPdf.toString("base64") },
            ...(certificatePdf ? [{ filename: `${sigRequest.ledger.name.replace(/[^a-z0-9]+/gi, "_")}_certificate.pdf`, content: certificatePdf.toString("base64") }] : []),
          ],
        })
      )
    );
  } catch (err) {
    console.error("[signatureFinalize] completion email delivery failed:", err);
    Sentry.captureException(err, { tags: { signatureRequestId: sigRequest.id } });
    await prisma.signatureRequest.update({
      where: { id: sigRequest.id },
      data: { deliveryError: String(err?.message || err).slice(0, 500) },
    });
  }

  return { finalHash };
}
