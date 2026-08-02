import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { loadAccessibleFolder, getFolderAncestorChain } from "../../../../lib/folderAccess";

const VALID_STAGES = ["draft", "active", "pending", "closed"];

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  // Phase 5 Task 3: resolve the ancestor chain server-side (rather than making
  // the Folder workspace page do N+1 client-side fetches) using Phase 3's
  // getFolderAncestorChain helper, which returns ancestor IDs nearest-first.
  const ancestorIds = await getFolderAncestorChain(folder.id);
  const ancestorFolders = ancestorIds.length > 0
    ? await prisma.folder.findMany({ where: { id: { in: ancestorIds } } })
    : [];
  const ancestorById = new Map(ancestorFolders.map((f) => [f.id, f]));
  // getFolderAncestorChain returns nearest-first; reverse so the breadcrumb
  // reads root-first (oldest ancestor first, immediate parent last).
  const ancestors = ancestorIds
    .map((id) => ancestorById.get(id))
    .filter(Boolean)
    .reverse()
    .map((f) => ({ id: f.id, name: f.name }));

  // Phase 5 Task 3 fix round 1 (Important #1): this folder's OWN Ledgers
  // (documents created directly in the current folder, not in a subfolder)
  // were never returned anywhere, so they never appeared in the tree panel.
  // Mirrors the `ledgers` enrichment already added to GET /api/folders.
  const ledgers = await prisma.ledger.findMany({
    where: { folderId: folder.id },
    select: { id: true, name: true, documentType: true, archivedAt: true },
  });

  // Phase 7 Task 6: this folder's own FolderFiles (uploaded directly here,
  // not in a subfolder), mirroring the `ledgers` fetch immediately above.
  const files = await prisma.folderFile.findMany({
    where: { folderId: folder.id },
    select: { id: true, name: true, mimeType: true, fieldTier: true, archivedAt: true },
  });

  return NextResponse.json({
    id: folder.id,
    name: folder.name,
    stage: folder.stage,
    priority: folder.priority,
    favorite: folder.favorite,
    parentFolderId: folder.parentFolderId,
    orgId: folder.orgId,
    readOnly: !folder._writeAccess,
    ancestors,
    ledgers: ledgers.map((l) => ({ ...l, archivedAt: l.archivedAt ? l.archivedAt.toISOString() : null })),
    files: files.map((f) => ({ ...f, archivedAt: f.archivedAt ? f.archivedAt.toISOString() : null })),
  });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!folder._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this folder." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.stage === "string" && VALID_STAGES.includes(body.stage)) data.stage = body.stage;
  if (body.priority === null || ["green", "yellow", "grey"].includes(body.priority)) data.priority = body.priority;
  if (typeof body.favorite === "boolean") data.favorite = body.favorite;

  const updated = await prisma.folder.update({ where: { id: folder.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, stage: updated.stage, priority: updated.priority, favorite: updated.favorite, updatedAt: updated.updatedAt });
}
