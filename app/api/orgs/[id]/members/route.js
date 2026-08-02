import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { getUserMembership, hasBusinessOrgMembership } from "../../../../../lib/orgAccess";
import { isOrgActive, maybeAutoUpgradeTier } from "../../../../../lib/orgBilling";
import { Resend } from "resend";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

  if (!isOrgActive(org)) {
    return NextResponse.json({ error: "Your organization's trial has ended. Subscribe to continue.", code: "TRIAL_EXPIRED" }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  let invitedUser = await prisma.user.findUnique({ where: { email } });
  if (!invitedUser) {
    // Mirrors lib/auth.js's events.createUser: that hook only fires when
    // NextAuth's own PrismaAdapter inserts a new User row (i.e. on that
    // person's first real sign-in), which this manual invite-time
    // creation bypasses entirely -- without this, an invited person who
    // has never signed in yet would have no personal org and hit "No
    // organization found for this account" the first time they tried to
    // create a folder there.
    invitedUser = await prisma.user.create({ data: { email } });
    await prisma.organization.create({
      data: {
        name: "Personal",
        accountType: "individual",
        isPersonal: true,
        planTier: "free",
        memberships: { create: { userId: invitedUser.id, role: "admin" } },
      },
    });
  }

  const existing = await getUserMembership(invitedUser.id, org.id);
  if (existing) {
    return NextResponse.json({ error: "This person is already a member." }, { status: 400 });
  }

  // Enforce the same "1 business org per user" cap as POST /api/orgs --
  // an invite can't smuggle someone into a second business org either.
  if (await hasBusinessOrgMembership(invitedUser.id)) {
    return NextResponse.json({ error: "This person already belongs to a different business organization." }, { status: 400 });
  }

  // getUserMembership only returns active rows, so a previously-deactivated
  // member's row wouldn't be caught by the check above — look it up
  // directly (ignoring active state) and reactivate rather than attempting
  // a second insert, which would violate the (userId, orgId) unique
  // constraint and throw an unhandled 500.
  const inactiveRow = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: invitedUser.id, orgId: org.id } },
  });
  if (inactiveRow) {
    await prisma.membership.update({ where: { id: inactiveRow.id }, data: { active: true } });
  } else {
    await prisma.membership.create({ data: { userId: invitedUser.id, orgId: org.id, role: "member" } });
  }
  await maybeAutoUpgradeTier(org.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Ledgerlot <onboarding@resend.dev>",
    to: email,
    subject: `You've been added to ${org.name} on Ledgerlot`,
    html: `<p>You've been added as a member of <strong>${escapeHtml(org.name)}</strong> on Ledgerlot.</p><p><a href="${appUrl}/login">Sign in</a> with this email address (${escapeHtml(email)}) to get started.</p>`,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
