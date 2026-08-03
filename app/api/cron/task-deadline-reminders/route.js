import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { renderEmail, escapeHtml } from "../../../../lib/emailTemplate";
import { Resend } from "resend";

// Vercel Cron target (see vercel.json's crons entry) -- daily, reminds a
// task's assignee (or the folder's creator, if unassigned) once when its
// due date is within the next 3 days and hasn't already been reminded
// for. Completed tasks and tasks with no due date are never reminded.
const REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const tasks = await prisma.task.findMany({
    where: {
      completed: false,
      reminderSentAt: null,
      dueDate: { gte: now, lte: windowEnd },
    },
    include: {
      folder: { select: { id: true, name: true, createdByUserId: true } },
      assignedTo: { select: { email: true } },
      createdBy: { select: { email: true } },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const resend = new Resend(process.env.RESEND_API_KEY);
  let reminded = 0;

  for (const task of tasks) {
    const recipientEmail = task.assignedTo?.email || task.createdBy?.email;
    if (!recipientEmail) continue;

    await resend.emails
      .send({
        from: "Ledgerlot <onboarding@resend.dev>",
        to: recipientEmail,
        subject: `Deadline approaching: ${task.title}`,
        html: renderEmail({
          title: "Deadline approaching",
          body: `<strong>${escapeHtml(task.title)}</strong> in <strong>${escapeHtml(task.folder.name)}</strong> is due ${new Date(task.dueDate).toLocaleDateString()}.`,
          ctaLabel: "View folder",
          ctaUrl: `${appUrl}/ledgerboard/folder/${task.folder.id}`,
        }),
      })
      .catch((err) => console.error("[cron task-deadline-reminders] send failed:", err));

    await prisma.task.update({ where: { id: task.id }, data: { reminderSentAt: new Date() } });
    reminded++;
  }

  return NextResponse.json({ ok: true, reminded });
}
