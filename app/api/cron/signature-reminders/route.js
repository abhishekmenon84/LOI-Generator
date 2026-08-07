import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { nextSlotsToNotify } from "../../../../lib/signingOrder";
import { renderEmail, escapeHtml } from "../../../../lib/emailTemplate";
import { sendEmail } from "../../../../lib/sendEmail";
import { Resend } from "resend";

const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

// Vercel Cron target (see vercel.json's crons entry) -- runs daily,
// auto-reminding whoever's currently unlocked on a pending signature
// request if nobody's been reminded (manually or automatically) in the
// last 3 days. Protected by CRON_SECRET since Vercel Cron calls this with
// no user session; requests missing/mismatching it are rejected.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_MS);
  const candidates = await prisma.signatureRequest.findMany({
    where: {
      status: "pending",
      expiresAt: { gt: new Date() },
      OR: [{ lastReminderSentAt: null, createdAt: { lt: cutoff } }, { lastReminderSentAt: { lt: cutoff } }],
    },
    include: { ledger: true, signers: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const resend = new Resend(process.env.RESEND_API_KEY);
  let remindedRequests = 0;
  let failedEmails = 0;

  for (const sigRequest of candidates) {
    const toNotify = nextSlotsToNotify(sigRequest.signers);
    if (toNotify.length === 0) continue;

    const results = await Promise.all(
      toNotify.map((s) =>
        sendEmail(resend, {
          from: "Ledgerlot <onboarding@resend.dev>",
          to: s.email,
          subject: `Reminder: please sign ${sigRequest.ledger.name}`,
          html: renderEmail({
            title: "Reminder: your signature is requested",
            body: `This is a reminder that you've been asked to sign <strong>${escapeHtml(sigRequest.ledger.name)}</strong> as ${escapeHtml(s.roleOtherLabel || s.role)}.`,
            ctaLabel: "Review and sign",
            ctaUrl: `${appUrl}/sign/${s.signingToken}`,
            footerNote: "Didn't expect this? You can safely ignore this email.",
          }),
        })
      )
    );
    failedEmails += results.filter((r) => !r.ok).length;
    await prisma.signatureRequest.update({ where: { id: sigRequest.id }, data: { lastReminderSentAt: new Date() } });
    remindedRequests++;
  }

  return NextResponse.json({ ok: true, remindedRequests, failedEmails });
}
