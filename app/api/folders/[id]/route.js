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

  return NextResponse.json({
    id: folder.id,
    name: folder.name,
    stage: folder.stage,
    priority: folder.priority,
    parentFolderId: folder.parentFolderId,
    orgId: folder.orgId,
    readOnly: !folder._writeAccess,
    ancestors,
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
  if (folder.deletedAt) {
    return NextResponse.json({ error: "This folder is in Trash and can no longer be edited. Restore it first.", code: "FOLDER_TRASHED" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.stage === "string" && VALID_STAGES.includes(body.stage)) data.stage = body.stage;
  if (body.priority === null || ["green", "yellow", "grey"].includes(body.priority)) data.priority = body.priority;

  const updated = await prisma.folder.update({ where: { id: folder.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, stage: updated.stage, priority: updated.priority, updatedAt: updated.updatedAt });
}
