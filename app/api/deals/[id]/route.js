import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

async function loadOwnedDeal(dealId, userId) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || deal.userId !== userId) return null;
  return deal;
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadOwnedDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  return NextResponse.json({ id: deal.id, name: deal.name, formData: deal.formData });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadOwnedDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.formData && typeof body.formData === "object") data.formData = body.formData;
  const updated = await prisma.deal.update({ where: { id: deal.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, updatedAt: updated.updatedAt });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadOwnedDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  await prisma.deal.delete({ where: { id: deal.id } });
  return NextResponse.json({ ok: true });
}
