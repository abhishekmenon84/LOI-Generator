import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { renderEmail, escapeHtml } from "../../../../../lib/emailTemplate";
import { Resend } from "resend";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!folder._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this folder." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = (body.reason || "").trim();
  if (reason.length < 10) {
    return NextResponse.json({ error: "A reason of at least 10 characters is required." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.folder.update({ where: { id: folder.id }, data: { archivedAt: new Date() } }),
    prisma.folderAuditEvent.create({
      data: { folderId: folder.id, actorUserId: session.user.id, action: "archived", reason },
    }),
  ]);

  // Notify explicit FolderParticipants (not every org admin -- that would
  // be noisy for orgs where admins see every folder by default) so a
  // shared collaborator finds out their deal moved instead of just seeing
  // it vanish from their active view with no explanation.
  const participants = await prisma.folderParticipant.findMany({
    where: { folderId: folder.id, userId: { not: session.user.id } },
    include: { user: { select: { email: true } } },
  });
  if (participants.length > 0) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    await Promise.all(
      participants.map((p) =>
        resend.emails
          .send({
            from: "Ledgerlot <onboarding@resend.dev>",
            to: p.user.email,
            subject: `Folder archived: ${folder.name}`,
            html: renderEmail({
              title: "Folder archived",
              body: `<strong>${escapeHtml(folder.name)}</strong>, a folder you have access to, has been archived.<br/><br/>Reason: ${escapeHtml(reason)}`,
              ctaLabel: "View archive",
              ctaUrl: `${appUrl}/archive`,
            }),
          })
          .catch((err) => console.error("[folder archive] notification email failed:", err))
      )
    );
  }

  return NextResponse.json({ ok: true });
}
