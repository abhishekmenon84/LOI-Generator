import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { isPlatformAdmin } from "../../../../../../lib/platformAdmin";
import { renderEmail, escapeHtml } from "../../../../../../lib/emailTemplate";
import { sendEmail } from "../../../../../../lib/sendEmail";
import { Resend } from "resend";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.email || !isPlatformAdmin(session.user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({ where: { id: params.orgId }, include: { verificationDocument: true } });
  if (!org || !org.verificationDocument) {
    return NextResponse.json({ error: "No verification submission found for this organization." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const approvalNotes = (body.approvalNotes || "").trim() || null;

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: { verificationStatus: "verified", verificationApprovedAt: new Date() },
    }),
    prisma.businessVerificationDocument.update({
      where: { orgId: org.id },
      data: { reviewedByUserId: session.user.id, reviewNotes: approvalNotes },
    }),
  ]);

  let emailWarning;
  if (org.ownerUserId) {
    const owner = await prisma.user.findUnique({ where: { id: org.ownerUserId }, select: { email: true } });
    if (owner?.email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await sendEmail(resend, {
        from: "Ledgerlot <onboarding@resend.dev>",
        to: owner.email,
        subject: `Business verified: ${org.name}`,
        html: renderEmail({
          title: "Business verification approved",
          body: `<strong>${escapeHtml(org.name)}</strong> has been verified.`,
        }),
      });
      if (!result.ok) emailWarning = `Notification email could not be sent. ${result.error}`;
    }
  }

  return NextResponse.json({ ok: true, status: "verified", ...(emailWarning ? { emailWarning } : {}) });
}
