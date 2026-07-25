import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { getUserMembership } from "../../../../../lib/orgAccess";
import { Resend } from "resend";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function canManageParticipants(folder, userId) {
  if (folder.createdByUserId === userId) return true;
  const membership = await getUserMembership(userId, folder.orgId);
  return !!membership && membership.role === "admin";
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!(await canManageParticipants(folder, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to view participants for this folder." }, { status: 403 });
  }

  const participants = await prisma.folderParticipant.findMany({
    where: { folderId: params.id },
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
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!(await canManageParticipants(folder, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to add participants to this folder." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const permission = body.permission === "write" ? "write" : "read";
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

  const existing = await prisma.folderParticipant.findUnique({
    where: { folderId_userId: { folderId: folder.id, userId: recipient.id } },
  });
  if (existing) {
    const updated = await prisma.folderParticipant.update({ where: { id: existing.id }, data: { permission } });
    return NextResponse.json({ id: updated.id, permission: updated.permission });
  }

  const participant = await prisma.folderParticipant.create({
    data: { folderId: folder.id, userId: recipient.id, addedByUserId: session.user.id, permission },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Ledgerlot <onboarding@resend.dev>",
    to: email,
    subject: `A folder has been shared with you on Ledgerlot`,
    html: `<p>${escapeHtml(folder.name)} has been shared with you (${permission === "write" ? "can edit" : "view only"}).</p><p><a href="${appUrl}/login">Sign in</a> with this email address (${escapeHtml(email)}) to view it.</p>`,
  });

  return NextResponse.json({ id: participant.id, permission: participant.permission }, { status: 201 });
}
