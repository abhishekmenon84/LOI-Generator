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

  const accessibleFolders = await listAccessibleFolders(session.user.id);
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

  const folderResults = accessibleFolders
    .filter((f) => f.name.toLowerCase().includes(qLower))
    .map((f) => ({
      type: "folder",
      id: f.id,
      name: f.name,
      folderId: f.id,
      folderName: f.name,
      orgName: orgNameById.get(f.orgId) || "",
      stage: f.stage,
    }));

  const accessibleFolderIds = accessibleFolders.map((f) => f.id);
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
    };
  });

  folderResults.sort((a, b) => a.name.localeCompare(b.name));
  ledgerResults.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ results: [...folderResults, ...ledgerResults] });
}
