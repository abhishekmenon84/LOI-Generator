import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { loadAccessibleFolder, listAccessibleFolders } from "../../../lib/folderAccess";
import { getUserMembership, getPersonalOrgId } from "../../../lib/orgAccess";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  let orgId = body.orgId;
  const parentFolderId = body.parentFolderId || null;

  if (!name) {
    return NextResponse.json({ error: "A folder name is required." }, { status: 400 });
  }
  if (!orgId) {
    orgId = await getPersonalOrgId(session.user.id);
    if (!orgId) {
      return NextResponse.json({ error: "No organization found for this account." }, { status: 500 });
    }
  }

  const membership = await getUserMembership(session.user.id, orgId);
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of that organization." }, { status: 403 });
  }

  if (parentFolderId) {
    const parent = await loadAccessibleFolder(parentFolderId, session.user.id);
    if (!parent) {
      return NextResponse.json({ error: "Parent folder not found." }, { status: 404 });
    }
    if (!parent._writeAccess) {
      return NextResponse.json({ error: "You only have read access to the parent folder." }, { status: 403 });
    }
    if (parent.orgId !== orgId) {
      return NextResponse.json({ error: "A folder must be created in its parent's organization." }, { status: 403 });
    }
  }

  const folder = await prisma.folder.create({
    data: {
      orgId,
      createdByUserId: session.user.id,
      name,
      parentFolderId,
    },
  });

  if (parentFolderId) {
    await prisma.folderAuditEvent.create({
      data: { folderId: folder.id, actorUserId: session.user.id, action: "created", reason: null },
    });
  }

  return NextResponse.json({ id: folder.id, name: folder.name, stage: folder.stage, parentFolderId: folder.parentFolderId }, { status: 201 });
}

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  // "parentFolderId" filter added in Phase 5 Task 3 for the Folder workspace's
  // subfolder-tree panel (matches the existing "orgId" query-param pattern).
  // Pass the literal string "null" to fetch root-level folders (no parent).
  const parentFolderIdParam = searchParams.get("parentFolderId");
  const hasParentFilter = parentFolderIdParam !== null;
  const parentFolderId = parentFolderIdParam === "null" ? null : parentFolderIdParam;

  const folders = await listAccessibleFolders(session.user.id);
  let scoped = orgId ? folders.filter((f) => f.orgId === orgId) : folders;
  if (hasParentFilter) {
    scoped = scoped.filter((f) => f.parentFolderId === parentFolderId);
  }

  const participants = scoped.length > 0
    ? await prisma.folderParticipant.findMany({
        where: { folderId: { in: scoped.map((f) => f.id) } },
        include: { user: { select: { name: true, email: true } } },
      })
    : [];
  const participantNamesByFolder = new Map();
  for (const p of participants) {
    const list = participantNamesByFolder.get(p.folderId) || [];
    list.push(p.user.name || p.user.email);
    participantNamesByFolder.set(p.folderId, list);
  }

  // "ledgers" per-folder enrichment added in Phase 5 Task 3 (matching the
  // existing "participantNames" enrichment pattern just above) so the Folder
  // workspace's tree panel can render each subfolder's nested Ledgers without
  // a separate new API route (Task 3 explicitly produces no new API).
  const ledgers = scoped.length > 0
    ? await prisma.ledger.findMany({
        where: { folderId: { in: scoped.map((f) => f.id) } },
        select: { id: true, folderId: true, name: true, documentType: true },
      })
    : [];
  const ledgersByFolder = new Map();
  for (const l of ledgers) {
    const list = ledgersByFolder.get(l.folderId) || [];
    list.push({ id: l.id, name: l.name, documentType: l.documentType });
    ledgersByFolder.set(l.folderId, list);
  }

  // "files" per-folder enrichment added in Phase 7 Task 6, mirroring the
  // "ledgers" enrichment immediately above (same batched-query pattern) so
  // the Folder workspace's tree panel can render each subfolder's nested
  // FolderFiles without a separate new API route.
  const files = scoped.length > 0
    ? await prisma.folderFile.findMany({
        where: { folderId: { in: scoped.map((f) => f.id) } },
        select: { id: true, folderId: true, name: true, mimeType: true, fieldTier: true },
      })
    : [];
  const filesByFolder = new Map();
  for (const file of files) {
    const list = filesByFolder.get(file.folderId) || [];
    list.push({ id: file.id, name: file.name, mimeType: file.mimeType, fieldTier: file.fieldTier });
    filesByFolder.set(file.folderId, list);
  }

  return NextResponse.json({
    folders: scoped.map((f) => ({
      id: f.id,
      name: f.name,
      stage: f.stage,
      priority: f.priority,
      parentFolderId: f.parentFolderId,
      orgId: f.orgId,
      readOnly: !f._writeAccess,
      participantNames: participantNamesByFolder.get(f.id) || [],
      ledgers: ledgersByFolder.get(f.id) || [],
      files: filesByFolder.get(f.id) || [],
    })),
  });
}
