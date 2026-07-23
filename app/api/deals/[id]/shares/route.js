import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleDeal, getUserMembership } from "../../../../../lib/orgAccess";
import { Resend } from "resend";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function canManageShares(deal, userId) {
  if (deal.createdByUserId === userId) return true;
  const membership = await getUserMembership(userId, deal.orgId);
  return !!membership && membership.role === "admin";
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadAccessibleDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (!(await canManageShares(deal, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to view shares for this deal." }, { status: 403 });
  }

  const shares = await prisma.dealShare.findMany({
    where: { dealId: params.id },
    include: { grantedTo: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    shares: shares.map((s) => ({
      id: s.id,
      email: s.grantedTo.email,
      name: s.grantedTo.name,
      permission: s.permission,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadAccessibleDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (!(await canManageShares(deal, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to share this deal." }, { status: 403 });
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
    return NextResponse.json({ error: "You can't share a deal with yourself." }, { status: 400 });
  }

  const existing = await prisma.dealShare.findUnique({
    where: { dealId_grantedToUserId: { dealId: deal.id, grantedToUserId: recipient.id } },
  });
  if (existing) {
    const updated = await prisma.dealShare.update({ where: { id: existing.id }, data: { permission } });
    return NextResponse.json({ id: updated.id, permission: updated.permission });
  }

  const share = await prisma.dealShare.create({
    data: { dealId: deal.id, grantedToUserId: recipient.id, grantedByUserId: session.user.id, permission },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "LOI Builder <onboarding@resend.dev>",
    to: email,
    subject: `A document has been shared with you on LOI Builder`,
    html: `<p>${escapeHtml(deal.name)} has been shared with you (${permission === "write" ? "can edit" : "view only"}).</p><p><a href="${appUrl}/login">Sign in</a> with this email address (${escapeHtml(email)}) to view it.</p>`,
  });

  return NextResponse.json({ id: share.id, permission: share.permission }, { status: 201 });
}
