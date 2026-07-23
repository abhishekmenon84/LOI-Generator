import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { loadAccessibleDeal, getUserMembership } from "../../../../../../lib/orgAccess";

async function canManageShares(deal, userId) {
  if (deal.createdByUserId === userId) return true;
  const membership = await getUserMembership(userId, deal.orgId);
  return !!membership && membership.role === "admin";
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadAccessibleDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (!(await canManageShares(deal, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to remove shares for this deal." }, { status: 403 });
  }

  await prisma.dealShare.deleteMany({ where: { id: params.shareId, dealId: params.id } });
  return NextResponse.json({ ok: true });
}
