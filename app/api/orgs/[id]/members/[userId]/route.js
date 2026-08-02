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

  if ("role" in body) {
    // Only the org's founding admin (Organization.ownerUserId) may
    // promote or demote -- being "an admin" isn't enough, since the spec
    // is "only the first person who signed up can appoint the one other
    // admin slot," not "any admin can nominate any other admin."
    const org = await prisma.organization.findUnique({ where: { id: params.id }, select: { ownerUserId: true } });
    if (!org || org.ownerUserId !== session.user.id) {
      return NextResponse.json({ error: "Only the organization's owner can change admin roles." }, { status: 403 });
    }
    if (body.role !== "admin" && body.role !== "member") {
      return NextResponse.json({ error: "role must be \"admin\" or \"member\"." }, { status: 400 });
    }
    if (params.userId === session.user.id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }
    if (body.role === "admin") {
      const adminCount = await prisma.membership.count({ where: { orgId: params.id, role: "admin", active: true } });
      if (adminCount >= 2) {
        return NextResponse.json({ error: "An organization can have at most 2 admins. Demote the other admin first." }, { status: 400 });
      }
    }
    const updated = await prisma.membership.updateMany({ where: { userId: params.userId, orgId: params.id }, data: { role: body.role } });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

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
