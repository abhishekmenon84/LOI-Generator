import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { isValidRole } from "../../../../../lib/signerRoles";
import { generateSigningToken, generateVerifyCode } from "../../../../../lib/signatureEngine";
import { Resend } from "resend";

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
  return { ...ledger, _writeAccess: folder._writeAccess, _folderDeletedAt: folder.deletedAt };
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
  if (ledger._folderDeletedAt) {
    return NextResponse.json({ error: "This document's folder is in Trash and cannot be sent for signature. Restore it first.", code: "FOLDER_TRASHED" }, { status: 409 });
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

  const verifyCode = generateVerifyCode();
  const sigRequest = await prisma.signatureRequest.create({
    data: {
      ledgerId: ledger.id,
      createdByUserId: session.user.id,
      verifyCode,
      signers: {
        create: validated.map((p) => ({
          kind: p.kind,
          role: p.role,
          roleOtherLabel: p.roleOtherLabel,
          name: p.name,
          email: p.email,
          signingToken: p.kind === "signer" ? generateSigningToken() : null,
        })),
      },
    },
    include: { signers: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const signerSlots = sigRequest.signers.filter((s) => s.kind === "signer");
  await Promise.all(
    signerSlots.map((s) =>
      resend.emails.send({
        from: "Ledgerlot <onboarding@resend.dev>",
        to: s.email,
        subject: `Please sign: ${ledger.name}`,
        html: `<p>You've been asked to sign <strong>${escapeHtml(ledger.name)}</strong> as ${escapeHtml(s.roleOtherLabel || s.role)}.</p><p><a href="${appUrl}/sign/${s.signingToken}">Review and sign</a></p>`,
      })
    )
  );

  return NextResponse.json({ id: sigRequest.id, verifyCode: sigRequest.verifyCode }, { status: 201 });
}
