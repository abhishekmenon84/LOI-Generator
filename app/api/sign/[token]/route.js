import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashDocument } from "../../../../lib/signatureEngine";
import { lookupGeo } from "../../../../lib/geoLookup";
import { buildDealPdf } from "../../../../lib/dealPdfBuilder";
import { checkRateLimit, getClientIp } from "../../../../lib/rateLimit";
import { isSlotUnlocked, nextSlotsToNotify } from "../../../../lib/signingOrder";
import { renderEmail, escapeHtml } from "../../../../lib/emailTemplate";
import { Resend } from "resend";

async function loadSlotByToken(token) {
  const slot = await prisma.signerSlot.findUnique({
    where: { signingToken: token },
    include: { request: { include: { ledger: true, signers: true } } },
  });
  if (!slot || slot.kind !== "signer") return null;
  return slot;
}

function checkSlotAccessible(slot) {
  if (slot.request.status === "declined") {
    return { error: "This signature request was declined by another signer and is no longer active.", status: 410 };
  }
  if (slot.request.status !== "pending") {
    return { error: "This signature request is no longer active.", status: 410 };
  }
  if (slot.request.expiresAt && slot.request.expiresAt < new Date()) {
    return { error: "This signing link has expired. Ask the sender to void and resend it.", status: 410 };
  }
  if (slot.tokenUsedAt) {
    return { error: "This signing link has already been used.", status: 410 };
  }
  if (slot.declinedAt) {
    return { error: "You've already declined to sign this document.", status: 410 };
  }
  if (!isSlotUnlocked(slot, slot.request.signers)) {
    return { error: "It's not your turn to sign yet -- an earlier signer needs to sign first. You'll be emailed when it's your turn.", status: 409 };
  }
  return null;
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
  const accessError = checkSlotAccessible(slot);
  if (accessError) {
    return NextResponse.json({ error: accessError.error }, { status: accessError.status });
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

export async function PATCH(request, { params }) {
  // Decline to sign. A single decline halts the whole request -- remaining
  // signers' links stop working, matching DocuSign/dotloop's behavior
  // rather than silently proceeding without this signer.
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`sign-decline-ip:${ip}`, { max: 20, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const slot = await loadSlotByToken(params.token);
  if (!slot) {
    return NextResponse.json({ error: "Invalid or expired signing link." }, { status: 404 });
  }
  const accessError = checkSlotAccessible(slot);
  if (accessError) {
    return NextResponse.json({ error: accessError.error }, { status: accessError.status });
  }

  const body = await request.json().catch(() => ({}));
  const declineReason = (body.declineReason || "").trim().slice(0, 500) || null;

  await prisma.$transaction([
    prisma.signerSlot.update({ where: { id: slot.id }, data: { declinedAt: new Date(), declineReason } }),
    prisma.signatureRequest.update({ where: { id: slot.requestId }, data: { status: "declined" } }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const creator = await prisma.user.findUnique({ where: { id: slot.request.createdByUserId }, select: { email: true } });
  if (creator?.email) {
    await resend.emails
      .send({
        from: "Ledgerlot <onboarding@resend.dev>",
        to: creator.email,
        subject: `Signature declined: ${slot.request.ledger.name}`,
        html: renderEmail({
          title: "Signature declined",
          body: `<strong>${escapeHtml(slot.name)}</strong> (${escapeHtml(slot.roleOtherLabel || slot.role)}) declined to sign <strong>${escapeHtml(slot.request.ledger.name)}</strong>.${declineReason ? `<br/><br/>Reason: ${escapeHtml(declineReason)}` : ""}`,
          ctaLabel: "View the document",
          ctaUrl: `${appUrl}/ledgerboard/folder/${slot.request.ledger.folderId}`,
        }),
      })
      .catch((err) => console.error("[sign decline] notification email failed:", err));
  }

  return NextResponse.json({ ok: true });
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
  const accessError = checkSlotAccessible(slot);
  if (accessError) {
    return NextResponse.json({ error: accessError.error }, { status: accessError.status });
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

  const remainingSlots = await prisma.signerSlot.findMany({ where: { requestId: slot.requestId } });
  const remainingSigners = remainingSlots.filter((s) => s.kind === "signer" && !s.tokenUsedAt).length;

  if (remainingSigners === 0) {
    // Deferred to Task 8: finalization (burn signatures, email everyone) is
    // triggered here but implemented as its own function for testability.
    const { finalizeSignatureRequest } = await import("../../../../lib/signatureFinalize.js");
    await finalizeSignatureRequest(slot.requestId);
  } else {
    // Sequential signing: notify whoever's unlocked next (the lowest-order
    // signer(s) still pending) now that this signer is done -- everyone
    // else stays un-notified until it's actually their turn.
    const toNotify = nextSlotsToNotify(remainingSlots).filter((s) => s.id !== slot.id);
    if (toNotify.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const resend = new Resend(process.env.RESEND_API_KEY);
      await Promise.all(
        toNotify.map((s) =>
          resend.emails
            .send({
              from: "Ledgerlot <onboarding@resend.dev>",
              to: s.email,
              subject: `Please sign: ${slot.request.ledger.name}`,
              html: renderEmail({
                title: "Your signature is requested",
                body: `You've been asked to sign <strong>${escapeHtml(slot.request.ledger.name)}</strong> as ${escapeHtml(s.roleOtherLabel || s.role)}.`,
                ctaLabel: "Review and sign",
                ctaUrl: `${appUrl}/sign/${s.signingToken}`,
                footerNote: "Didn't expect this? You can safely ignore this email.",
              }),
            })
            .catch((err) => console.error("[sign] next-signer notification failed:", err))
        )
      );
    }
  }

  return NextResponse.json({ ok: true, allComplete: remainingSigners === 0 });
}
