import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { getUserMembership } from "../../../../../lib/orgAccess";
import { maybeAutoUpgradeTier } from "../../../../../lib/orgBilling";
import { Resend } from "resend";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({ where: { id: params.id } });
  if (!org || org.isPersonal) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  let invitedUser = await prisma.user.findUnique({ where: { email } });
  if (!invitedUser) {
    invitedUser = await prisma.user.create({ data: { email } });
  }

  const existing = await getUserMembership(invitedUser.id, org.id);
  if (existing) {
    return NextResponse.json({ error: "This person is already a member." }, { status: 400 });
  }

  await prisma.membership.create({ data: { userId: invitedUser.id, orgId: org.id, role: "member" } });
  await maybeAutoUpgradeTier(org.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "LOI Builder <onboarding@resend.dev>",
    to: email,
    subject: `You've been added to ${org.name} on LOI Builder`,
    html: `<p>You've been added as a member of <strong>${org.name}</strong> on LOI Builder.</p><p><a href="${appUrl}/login">Sign in</a> with this email address (${email}) to get started.</p>`,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
