import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { isPlatformAdmin } from "../../../../../../lib/platformAdmin";
import { renderEmail, escapeHtml } from "../../../../../../lib/emailTemplate";
import { sendEmail, EMAIL_FROM } from "../../../../../../lib/sendEmail";
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
  const rejectionReason = (body.rejectionReason || "").trim();
  if (!rejectionReason) {
    return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.organization.update({ where: { id: org.id }, data: { verificationStatus: "rejected" } }),
    prisma.businessVerificationDocument.update({
      where: { orgId: org.id },
      data: { reviewedByUserId: session.user.id, reviewNotes: rejectionReason },
    }),
  ]);

  let emailWarning;
  if (org.ownerUserId) {
    const owner = await prisma.user.findUnique({ where: { id: org.ownerUserId }, select: { email: true } });
    if (owner?.email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await sendEmail(resend, {
        from: EMAIL_FROM,
        to: owner.email,
        subject: `Business verification needs attention: ${org.name}`,
        html: renderEmail({
          title: "Business verification not approved",
          body: `We couldn't verify <strong>${escapeHtml(org.name)}</strong>.<br/><br/>Reason: ${escapeHtml(rejectionReason)}<br/><br/>You can re-submit your document from Settings at any time.`,
        }),
      });
      if (!result.ok) emailWarning = `Notification email could not be sent. ${result.error}`;
    }
  }

  return NextResponse.json({ ok: true, status: "rejected", ...(emailWarning ? { emailWarning } : {}) });
}
