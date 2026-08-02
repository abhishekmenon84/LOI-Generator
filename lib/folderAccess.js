import { prisma } from "./prisma";
import { getUserMembership } from "./orgAccess";

// Returns the Folder (with two extra, non-persisted marker fields --
// _accessReason: "admin" | "creator" | "participant", and _writeAccess:
// boolean) only if the requesting user has access under one of three
// rules: org-admin-sees-all, creator-sees-own, or an explicit
// FolderParticipant grant. Never distinguishes "folder doesn't exist" from
// "folder exists but you can't see it" -- both return null, matching
// lib/orgAccess.js's loadAccessibleDeal precedent. This check is NOT
// inherited down the tree -- each folder's access is evaluated
// independently of its parent/children's participants.
export async function loadAccessibleFolder(folderId, userId) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) return null;

  const membership = await getUserMembership(userId, folder.orgId);
  if (membership) {
    if (membership.role === "admin") {
      return { ...folder, _accessReason: "admin", _writeAccess: true };
    }
    if (folder.createdByUserId === userId) {
      return { ...folder, _accessReason: "creator", _writeAccess: true };
    }
  }

  const participant = await prisma.folderParticipant.findUnique({
    where: { folderId_userId: { folderId, userId } },
  });
  if (participant) {
    return { ...folder, _accessReason: "participant", _writeAccess: participant.permission === "write" };
  }

  return null;
}

// Lists every Folder the user can see: every folder in orgs where they're
// admin, their own-created folders in orgs where they're a member, plus
// any folder they're an explicit FolderParticipant on (regardless of org).
export async function listAccessibleFolders(userId, options = {}) {
  const includeArchived = !!options.includeArchived;
  const lifecycleFilter = includeArchived ? {} : { archivedAt: null };

  const memberships = await prisma.membership.findMany({ where: { userId, active: true } });
  const adminOrgIds = memberships.filter((m) => m.role === "admin").map((m) => m.orgId);
  const memberOrgIds = memberships.filter((m) => m.role === "member").map((m) => m.orgId);

  const ownedOrCreated = memberships.length > 0
    ? await prisma.folder.findMany({
        where: {
          AND: [
            lifecycleFilter,
            {
              OR: [
                ...(adminOrgIds.length > 0 ? [{ orgId: { in: adminOrgIds } }] : []),
                ...(memberOrgIds.length > 0 ? [{ orgId: { in: memberOrgIds }, createdByUserId: userId }] : []),
              ],
            },
          ],
        },
      })
    : [];

  const participations = await prisma.folderParticipant.findMany({
    where: { userId },
    include: { folder: true },
  });
  const participantFolders = participations
    .filter((p) => (includeArchived ? true : !p.folder.archivedAt))
    .map((p) => ({ ...p.folder, _accessReason: "participant", _writeAccess: p.permission === "write" }));

  const ownedIds = new Set(ownedOrCreated.map((f) => f.id));
  const merged = [
    ...ownedOrCreated.map((f) => ({ ...f, _accessReason: f.createdByUserId === userId ? "creator" : "admin", _writeAccess: true })),
    ...participantFolders.filter((f) => !ownedIds.has(f.id)),
  ];

  return merged.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// Walks up from folderId's immediate parent to the root, returning the
// chain of ancestor Folder IDs (nearest first). Empty array if folderId
// has no parent. Used by nest/move cycle-prevention: a folder cannot be
// nested under any folder that appears in its own ancestor chain (which
// would include itself, if it were already an ancestor of the target).
export async function getFolderAncestorChain(folderId) {
  const chain = [];
  let currentId = folderId;
  const seen = new Set();
  while (currentId) {
    if (seen.has(currentId)) break; // defensive: pre-existing cycle should never happen, but never infinite-loop
    seen.add(currentId);
    const current = await prisma.folder.findUnique({ where: { id: currentId }, select: { parentFolderId: true } });
    if (!current || !current.parentFolderId) break;
    chain.push(current.parentFolderId);
    currentId = current.parentFolderId;
  }
  return chain;
}
