import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { hasBusinessOrgMembership, listAccessibleDeals, listLifecycleDeals, listUserOrgs } from "../../lib/orgAccess";
import { listAccessibleFolders } from "../../lib/folderAccess";
import { prisma } from "../../lib/prisma";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import DealList from "../../components/DealList";
import KanbanDashboard from "../../components/KanbanDashboard";

export const metadata = {
  title: "Ledgerboard — Ledgerlot",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isBusiness = await hasBusinessOrgMembership(session.user.id);

  if (isBusiness) {
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
    // document type for the card's type pill -- a bare Folder has no
    // documentType of its own, only its child Ledgers do.
    const primaryDocTypeByFolder = new Map();
    for (const l of primaryLedgers) {
      if (!primaryDocTypeByFolder.has(l.folderId)) primaryDocTypeByFolder.set(l.folderId, l.documentType);
    }

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

    return (
      <>
        <SiteHeader isLoggedIn={true} />
        <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 28px" }}>
          <h1 style={{ marginBottom: 4 }}>Ledgerboard</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>Signed in as {session.user.email}.</p>
          <KanbanDashboard
            initialFolders={activeFolders}
            initialArchivedFolders={archivedFolders}
            initialTrashedFolders={trashedFolders}
            userOrgs={userOrgs}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  const deals = await listAccessibleDeals(session.user.id);
  const archivedDeals = await listLifecycleDeals(session.user.id, "archive");
  const trashedDeals = await listLifecycleDeals(session.user.id, "trash");
  const userOrgs = await listUserOrgs(session.user.id);

  const serialize = (d) => ({
    id: d.id,
    name: d.name,
    documentType: d.documentType,
    stage: d.stage,
    updatedAt: d.updatedAt.toISOString(),
    isShared: d._accessReason === "share",
    writeAccess: d._writeAccess,
    parentDealId: d.parentDealId,
    priority: d.priority,
  });

  const serializedDeals = deals.map(serialize);
  const serializedArchived = archivedDeals.map(serialize);
  const serializedTrashed = trashedDeals.map(serialize);

  return (
    <>
      <SiteHeader isLoggedIn={true} />
      <main className="marketing-page">
        <h1>Your Ledgers</h1>
        <p>Signed in as {session.user.email}.</p>
        <DealList
          initialDeals={serializedDeals}
          initialArchived={serializedArchived}
          initialTrashed={serializedTrashed}
          userOrgs={userOrgs}
        />
      </main>
      <SiteFooter />
    </>
  );
}
