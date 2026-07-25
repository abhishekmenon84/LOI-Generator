import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder, getFolderAncestorChain } from "../../../../../lib/folderAccess";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parent = await loadAccessibleFolder(params.id, session.user.id);
  if (!parent) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!parent._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this folder." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const childFolderId = body.childFolderId;
  if (!childFolderId || childFolderId === params.id) {
    return NextResponse.json({ error: "A valid childFolderId is required." }, { status: 400 });
  }

  const child = await loadAccessibleFolder(childFolderId, session.user.id);
  if (!child) {
    return NextResponse.json({ error: "Child folder not found." }, { status: 404 });
  }
  if (!child._writeAccess) {
    return NextResponse.json({ error: "You only have read access to the child folder." }, { status: 403 });
  }
  if (child.orgId !== parent.orgId) {
    return NextResponse.json({ error: "Folders must be in the same organization to nest." }, { status: 403 });
  }

  // Cycle prevention: parent cannot become its own descendant. Walk the
  // PARENT's ancestor chain plus the parent itself -- if childFolderId
  // appears anywhere in "parent or parent's ancestors," then child is
  // already an ancestor of parent, and nesting child under parent would
  // create a cycle.
  const parentAncestorChain = await getFolderAncestorChain(parent.id);
  if (parentAncestorChain.includes(child.id) || parent.id === child.id) {
    return NextResponse.json({ error: "Cannot nest a folder under one of its own descendants." }, { status: 409 });
  }

  await prisma.folder.update({ where: { id: child.id }, data: { parentFolderId: parent.id } });
  await prisma.folderAuditEvent.create({
    data: { folderId: child.id, actorUserId: session.user.id, action: "linked_child", reason: null },
  });

  return NextResponse.json({ ok: true });
}
