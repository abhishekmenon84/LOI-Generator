import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { getUserMembership } from "../../../../../../lib/orgAccess";

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const requesterMembership = await getUserMembership(session.user.id, params.id);
  if (!requesterMembership || requesterMembership.role !== "admin") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (params.userId === session.user.id) {
    return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });
  }

  await prisma.membership.deleteMany({ where: { userId: params.userId, orgId: params.id } });
  return NextResponse.json({ ok: true });
}
