import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "../../../../lib/prisma";
import { hashDocument } from "../../../../lib/signatureEngine";
import { lookupGeo } from "../../../../lib/geoLookup";
import { buildLOIModel } from "../../../../lib/loiEngine";
import { buildLeaseModel } from "../../../../lib/leaseEngine";
import { buildResidentialLeaseModel } from "../../../../lib/residentialLeaseEngine";
import { buildLOIPdf, buildLeasePdf, buildResidentialLeasePdf } from "../../../../lib/pdfBuilder";
import { mergePdfBuffers } from "../../../../lib/pdfMerge";

const ATTACHMENT_A_PATH = path.join(process.cwd(), "public", "legal", "nb-residential-lease-attachment-a.pdf");

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

async function loadSlotByToken(token) {
  const slot = await prisma.signerSlot.findUnique({
    where: { signingToken: token },
    include: { request: { include: { deal: true } } },
  });
  if (!slot || slot.kind !== "signer") return null;
  return slot;
}

export async function GET(request, { params }) {
  const slot = await loadSlotByToken(params.token);
  if (!slot) {
    return NextResponse.json({ error: "Invalid or expired signing link." }, { status: 404 });
  }
  if (slot.request.status !== "pending") {
    return NextResponse.json({ error: "This signature request is no longer active." }, { status: 410 });
  }
  if (slot.tokenUsedAt) {
    return NextResponse.json({ error: "This signing link has already been used." }, { status: 410 });
  }

  return NextResponse.json({
    dealName: slot.request.deal.name,
    documentType: slot.request.deal.documentType,
    signerName: slot.name,
    signerRole: slot.roleOtherLabel || slot.role,
  });
}

export async function POST(request, { params }) {
  const slot = await loadSlotByToken(params.token);
  if (!slot) {
    return NextResponse.json({ error: "Invalid or expired signing link." }, { status: 404 });
  }
  if (slot.request.status !== "pending") {
    return NextResponse.json({ error: "This signature request is no longer active." }, { status: 410 });
  }
  if (slot.tokenUsedAt) {
    return NextResponse.json({ error: "This signing link has already been used." }, { status: 410 });
  }

  const body = await request.json().catch(() => ({}));
  const signatureImageDataUrl = body.signatureImageDataUrl;
  const consent = body.consent === true;
  if (!signatureImageDataUrl || !consent) {
    return NextResponse.json({ error: "A signature and consent confirmation are required." }, { status: 400 });
  }

  const deal = slot.request.deal;
  const pdfBuffer = await buildDealPdf(deal);
  const documentHash = hashDocument(pdfBuffer);

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : (request.headers.get("x-real-ip") || "unknown");
  const geo = await lookupGeo(ipAddress);

  await prisma.$transaction([
    prisma.signatureEvent.create({
      data: {
        signerSlotId: slot.id,
        signatureImageUrl: signatureImageDataUrl,
        documentHash,
        userAgent: (body.userAgent || request.headers.get("user-agent") || "unknown").slice(0, 500),
        screenInfo: (body.screenInfo || "unknown").slice(0, 100),
        timezoneOffset: typeof body.timezoneOffset === "number" ? body.timezoneOffset : 0,
        ipAddress,
        geoCountry: geo?.country || null,
        geoRegion: geo?.region || null,
        geoCity: geo?.city || null,
      },
    }),
    prisma.signerSlot.update({ where: { id: slot.id }, data: { tokenUsedAt: new Date() } }),
  ]);

  const remainingSigners = await prisma.signerSlot.count({
    where: { requestId: slot.requestId, kind: "signer", tokenUsedAt: null },
  });

  if (remainingSigners === 0) {
    // Deferred to Task 8: finalization (burn signatures, email everyone) is
    // triggered here but implemented as its own function for testability.
    const { finalizeSignatureRequest } = await import("../../../../lib/signatureFinalize.js");
    await finalizeSignatureRequest(slot.requestId);
  }

  return NextResponse.json({ ok: true, allComplete: remainingSigners === 0 });
}
