import { prisma } from "./prisma";

export async function getUserMembership(userId, orgId) {
  return prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
}

// Returns the deal (with two extra, non-persisted marker fields —
// _accessReason: "admin" | "creator" | "share", and _writeAccess: boolean)
// only if the requesting user has access under one of three rules:
// org-admin-sees-all, creator-sees-own, or an active DealShare grant.
// Never distinguishes "deal doesn't exist" from "deal exists but you
// can't see it" — both return null, consistent with this project's
// established not-found pattern for access control.
export async function loadAccessibleDeal(dealId, userId) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) return null;

  const membership = await getUserMembership(userId, deal.orgId);
  if (membership) {
    if (membership.role === "admin") {
      return { ...deal, _accessReason: "admin", _writeAccess: true };
    }
    if (deal.createdByUserId === userId) {
      return { ...deal, _accessReason: "creator", _writeAccess: true };
    }
  }

  const share = await prisma.dealShare.findUnique({
    where: { dealId_grantedToUserId: { dealId, grantedToUserId: userId } },
  });
  if (share) {
    return { ...deal, _accessReason: "share", _writeAccess: share.permission === "write" };
  }

  return null;
}

// Lists every deal the user can see: every deal in orgs where they're
// admin, their own-created deals in orgs where they're a member, plus
// any deal explicitly shared with them (regardless of org).
export async function listAccessibleDeals(userId) {
  const memberships = await prisma.membership.findMany({ where: { userId } });

  const adminOrgIds = memberships.filter((m) => m.role === "admin").map((m) => m.orgId);
  const memberOrgIds = memberships.filter((m) => m.role === "member").map((m) => m.orgId);

  const ownedOrCreated = memberships.length > 0
    ? await prisma.deal.findMany({
        where: {
          OR: [
            ...(adminOrgIds.length > 0 ? [{ orgId: { in: adminOrgIds } }] : []),
            ...(memberOrgIds.length > 0 ? [{ orgId: { in: memberOrgIds }, createdByUserId: userId }] : []),
          ],
        },
      })
    : [];

  const shares = await prisma.dealShare.findMany({
    where: { grantedToUserId: userId },
    include: { deal: true },
  });
  const sharedDeals = shares.map((s) => ({ ...s.deal, _accessReason: "share", _writeAccess: s.permission === "write" }));

  const ownedIds = new Set(ownedOrCreated.map((d) => d.id));
  const merged = [
    ...ownedOrCreated.map((d) => ({ ...d, _accessReason: d.createdByUserId === userId ? "creator" : "admin", _writeAccess: true })),
    ...sharedDeals.filter((d) => !ownedIds.has(d.id)),
  ];

  return merged.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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

// True if the user has real membership in any non-personal organization
// (as admin or member) — used to decide personal vs. business dashboard
// routing. Distinct from getPersonalOrgId, which always exists for every
// user; this specifically checks for a REAL business org.
export async function hasBusinessOrgMembership(userId) {
  const membership = await prisma.membership.findFirst({
    where: { userId, org: { isPersonal: false } },
    select: { id: true },
  });
  return !!membership;
}
