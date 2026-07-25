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

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const org = await prisma.organization.findUnique({ where: { id: params.id } });
  if (!org || org.isPersonal) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (!("logoUrl" in body)) {
    return NextResponse.json({ error: "logoUrl is required (use null to clear it)." }, { status: 400 });
  }
  let logoUrl = body.logoUrl;
  if (logoUrl !== null) {
    if (typeof logoUrl !== "string" || logoUrl.trim().length === 0) {
      return NextResponse.json({ error: "logoUrl must be a non-empty string or null." }, { status: 400 });
    }
    logoUrl = logoUrl.trim();
    let parsed;
    try {
      parsed = new URL(logoUrl);
    } catch {
      return NextResponse.json({ error: "logoUrl must be a valid URL." }, { status: 400 });
    }
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "logoUrl must use https." }, { status: 400 });
    }
  }

  await prisma.organization.update({ where: { id: org.id }, data: { logoUrl } });
  return NextResponse.json({ ok: true, logoUrl });
}
