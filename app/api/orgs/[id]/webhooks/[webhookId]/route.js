import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { getUserMembership } from "../../../../../../lib/orgAccess";

async function requireAdmin(orgId, userId) {
  const membership = await getUserMembership(userId, orgId);
  return !!membership && membership.role === "admin";
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await requireAdmin(params.id, session.user.id))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.active === "boolean") data.active = body.active;
  const updated = await prisma.webhook.updateMany({ where: { id: params.webhookId, orgId: params.id }, data });
  return NextResponse.json({ ok: updated.count > 0 });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await requireAdmin(params.id, session.user.id))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  await prisma.webhook.deleteMany({ where: { id: params.webhookId, orgId: params.id } });
  return NextResponse.json({ ok: true });
}
