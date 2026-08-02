import { redirect } from "next/navigation";
import { getPersonalOrgId, hasBusinessOrgMembership, listUserOrgs } from "../../lib/orgAccess";
import { auth } from "../../lib/auth";
import { listAccessibleFolders } from "../../lib/folderAccess";
import { prisma } from "../../lib/prisma";
import AppShell from "../../components/AppShell";
import DealList from "../../components/DealList";
import KanbanDashboard from "../../components/KanbanDashboard";

export const metadata = {
  title: "Documents — Ledgerlot",
};

// The folder/ledger pipeline itself -- a Kanban board for business orgs,
// a flat favoritable list for personal orgs. Shows ONLY active (non-
// archived) folders now -- archived folders and archived individual
// documents both moved to the dedicated /archive page (see
// app/archive/page.js), so this view no longer needs its own
// Archive/Trash columns or tabs. Trash itself no longer exists as a
// concept anywhere in the app; a folder is either Active or Archived, and
// permanent deletion (see POST /api/folders/[id]/permanent) is reachable
// only from the Archive view.
export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isBusiness = await hasBusinessOrgMembership(session.user.id);

  const activeFolders = await listAccessibleFolders(session.user.id, {});
  const userOrgs = await listUserOrgs(session.user.id);

  const folderIds = activeFolders.map((f) => f.id);
  const [participants, primaryLedgers] = folderIds.length > 0
    ? await Promise.all([
        prisma.folderParticipant.findMany({
          where: { folderId: { in: folderIds } },
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.ledger.findMany({
          where: { folderId: { in: folderIds } },
          select: { folderId: true, documentType: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        }),
      ])
    : [[], []];
  const participantNamesByFolder = new Map();
  for (const p of participants) {
    const list = participantNamesByFolder.get(p.folderId) || [];
    list.push(p.user.name || p.user.email);
    participantNamesByFolder.set(p.folderId, list);
  }
  // First-created Ledger per Folder stands in as the folder's "primary"
  // document type for the card/list's type pill -- a bare Folder has no
  // documentType of its own, only its child Ledgers do.
  const primaryDocTypeByFolder = new Map();
  for (const l of primaryLedgers) {
    if (!primaryDocTypeByFolder.has(l.folderId)) primaryDocTypeByFolder.set(l.folderId, l.documentType);
  }

  if (isBusiness) {
    const serializeFolder = (f) => ({
      id: f.id,
      name: f.name,
      stage: f.stage,
      priority: f.priority,
      updatedAt: f.updatedAt.toISOString(),
      isShared: f._accessReason === "participant",
      writeAccess: f._writeAccess,
      parentFolderId: f.parentFolderId,
      orgId: f.orgId,
      participantNames: participantNamesByFolder.get(f.id) || [],
      documentType: primaryDocTypeByFolder.get(f.id) || null,
    });

    const businessOrg = userOrgs.find((o) => !o.isPersonal);
    return (
      <AppShell
        org={businessOrg ? { name: businessOrg.orgName, isPersonal: false, planTier: null } : null}
        userInitial={(session.user.email || "?").charAt(0).toUpperCase()}
      >
        <div style={{ padding: "32px 28px" }}>
          <h1 style={{ marginBottom: 4 }}>Documents</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>Drag a folder between stages.</p>
          <KanbanDashboard
            initialFolders={activeFolders.map(serializeFolder)}
            userOrgs={userOrgs}
          />
        </div>
      </AppShell>
    );
  }

  const serialize = (f) => ({
    id: f.id,
    name: f.name,
    documentType: primaryDocTypeByFolder.get(f.id) || null,
    stage: f.stage,
    updatedAt: f.updatedAt.toISOString(),
    isShared: f._accessReason === "participant",
    writeAccess: f._writeAccess,
    parentFolderId: f.parentFolderId,
    priority: f.priority,
    favorite: f.favorite,
  });

  const personalOrgId = await getPersonalOrgId(session.user.id);
  const personalOrg = personalOrgId ? await prisma.organization.findUnique({ where: { id: personalOrgId } }) : null;

  return (
    <AppShell
      org={personalOrg ? { name: personalOrg.name, isPersonal: true, planTier: personalOrg.planTier } : null}
      userInitial={(session.user.email || "?").charAt(0).toUpperCase()}
    >
      <div style={{ padding: "32px 28px" }}>
        <h1>Documents</h1>
        <DealList
          initialFolders={activeFolders.map(serialize)}
          userOrgs={userOrgs}
        />
      </div>
    </AppShell>
  );
}
