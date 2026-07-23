import { prisma } from "./prisma";

export async function getUserMembership(userId, orgId) {
  return prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
}

// Returns the deal only if the requesting user has access under the
// admin-sees-all / member-sees-own-only rule. Never distinguishes
// "deal doesn't exist" from "deal exists but you can't see it" — both
// return null, consistent with this project's established not-found
// pattern for access control.
export async function loadAccessibleDeal(dealId, userId) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) return null;

  const membership = await getUserMembership(userId, deal.orgId);
  if (!membership) return null;

  if (membership.role === "admin") return deal;
  if (deal.createdByUserId === userId) return deal;
  return null;
}

// Lists every deal the user can see: every deal in orgs where they're
// admin, plus their own-created deals in orgs where they're a member.
export async function listAccessibleDeals(userId) {
  const memberships = await prisma.membership.findMany({ where: { userId } });
  if (memberships.length === 0) return [];

  const adminOrgIds = memberships.filter((m) => m.role === "admin").map((m) => m.orgId);
  const memberOrgIds = memberships.filter((m) => m.role === "member").map((m) => m.orgId);

  return prisma.deal.findMany({
    where: {
      OR: [
        ...(adminOrgIds.length > 0 ? [{ orgId: { in: adminOrgIds } }] : []),
        ...(memberOrgIds.length > 0 ? [{ orgId: { in: memberOrgIds }, createdByUserId: userId }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
}

// A user's personal (isPersonal: true) org — used as the default org for
// deal creation when no explicit orgId is supplied (e.g. from the existing
// "New Deal" flow, which has no org-selection UI yet).
export async function getPersonalOrgId(userId) {
  const membership = await prisma.membership.findFirst({
    where: { userId, org: { isPersonal: true } },
    select: { orgId: true },
  });
  return membership?.orgId || null;
}
