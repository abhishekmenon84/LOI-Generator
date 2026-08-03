import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { getUserMembership } from "../../../../../../lib/orgAccess";

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  await prisma.apiKey.updateMany({
    where: { id: params.keyId, orgId: params.id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
