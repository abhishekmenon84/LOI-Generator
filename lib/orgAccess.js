import { prisma } from "./prisma";

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_MS);
  // Never auto-purge a locked (fully signed) deal, and never purge a deal
  // that has a locked child — parentDealId cascades on delete, so purging
  // an ordinary trashed parent would otherwise silently destroy a signed
  // child's audit trail with no guard, the same risk the manual
  // permanent-delete route explicitly checks for.
  const candidates = await prisma.deal.findMany({
    where: { deletedAt: { lt: cutoff }, locked: false },
    select: { id: true, children: { where: { locked: true }, select: { id: true } } },
  });
  const purgeableIds = candidates.filter((d) => d.children.length === 0).map((d) => d.id);
  if (purgeableIds.length > 0) {
    await prisma.deal.deleteMany({ where: { id: { in: purgeableIds } } });
  }
}

export async function getUserMembership(userId, orgId) {
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  return membership?.active ? membership : null;
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
export async function listAccessibleDeals(userId, options = {}) {
  await purgeExpiredTrash();
  const includeArchived = !!options.includeArchived;
  const includeTrashed = !!options.includeTrashed;
  const lifecycleFilter = includeArchived || includeTrashed
    ? {}
    : { archivedAt: null, deletedAt: null };

  const memberships = await prisma.membership.findMany({ where: { userId, active: true } });

  const adminOrgIds = memberships.filter((m) => m.role === "admin").map((m) => m.orgId);
  const memberOrgIds = memberships.filter((m) => m.role === "member").map((m) => m.orgId);

  const ownedOrCreated = memberships.length > 0
    ? await prisma.deal.findMany({
        where: {
          ...lifecycleFilter,
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
  const sharedDeals = shares
    .filter((s) => includeArchived || includeTrashed || (!s.deal.archivedAt && !s.deal.deletedAt))
    .map((s) => ({ ...s.deal, _accessReason: "share", _writeAccess: s.permission === "write" }));

  const ownedIds = new Set(ownedOrCreated.map((d) => d.id));
  const merged = [
    ...ownedOrCreated.map((d) => ({ ...d, _accessReason: d.createdByUserId === userId ? "creator" : "admin", _writeAccess: true })),
    ...sharedDeals.filter((d) => !ownedIds.has(d.id)),
  ];

  const visibleIds = new Set(merged.map((d) => d.id));
  const sanitized = merged.map((d) =>
    d.parentDealId && !visibleIds.has(d.parentDealId) ? { ...d, parentDealId: null } : d
  );

  return sanitized.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// A user's personal (isPersonal: true) org — used as the default org for
// deal creation when no explicit orgId is supplied (e.g. from the existing
// "New Deal" flow, which has no org-selection UI yet).
export async function getPersonalOrgId(userId) {
  const membership = await prisma.membership.findFirst({
    where: { userId, active: true, org: { isPersonal: true } },
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
    where: { userId, active: true, org: { isPersonal: false } },
    select: { id: true },
  });
  return !!membership;
}

// The caller's own org memberships (personal + any active business orgs),
// for populating an org-picker UI. Never exposes another user's org list —
// always scoped to the given userId.
export async function listUserOrgs(userId) {
  const memberships = await prisma.membership.findMany({
    where: { userId, active: true },
    include: { org: { select: { id: true, name: true, isPersonal: true } } },
  });
  return memberships.map((m) => ({
    orgId: m.org.id,
    orgName: m.org.name,
    isPersonal: m.org.isPersonal,
    role: m.role,
  }));
}

// Deals in Archive or Trash that the user can see — same access rules as
// listAccessibleDeals, but scoped to exactly one lifecycle state at a time
// (never both), for populating the dashboard's Archive/Trash columns.
export async function listLifecycleDeals(userId, state) {
  // listAccessibleDeals already purges — no need to do it twice per call.
  const all = await listAccessibleDeals(userId, { includeArchived: true, includeTrashed: true });
  if (state === "trash") return all.filter((d) => !!d.deletedAt);
  if (state === "archive") return all.filter((d) => !!d.archivedAt && !d.deletedAt);
  return [];
}
