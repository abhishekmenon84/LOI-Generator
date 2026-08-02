import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { listAccessibleFolders } from "../../../lib/folderAccess";

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }
  const qLower = q.toLowerCase();

  // includeArchived surfaces archived folders in search too -- there is no
  // more-hidden Trash state to separately exclude.
  const accessibleFolders = await listAccessibleFolders(session.user.id, { includeArchived: true });
  if (accessibleFolders.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const folderById = new Map(accessibleFolders.map((f) => [f.id, f]));
  const orgIds = [...new Set(accessibleFolders.map((f) => f.orgId))];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, isPersonal: true },
  });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.isPersonal ? "Personal" : o.name]));

  const folderResultsById = new Map();
  for (const f of accessibleFolders) {
    if (!f.name.toLowerCase().includes(qLower)) continue;
    folderResultsById.set(f.id, {
      type: "folder",
      id: f.id,
      name: f.name,
      folderId: f.id,
      folderName: f.name,
      orgName: orgNameById.get(f.orgId) || "",
      stage: f.stage,
      archived: !!f.archivedAt,
    });
  }

  const accessibleFolderIds = accessibleFolders.map((f) => f.id);

  const matchingParticipants = await prisma.folderParticipant.findMany({
    where: { folderId: { in: accessibleFolderIds } },
    include: { user: { select: { name: true, email: true } } },
  });
  for (const p of matchingParticipants) {
    const participantName = p.user.name || p.user.email;
    if (!participantName.toLowerCase().includes(qLower)) continue;
    if (folderResultsById.has(p.folderId)) continue;
    const parent = folderById.get(p.folderId);
    if (!parent) continue;
    folderResultsById.set(p.folderId, {
      type: "folder",
      id: parent.id,
      name: parent.name,
      folderId: parent.id,
      folderName: parent.name,
      orgName: orgNameById.get(parent.orgId) || "",
      stage: parent.stage,
      archived: !!parent.archivedAt,
    });
  }

  const matchingLedgers = await prisma.ledger.findMany({
    where: {
      folderId: { in: accessibleFolderIds },
      name: { contains: q, mode: "insensitive" },
    },
    select: { id: true, name: true, folderId: true },
  });
  const ledgerResults = matchingLedgers.map((l) => {
    const parent = folderById.get(l.folderId);
    return {
      type: "ledger",
      id: l.id,
      name: l.name,
      folderId: l.folderId,
      folderName: parent?.name || "",
      orgName: parent ? orgNameById.get(parent.orgId) || "" : "",
      archived: !!parent?.archivedAt,
    };
  });

  const folderResults = [...folderResultsById.values()];
  folderResults.sort((a, b) => a.name.localeCompare(b.name));
  ledgerResults.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ results: [...folderResults, ...ledgerResults] });
}
