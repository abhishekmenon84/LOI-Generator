import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { getUserMembership } from "../../../../lib/orgAccess";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    include: {
      memberships: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });
  if (!org) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: org.id,
    name: org.name,
    accountType: org.accountType,
    planTier: org.planTier,
    trialEndsAt: org.trialEndsAt,
    members: org.memberships.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    })),
  });
}
