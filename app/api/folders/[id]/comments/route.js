import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { renderEmail, escapeHtml } from "../../../../../lib/emailTemplate";
import { sendEmail } from "../../../../../lib/sendEmail";
import { Resend } from "resend";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  const comments = await prisma.folderComment.findMany({
    where: { folderId: folder.id },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: { id: c.author.id, name: c.author.name, email: c.author.email },
      isSelf: c.authorUserId === session.user.id,
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
  // Read-only participants can still follow the conversation but not post
  // -- matches the read/write distinction every other folder action uses.
  if (!folder._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this folder." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const text = (body.body || "").trim();
  if (!text) {
    return NextResponse.json({ error: "A comment body is required." }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "Comments are limited to 5000 characters." }, { status: 400 });
  }

  const comment = await prisma.folderComment.create({
    data: { folderId: folder.id, authorUserId: session.user.id, body: text },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  // Notify every other FolderParticipant (mirrors the archive-notification
  // scope decision: explicit participants, not every org admin, which
  // would be noisy in orgs where admins see every folder by default).
  const participants = await prisma.folderParticipant.findMany({
    where: { folderId: folder.id, userId: { not: session.user.id } },
    include: { user: { select: { email: true } } },
  });
  let emailWarning;
  if (participants.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const authorName = comment.author.name || comment.author.email;
    const results = await Promise.all(
      participants.map((p) =>
        sendEmail(resend, {
          from: "Ledgerlot <onboarding@resend.dev>",
          to: p.user.email,
          subject: `New comment on ${folder.name}`,
          html: renderEmail({
            title: "New comment",
            body: `<strong>${escapeHtml(authorName)}</strong> commented on <strong>${escapeHtml(folder.name)}</strong>:<br/><br/>${escapeHtml(text)}`,
            ctaLabel: "View the conversation",
            ctaUrl: `${appUrl}/ledgerboard/folder/${folder.id}`,
          }),
        })
      )
    );
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) emailWarning = `${failed.length} notification email(s) could not be sent. ${failed[0].error}`;
  }

  return NextResponse.json(
    {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      author: { id: comment.author.id, name: comment.author.name, email: comment.author.email },
      isSelf: true,
      ...(emailWarning ? { emailWarning } : {}),
    },
    { status: 201 }
  );
}
