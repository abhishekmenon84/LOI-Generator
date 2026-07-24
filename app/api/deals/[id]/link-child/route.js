import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleDeal } from "../../../../../lib/orgAccess";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const parent = await loadAccessibleDeal(params.id, session.user.id);
  if (!parent) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (!parent._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this deal." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const childDealId = body.childDealId;
  if (!childDealId || childDealId === params.id) {
    return NextResponse.json({ error: "A valid childDealId is required." }, { status: 400 });
  }

  const child = await loadAccessibleDeal(childDealId, session.user.id);
  if (!child) {
    return NextResponse.json({ error: "Child deal not found." }, { status: 404 });
  }
  if (!child._writeAccess) {
    return NextResponse.json({ error: "You only have read access to the child deal." }, { status: 403 });
  }
  if (child.orgId !== parent.orgId) {
    return NextResponse.json({ error: "Deals must be in the same organization to link." }, { status: 403 });
  }
  if (child.parentDealId) {
    return NextResponse.json({ error: "That deal is already linked to another parent. Unlink it first." }, { status: 409 });
  }
  if (parent.parentDealId) {
    return NextResponse.json({ error: "A child deal cannot itself become a parent." }, { status: 409 });
  }
  const childHasChildren = await prisma.deal.count({ where: { parentDealId: child.id } });
  if (childHasChildren > 0) {
    return NextResponse.json({ error: "That deal already has its own linked offers and cannot become a child." }, { status: 409 });
  }

  await prisma.deal.update({ where: { id: child.id }, data: { parentDealId: parent.id } });
  return NextResponse.json({ ok: true });
}
