import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getRoleLabel } from "../../../../lib/signerRoles";
import { hashDocument } from "../../../../lib/signatureEngine";
import { burnSignatures } from "../../../../lib/pdfSignatureBurn";
import { buildDealPdf } from "../../../../lib/dealPdfBuilder";
import { checkRateLimit, getClientIp } from "../../../../lib/rateLimit";

export async function GET(request, { params }) {
  const ip = getClientIp(request);
  // The verify code is only 8 characters by design (meant to be printed on
  // a document footer and typed/read aloud), so it is guessable at scale
  // without a strict per-IP limit here.
  const ipLimit = await checkRateLimit(`verify-ip:${ip}`, { max: 20, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const sigRequest = await prisma.signatureRequest.findUnique({
    where: { verifyCode: params.verifyCode },
    include: { ledger: true, signers: { include: { signatureEvent: true } } },
  });
  if (!sigRequest || sigRequest.status !== "fully_executed") {
    return NextResponse.json({ error: "No fully executed document found for this code." }, { status: 404 });
  }

  const signerSlots = sigRequest.signers.filter((s) => s.kind === "signer" && s.signatureEvent);
  const publicSigners = signerSlots.map((s) => ({
    name: s.name,
    role: getRoleLabel(s.role, s.roleOtherLabel),
    signedAt: s.signatureEvent.signedAt,
  }));

  let integrityValid = false;
  try {
    const pdfBuffer = await buildDealPdf(sigRequest.ledger);
    const signedSlots = signerSlots.map((s) => ({
      name: s.name,
      roleLabel: getRoleLabel(s.role, s.roleOtherLabel),
      signatureImageDataUrl: s.signatureEvent.signatureImageUrl,
      signedAt: s.signatureEvent.signedAt.toISOString(),
    }));
    const regenerated = await burnSignatures(pdfBuffer, signedSlots);
    const regeneratedHash = hashDocument(regenerated);
    integrityValid = regeneratedHash === sigRequest.finalDocumentHash;
  } catch (err) {
    console.error("verify integrity check error:", err.message);
    integrityValid = false;
  }

  return NextResponse.json({
    dealName: sigRequest.ledger.name,
    signers: publicSigners,
    integrityValid,
  });
}
