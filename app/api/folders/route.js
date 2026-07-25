import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { loadAccessibleFolder, listAccessibleFolders } from "../../../lib/folderAccess";
import { getUserMembership } from "../../../lib/orgAccess";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const orgId = body.orgId;
  const parentFolderId = body.parentFolderId || null;

  if (!name) {
    return NextResponse.json({ error: "A folder name is required." }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "An orgId is required." }, { status: 400 });
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

  const folders = await listAccessibleFolders(session.user.id);
  const scoped = orgId ? folders.filter((f) => f.orgId === orgId) : folders;

  return NextResponse.json({
    folders: scoped.map((f) => ({
      id: f.id,
      name: f.name,
      stage: f.stage,
      priority: f.priority,
      parentFolderId: f.parentFolderId,
      orgId: f.orgId,
      readOnly: !f._writeAccess,
    })),
  });
}
