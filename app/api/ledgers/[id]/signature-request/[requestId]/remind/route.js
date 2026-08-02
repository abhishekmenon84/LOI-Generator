import { NextResponse } from "next/server";
import { auth } from "../../../../../../../lib/auth";
import { prisma } from "../../../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../../../lib/folderAccess";
import { nextSlotsToNotify } from "../../../../../../../lib/signingOrder";
import { Resend } from "resend";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Manually re-sends the signing-link email to whoever's currently unlocked
// (see lib/signingOrder.js) -- the sender's own "nudge" action, distinct
// from the automatic reminder cron (app/api/cron/signature-reminders/route.js)
// which does the same thing on a schedule for requests nobody's touched in
// a while.
export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ledger = await prisma.ledger.findUnique({ where: { id: params.id } });
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  const folder = await loadAccessibleFolder(ledger.folderId, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  if (!folder._writeAccess) {
    return NextResponse.json({ error: "Not authorized to send reminders for this document." }, { status: 403 });
  }

  const sigRequest = await prisma.signatureRequest.findUnique({
    where: { id: params.requestId },
    include: { signers: true },
  });
  if (!sigRequest || sigRequest.ledgerId !== ledger.id || sigRequest.status !== "pending") {
    return NextResponse.json({ error: "No in-progress signature request found." }, { status: 404 });
  }

  const toNotify = nextSlotsToNotify(sigRequest.signers);
  if (toNotify.length === 0) {
    return NextResponse.json({ error: "There's no one currently waiting to sign." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await Promise.all(
    toNotify.map((s) =>
      resend.emails.send({
        from: "Ledgerlot <onboarding@resend.dev>",
        to: s.email,
        subject: `Reminder: please sign ${ledger.name}`,
        html: `<p>This is a reminder that you've been asked to sign <strong>${escapeHtml(ledger.name)}</strong> as ${escapeHtml(s.roleOtherLabel || s.role)}.</p><p><a href="${appUrl}/sign/${s.signingToken}">Review and sign</a></p>`,
      })
    )
  );

  await prisma.signatureRequest.update({ where: { id: sigRequest.id }, data: { lastReminderSentAt: new Date() } });

  return NextResponse.json({ ok: true, remindedCount: toNotify.length });
}
