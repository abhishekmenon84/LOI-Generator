import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleDeal } from "../../../../../lib/orgAccess";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadAccessibleDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (!deal._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this deal." }, { status: 403 });
  }
  if (deal.deletedAt) {
    return NextResponse.json({ error: "This deal is in Trash. Restore it before archiving." }, { status: 409 });
  }
  await prisma.deal.update({ where: { id: deal.id }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
