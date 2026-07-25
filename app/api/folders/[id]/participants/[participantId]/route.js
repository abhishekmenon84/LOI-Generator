import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../../lib/folderAccess";
import { getUserMembership } from "../../../../../../lib/orgAccess";

async function canManageParticipants(folder, userId) {
  if (folder.createdByUserId === userId) return true;
  const membership = await getUserMembership(userId, folder.orgId);
  return !!membership && membership.role === "admin";
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
  if (!(await canManageParticipants(folder, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to remove participants from this folder." }, { status: 403 });
  }

  await prisma.folderParticipant.deleteMany({ where: { id: params.participantId, folderId: params.id } });
  return NextResponse.json({ ok: true });
}
