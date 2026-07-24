import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleDeal, getUserMembership } from "../../../../../lib/orgAccess";

async function canPermanentlyDelete(deal, userId) {
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
  if (!deal.deletedAt) {
    return NextResponse.json({ error: "This deal must be in Trash before it can be permanently deleted." }, { status: 409 });
  }
  if (!(await canPermanentlyDelete(deal, session.user.id))) {
    return NextResponse.json({ error: "Only the deal's creator or an org admin can permanently delete it." }, { status: 403 });
  }
  await prisma.deal.delete({ where: { id: deal.id } });
  return NextResponse.json({ ok: true });
}
