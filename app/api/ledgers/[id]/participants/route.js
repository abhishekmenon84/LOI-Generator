import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { getUserMembership } from "../../../../../lib/orgAccess";
import { renderEmail, escapeHtml } from "../../../../../lib/emailTemplate";
import { sendEmail } from "../../../../../lib/sendEmail";
import { Resend } from "resend";

// Document-level sharing, distinct from folder-level FolderParticipant
// (app/api/folders/[id]/participants/route.js, which this closely
// mirrors). Lets a folder's creator/admin grant someone access to ONE
// document without exposing the rest of the folder -- e.g. a lender who
// should see a single financing document, not a deal's full negotiation
// history. Managing a Ledger's participants requires actual folder-level
// access (the ledger's own createdByUserId/org-admin/folder-participant
// rules), not just a LedgerParticipant grant on it -- someone who only has
// document-level access can't grant further document-level access.
async function canManageLedgerParticipants(ledger, userId) {
  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  if (!folder) return false;
  if (ledger.createdByUserId === userId) return true;
  const membership = await getUserMembership(userId, folder.orgId);
  return !!membership && membership.role === "admin";
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await prisma.ledger.findUnique({ where: { id: params.id } });
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  if (!(await canManageLedgerParticipants(ledger, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to view participants for this document." }, { status: 403 });
  }

  const participants = await prisma.ledgerParticipant.findMany({
    where: { ledgerId: params.id },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    participants: participants.map((p) => ({
      id: p.id,
      email: p.user.email,
      name: p.user.name,
      permission: p.permission,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await prisma.ledger.findUnique({ where: { id: params.id } });
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  if (!(await canManageLedgerParticipants(ledger, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to add participants to this document." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const permission = body.permission === "write" ? "write" : "view";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  let recipient = await prisma.user.findUnique({ where: { email } });
  if (!recipient) {
    recipient = await prisma.user.create({ data: { email } });
  }
  if (recipient.id === session.user.id) {
    return NextResponse.json({ error: "You can't add yourself as a participant." }, { status: 400 });
  }

  const existing = await prisma.ledgerParticipant.findUnique({
    where: { ledgerId_userId: { ledgerId: ledger.id, userId: recipient.id } },
  });

  let participant;
  if (existing) {
    participant = await prisma.ledgerParticipant.update({ where: { id: existing.id }, data: { permission } });
  } else {
    participant = await prisma.ledgerParticipant.create({
      data: { ledgerId: ledger.id, userId: recipient.id, addedByUserId: session.user.id, permission },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await sendEmail(resend, {
    from: "Ledgerlot <onboarding@resend.dev>",
    to: email,
    subject: `A document has been shared with you on Ledgerlot`,
    html: renderEmail({
      title: "A document has been shared with you",
      body: `<strong>${escapeHtml(ledger.name)}</strong> has been shared with you (${permission === "write" ? "can edit" : "view only"}).`,
      ctaLabel: "Sign in to view it",
      ctaUrl: `${appUrl}/login`,
    }),
  });

  return NextResponse.json(
    { id: participant.id, permission: participant.permission, ...(result.ok ? {} : { emailWarning: `Notification email could not be sent. ${result.error}` }) },
    { status: existing ? 200 : 201 }
  );
}
