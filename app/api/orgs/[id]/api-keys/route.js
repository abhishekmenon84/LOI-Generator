import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { getUserMembership } from "../../../../../lib/orgAccess";
import { getOrgLimits } from "../../../../../lib/orgBilling";
import { generateApiKey } from "../../../../../lib/apiKeyAuth";

// API access is a Business-tier feature (matches e-sign/branding/etc,
// which already gate on getOrgLimits) -- no personal-org API keys.
async function requireAdminBusinessOrg(orgId, userId) {
  const membership = await getUserMembership(userId, orgId);
  if (!membership || membership.role !== "admin") return { error: "Admin access required.", status: 403 };
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org || org.isPersonal) return { error: "API access is a Business-org feature.", status: 400 };
  const limits = getOrgLimits(org);
  if (!limits.canCreate) return { error: "Your organization's subscription is not active.", status: 402, code: "UPGRADE_REQUIRED" };
  return { org };
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const gate = await requireAdminBusinessOrg(params.id, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error, ...(gate.code ? { code: gate.code } : {}) }, { status: gate.status });
  }

  const keys = await prisma.apiKey.findMany({
    where: { orgId: params.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    keys: keys.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt })),
  });
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const gate = await requireAdminBusinessOrg(params.id, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error, ...(gate.code ? { code: gate.code } : {}) }, { status: gate.status });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim() || "API key";

  const { raw, keyHash, keyPrefix } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: { orgId: params.id, name, keyHash, keyPrefix, createdByUserId: session.user.id },
  });

  // The raw key is returned exactly once, here -- it is never stored or
  // retrievable again, only its hash/prefix (see lib/apiKeyAuth.js).
  return NextResponse.json({ id: apiKey.id, name: apiKey.name, key: raw, keyPrefix }, { status: 201 });
}
