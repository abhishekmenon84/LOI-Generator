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
  if (deal.locked) {
    return NextResponse.json({ error: "This document has been fully signed and can no longer be deleted.", code: "DEAL_LOCKED" }, { status: 409 });
  }
  if (!(await canPermanentlyDelete(deal, session.user.id))) {
    return NextResponse.json({ error: "Only the deal's creator or an org admin can permanently delete it." }, { status: 403 });
  }
  // parentDealId cascades on delete (see prisma/schema.prisma), so a
  // locked child would otherwise be silently destroyed along with an
  // unlocked parent — refuse rather than let that happen invisibly.
  const lockedChildren = await prisma.deal.count({ where: { parentDealId: deal.id, locked: true } });
  if (lockedChildren > 0) {
    return NextResponse.json({ error: "This deal has a fully signed linked offer and cannot be permanently deleted. Unlink it first.", code: "DEAL_LOCKED" }, { status: 409 });
  }
  await prisma.deal.delete({ where: { id: deal.id } });
  return NextResponse.json({ ok: true });
}
