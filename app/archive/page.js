import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { listAccessibleFolders } from "../../lib/folderAccess";
import { prisma } from "../../lib/prisma";
import { getPrimaryOrgForShell } from "../../lib/orgAccess";
import AppShell from "../../components/AppShell";
import ArchivePageClient from "../../components/ArchivePageClient";

export const metadata = {
  title: "Archive — Ledgerlot",
};

// One Archive page, two sections (per the product decision):
// "Archived Folders" -- whole Folders with Folder.archivedAt set, restorable
//   as a folder (and now permanently deletable -- see
//   POST /api/folders/[id]/permanent -- since Trash no longer exists).
// "Archived Documents" -- individual Ledgers/FolderFiles with their own
//   archivedAt set, grouped by their PARENT folder's name, but ONLY for
//   folders that are themselves still active -- a document inside an
//   archived folder already shows up via that folder in the first
//   section, so it must not also appear here (would double-count the
//   same underlying archive action two different ways).
export default async function ArchivePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const allFolders = await listAccessibleFolders(session.user.id, { includeArchived: true });
  const archivedFolders = allFolders.filter((f) => !!f.archivedAt);
  const activeFolderIds = allFolders.filter((f) => !f.archivedAt).map((f) => f.id);

  const [archivedLedgers, archivedFiles] = activeFolderIds.length > 0
    ? await Promise.all([
        prisma.ledger.findMany({
          where: { folderId: { in: activeFolderIds }, archivedAt: { not: null } },
          select: { id: true, name: true, documentType: true, folderId: true, archivedAt: true },
          orderBy: { archivedAt: "desc" },
        }),
        prisma.folderFile.findMany({
          where: { folderId: { in: activeFolderIds }, archivedAt: { not: null } },
          select: { id: true, name: true, mimeType: true, folderId: true, archivedAt: true },
          orderBy: { archivedAt: "desc" },
        }),
      ])
    : [[], []];

  const folderNameById = new Map(allFolders.map((f) => [f.id, f.name]));

  const serializedFolders = archivedFolders
    .map((f) => ({
      id: f.id,
      name: f.name,
      writeAccess: f._writeAccess,
      archivedAt: f.archivedAt.toISOString(),
    }))
    .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

  const documents = [
    ...archivedLedgers.map((l) => ({
      id: l.id,
      kind: "ledger",
      name: l.name,
      folderId: l.folderId,
      folderName: folderNameById.get(l.folderId) || "Unknown folder",
      archivedAt: l.archivedAt.toISOString(),
    })),
    ...archivedFiles.map((f) => ({
      id: f.id,
      kind: "file",
      name: f.name,
      folderId: f.folderId,
      folderName: folderNameById.get(f.folderId) || "Unknown folder",
      archivedAt: f.archivedAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

  const primaryOrg = await getPrimaryOrgForShell(session.user.id);

  return (
    <AppShell org={primaryOrg} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px" }}>
        <h1 style={{ marginBottom: 24 }}>Archive</h1>
        <ArchivePageClient initialFolders={serializedFolders} initialDocuments={documents} />
      </div>
    </AppShell>
  );
}
