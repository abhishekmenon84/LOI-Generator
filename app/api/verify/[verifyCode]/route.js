import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getRoleLabel } from "../../../../lib/signerRoles";
import { hashDocument } from "../../../../lib/signatureEngine";
import { burnSignatures } from "../../../../lib/pdfSignatureBurn";
import { buildLOIModel } from "../../../../lib/loiEngine";
import { buildLeaseModel } from "../../../../lib/leaseEngine";
import { buildResidentialLeaseModel } from "../../../../lib/residentialLeaseEngine";
import { buildLOIPdf, buildLeasePdf, buildResidentialLeasePdf } from "../../../../lib/pdfBuilder";
import { mergePdfBuffers } from "../../../../lib/pdfMerge";
import path from "path";

const ATTACHMENT_A_PATH = path.join(process.cwd(), "public", "legal", "nb-residential-lease-attachment-a.pdf");

async function buildDealPdf(deal) {
  if (deal.documentType === "purchase_loi") return buildLOIPdf(buildLOIModel(deal.formData));
  if (deal.documentType === "commercial_lease_loi") return buildLeasePdf(buildLeaseModel(deal.formData));
  if (deal.documentType === "residential_lease") {
    const generated = await buildResidentialLeasePdf(buildResidentialLeaseModel(deal.formData));
    return mergePdfBuffers(generated, ATTACHMENT_A_PATH);
  }
  throw new Error("Unsupported document type.");
}

export async function GET(request, { params }) {
  const sigRequest = await prisma.signatureRequest.findUnique({
    where: { verifyCode: params.verifyCode },
    include: { deal: true, signers: { include: { signatureEvent: true } } },
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
    const pdfBuffer = await buildDealPdf(sigRequest.deal);
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
    dealName: sigRequest.deal.name,
    signers: publicSigners,
    integrityValid,
  });
}
