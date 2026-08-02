import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { isValidRole } from "../../../../../lib/signerRoles";
import { generateSigningToken, generateVerifyCode } from "../../../../../lib/signatureEngine";
import { getOrgLimits, checkAndIncrementUsage } from "../../../../../lib/orgBilling";
import { nextSlotsToNotify } from "../../../../../lib/signingOrder";
import { Resend } from "resend";

const SIGNING_LINK_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadAccessibleLedger(ledgerId, userId) {
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) return null;
  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  if (!folder) return null;
  return { ...ledger, _writeAccess: folder._writeAccess, _orgId: folder.orgId };
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await loadAccessibleLedger(params.id, session.user.id);
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  if (!ledger._writeAccess) {
    return NextResponse.json({ error: "Not authorized to send this document for signature." }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({ where: { id: ledger._orgId } });
  const limits = getOrgLimits(org);
  if (!limits.canEsign) {
    return NextResponse.json({ error: "Sending for e-signature requires an active subscription. Upgrade to continue.", code: "UPGRADE_REQUIRED" }, { status: 402 });
  }
  const usage = await checkAndIncrementUsage(org.id, "esign", org);
  if (!usage.ok) {
    return NextResponse.json({ error: usage.error, code: "USAGE_LIMIT_REACHED" }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const participants = Array.isArray(body.participants) ? body.participants : [];

  const errors = [];
  const validated = participants.map((p, i) => {
    const kind = p.kind === "notify_only" ? "notify_only" : "signer";
    const name = (p.name || "").trim();
    const email = (p.email || "").trim().toLowerCase();
    const role = p.role || "";
    const roleOtherLabel = (p.roleOtherLabel || "").trim();
    if (!name) errors.push(`Participant ${i + 1}: name is required.`);
    if (!email) errors.push(`Participant ${i + 1}: email is required.`);
    if (!isValidRole(ledger.documentType, role, roleOtherLabel)) {
      errors.push(`Participant ${i + 1}: invalid role for this document type.`);
    }
    return { kind, name, email, role, roleOtherLabel: role === "other" ? roleOtherLabel : null };
  });

  if (validated.length === 0) {
    errors.push("At least one participant is required.");
  }
  const signerCount = validated.filter((p) => p.kind === "signer").length;
  if (signerCount === 0) {
    errors.push("At least one Signer is required (notify-only participants alone are not enough).");
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const existingPending = await prisma.signatureRequest.findFirst({
    where: { ledgerId: ledger.id, status: "pending" },
  });
  if (existingPending) {
    return NextResponse.json({ error: "This document already has a signature request in progress. Void it before sending a new one." }, { status: 400 });
  }

  // Signing order = the order participants were listed in (see
  // lib/signingOrder.js) -- only counted among actual signers, since
  // notify_only participants never block anyone and are notified
  // immediately regardless of position.
  let signerOrderCounter = 0;
  const withOrder = validated.map((p) => ({
    ...p,
    order: p.kind === "signer" ? signerOrderCounter++ : 0,
  }));

  const verifyCode = generateVerifyCode();
  const sigRequest = await prisma.signatureRequest.create({
    data: {
      ledgerId: ledger.id,
      createdByUserId: session.user.id,
      verifyCode,
      expiresAt: new Date(Date.now() + SIGNING_LINK_EXPIRY_MS),
      // Freeze the Ledger's current content -- every signer signs THIS
      // snapshot, not whatever the Ledger's formData happens to be later.
      // See prisma/schema.prisma's comment on these fields for why.
      snapshotFormData: ledger.formData,
      snapshotDocumentType: ledger.documentType,
      snapshotTemplateId: ledger.templateId,
      signers: {
        create: withOrder.map((p) => ({
          kind: p.kind,
          role: p.role,
          roleOtherLabel: p.roleOtherLabel,
          name: p.name,
          email: p.email,
          order: p.order,
          signingToken: p.kind === "signer" ? generateSigningToken() : null,
        })),
      },
    },
    include: { signers: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  // Only the first-in-order signer(s) get emailed now -- later signers are
  // notified once it's actually their turn (see finalizeSignatureRequest's
  // sibling logic in app/api/sign/[token]/route.js after each signature).
  // notify_only participants always get their copy immediately.
  const firstToNotify = nextSlotsToNotify(sigRequest.signers);
  const notifyOnlySlots = sigRequest.signers.filter((s) => s.kind === "notify_only");
  await Promise.all(
    [...firstToNotify, ...notifyOnlySlots].map((s) =>
      s.kind === "signer"
        ? resend.emails.send({
            from: "Ledgerlot <onboarding@resend.dev>",
            to: s.email,
            subject: `Please sign: ${ledger.name}`,
            html: `<p>You've been asked to sign <strong>${escapeHtml(ledger.name)}</strong> as ${escapeHtml(s.roleOtherLabel || s.role)}.</p><p><a href="${appUrl}/sign/${s.signingToken}">Review and sign</a></p>`,
          })
        : resend.emails.send({
            from: "Ledgerlot <onboarding@resend.dev>",
            to: s.email,
            subject: `FYI: ${ledger.name} sent for signature`,
            html: `<p><strong>${escapeHtml(ledger.name)}</strong> has been sent out for signature. You're being kept informed as ${escapeHtml(s.roleOtherLabel || s.role)}.</p>`,
          })
    )
  );

  return NextResponse.json({ id: sigRequest.id, verifyCode: sigRequest.verifyCode }, { status: 201 });
}
