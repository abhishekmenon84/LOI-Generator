import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashDocument } from "../../../../lib/signatureEngine";
import { lookupGeo } from "../../../../lib/geoLookup";
import { buildDealPdf } from "../../../../lib/dealPdfBuilder";
import { checkRateLimit, getClientIp } from "../../../../lib/rateLimit";

async function loadSlotByToken(token) {
  const slot = await prisma.signerSlot.findUnique({
    where: { signingToken: token },
    include: { request: { include: { ledger: true } } },
  });
  if (!slot || slot.kind !== "signer") return null;
  return slot;
}

export async function GET(request, { params }) {
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`sign-get-ip:${ip}`, { max: 60, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

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

  // The signer reviews the frozen snapshot taken when this SignatureRequest
  // was created, not the Ledger's current (possibly since-edited) content --
  // see prisma/schema.prisma's comment on SignatureRequest.snapshotFormData.
  return NextResponse.json({
    dealName: slot.request.ledger.name,
    documentType: slot.request.snapshotDocumentType,
    formData: slot.request.snapshotFormData,
    signerName: slot.name,
    signerRole: slot.roleOtherLabel || slot.role,
  });
}

export async function POST(request, { params }) {
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`sign-post-ip:${ip}`, { max: 20, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }
  const tokenLimit = await checkRateLimit(`sign-post-token:${params.token}`, { max: 10, windowMs: 60_000 });
  if (tokenLimit.limited) {
    return NextResponse.json({ error: "Too many attempts for this signing link. Please try again shortly." }, { status: 429 });
  }

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

  // Hash the frozen snapshot, not the live Ledger -- see the GET handler's
  // identical note above.
  const snapshot = {
    documentType: slot.request.snapshotDocumentType,
    formData: slot.request.snapshotFormData,
    templateId: slot.request.snapshotTemplateId,
  };
  const pdfBuffer = await buildDealPdf(snapshot);
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
