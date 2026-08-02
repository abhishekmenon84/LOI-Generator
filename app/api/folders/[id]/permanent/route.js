import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { getUserMembership } from "../../../../../lib/orgAccess";

// Collects this folder's id plus every descendant subfolder's id (Folder's
// parent/children relation cascades on delete -- see prisma/schema.prisma
// -- so deleting the top folder silently deletes the whole subtree; a
// locked Ledger anywhere in that subtree must block the whole operation,
// not just a locked Ledger in the top folder itself).
async function collectFolderSubtreeIds(folderId) {
  const ids = [folderId];
  let frontier = [folderId];
  while (frontier.length > 0) {
    const children = await prisma.folder.findMany({
      where: { parentFolderId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((f) => f.id);
    ids.push(...frontier);
  }
  return ids;
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!folder.archivedAt) {
    return NextResponse.json({ error: "This folder must be archived before it can be permanently deleted." }, { status: 409 });
  }
  const membership = await getUserMembership(session.user.id, folder.orgId);
  const canDelete = folder.createdByUserId === session.user.id || (membership && membership.role === "admin");
  if (!canDelete) {
    return NextResponse.json({ error: "Only the folder's creator or an org admin can permanently delete it." }, { status: 403 });
  }

  const subtreeIds = await collectFolderSubtreeIds(folder.id);
  const lockedLedgerCount = await prisma.ledger.count({ where: { folderId: { in: subtreeIds }, locked: true } });
  if (lockedLedgerCount > 0) {
    return NextResponse.json({ error: "This folder (or a subfolder) contains a fully signed document and cannot be permanently deleted.", code: "FOLDER_HAS_SIGNED_DOCUMENT" }, { status: 409 });
  }

  await prisma.folder.delete({ where: { id: folder.id } });
  return NextResponse.json({ ok: true });
}
