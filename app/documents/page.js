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

  // Document-level shares (LedgerParticipant) grant access to one Ledger
  // without any FolderParticipant/org access to its containing folder --
  // such a folder never appears in activeFolders above, so its shared
  // Ledger would otherwise be completely unreachable in the UI. Surfaced
  // here as its own list, linking to the dedicated single-document view
  // at /ledgerboard/document/[id] (see that page's own comment for why
  // the folder workspace can't be used for this).
  const sharedLedgerGrants = await prisma.ledgerParticipant.findMany({
    where: { userId: session.user.id },
    include: { ledger: { select: { id: true, name: true, documentType: true, archivedAt: true, folderId: true } } },
  });
  const sharedFolderIds = new Set(activeFolders.map((f) => f.id));
  const sharedLedgers = sharedLedgerGrants
    .filter((g) => !g.ledger.archivedAt && !sharedFolderIds.has(g.ledger.folderId))
    .map((g) => ({ id: g.ledger.id, name: g.ledger.name, documentType: g.ledger.documentType, permission: g.permission }));

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
          <SharedLedgersSection sharedLedgers={sharedLedgers} />
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
        <SharedLedgersSection sharedLedgers={sharedLedgers} />
        <DealList
          initialFolders={activeFolders.map(serialize)}
          userOrgs={userOrgs}
        />
      </div>
    </AppShell>
  );
}

// Renders nothing when the user has no pure document-level shares --
// most users never will, so this stays invisible for the common case.
function SharedLedgersSection({ sharedLedgers }) {
  if (sharedLedgers.length === 0) return null;
  return (
    <div style={{ marginBottom: 24, padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-panel)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)", marginBottom: 10 }}>
        Shared with you
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sharedLedgers.map((l) => (
          <a
            key={l.id}
            href={`/ledgerboard/document/${l.id}`}
            style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}
          >
            {l.name} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>({l.permission === "write" ? "can edit" : "view only"})</span>
          </a>
        ))}
      </div>
    </div>
  );
}
