import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";

export async function POST(request, { params }) {
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
  if (!folder.parentFolderId) {
    return NextResponse.json({ error: "This folder is not nested under anything." }, { status: 409 });
  }

  await prisma.folder.update({ where: { id: folder.id }, data: { parentFolderId: null } });
  await prisma.folderAuditEvent.create({
    data: { folderId: folder.id, actorUserId: session.user.id, action: "unlinked_child", reason: null },
  });

  return NextResponse.json({ ok: true });
}
