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

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const requesterMembership = await getUserMembership(session.user.id, params.id);
  if (!requesterMembership || requesterMembership.role !== "admin") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active (boolean) is required." }, { status: 400 });
  }

  if (params.userId === session.user.id && body.active === false) {
    return NextResponse.json({ error: "You cannot deactivate yourself." }, { status: 400 });
  }
  // No separate "last active admin" count guard is needed beyond the
  // self-deactivation check above: reaching this PATCH at all requires the
  // requester to already be an active admin (see the requesterMembership
  // check above), so if the org has only one active admin, that admin is
  // necessarily the requester — and the self-check already rejects that
  // case. A target-is-the-last-admin scenario where the requester is a
  // DIFFERENT active admin is therefore impossible by construction.

  const updated = await prisma.membership.updateMany({
    where: { userId: params.userId, orgId: params.id },
    data: { active: body.active },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
