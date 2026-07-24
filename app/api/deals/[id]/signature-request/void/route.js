import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { loadAccessibleDeal, getUserMembership } from "../../../../../../lib/orgAccess";

async function canManageSignatureRequest(deal, userId) {
  if (deal.createdByUserId === userId) return true;
  const membership = await getUserMembership(userId, deal.orgId);
  return !!membership && membership.role === "admin";
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
  if (!(await canManageSignatureRequest(deal, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to void this deal's signature request." }, { status: 403 });
  }

  const pending = await prisma.signatureRequest.findFirst({ where: { dealId: deal.id, status: "pending" } });
  if (!pending) {
    return NextResponse.json({ error: "No in-progress signature request to void." }, { status: 400 });
  }

  await prisma.signatureRequest.update({ where: { id: pending.id }, data: { status: "voided", voidedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
