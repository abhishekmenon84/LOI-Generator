import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { getPersonalOrgId, hasBusinessOrgMembership, listUserOrgs } from "../../lib/orgAccess";
import { listAccessibleFolders } from "../../lib/folderAccess";
import { prisma } from "../../lib/prisma";
import AppShell from "../../components/AppShell";
import DashboardGreeting from "../../components/DashboardGreeting";
import DealList from "../../components/DealList";
import KanbanDashboard from "../../components/KanbanDashboard";

export const metadata = {
  title: "Ledgerboard — Ledgerlot",
};

export default async function DashboardPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Completes the "Business" choice made on /login: that choice can only be
  // threaded through as a callbackUrl query param (see app/login/page.js's
  // comment), since the actual click-through request that lands here is a
  // separate request from the original form submission, with no session of
  // its own to stash a pending choice in. Idempotent -- only fires if the
  // user doesn't already have a business org -- so refreshing this URL or
  // an already-business user landing here again is a no-op.
  if (searchParams?.newAccountType === "business" && !(await hasBusinessOrgMembership(session.user.id))) {
    await prisma.organization.create({
      data: {
        name: "My Business",
        accountType: "company",
        isPersonal: false,
        planTier: "trial",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        memberships: { create: { userId: session.user.id, role: "admin" } },
      },
    });
    redirect("/dashboard");
  }

  const isBusiness = await hasBusinessOrgMembership(session.user.id);

  // Both branches need the same underlying Folder data (all folders
  // including archived/trashed, plus batched participant names and each
  // folder's "primary" documentType derived from its first-created Ledger)
  // -- fetched once here rather than duplicated per branch, since both use
  // identical listAccessibleFolders options.
  const allFolders = await listAccessibleFolders(session.user.id, { includeArchived: true, includeTrashed: true });
  const userOrgs = await listUserOrgs(session.user.id);

  const folderIds = allFolders.map((f) => f.id);
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

    const activeFolders = allFolders.filter((f) => !f.archivedAt && !f.deletedAt).map(serializeFolder);
    const archivedFolders = allFolders.filter((f) => !!f.archivedAt && !f.deletedAt).map(serializeFolder);
    const trashedFolders = allFolders.filter((f) => !!f.deletedAt).map(serializeFolder);

    const businessOrg = userOrgs.find((o) => !o.isPersonal);
    return (
      <AppShell
        org={businessOrg ? { name: businessOrg.orgName, isPersonal: false, planTier: null } : null}
        userInitial={(session.user.email || "?").charAt(0).toUpperCase()}
      >
        <div style={{ padding: "32px 28px" }}>
          <DashboardGreeting style={{ marginBottom: 4 }} />
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>Signed in as {session.user.email}.</p>
          <KanbanDashboard
            initialFolders={activeFolders}
            initialArchivedFolders={archivedFolders}
            initialTrashedFolders={trashedFolders}
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

  const activeFolders = allFolders.filter((f) => !f.archivedAt && !f.deletedAt).map(serialize);
  const archivedFolders = allFolders.filter((f) => !!f.archivedAt && !f.deletedAt).map(serialize);
  const trashedFolders = allFolders.filter((f) => !!f.deletedAt).map(serialize);

  const personalOrgId = await getPersonalOrgId(session.user.id);
  const personalOrg = personalOrgId ? await prisma.organization.findUnique({ where: { id: personalOrgId } }) : null;

  return (
    <AppShell
      org={personalOrg ? { name: personalOrg.name, isPersonal: true, planTier: personalOrg.planTier } : null}
      userInitial={(session.user.email || "?").charAt(0).toUpperCase()}
    >
      <div style={{ padding: "32px 28px" }}>
        <DashboardGreeting />
        <p>Signed in as {session.user.email}.</p>
        <DealList
          initialFolders={activeFolders}
          initialArchived={archivedFolders}
          initialTrashed={trashedFolders}
          userOrgs={userOrgs}
        />
      </div>
    </AppShell>
  );
}
