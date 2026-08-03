import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../../lib/folderAccess";
import { getUserMembership } from "../../../../../../lib/orgAccess";

async function canManageLedgerParticipants(ledger, userId) {
  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  if (!folder) return false;
  if (ledger.createdByUserId === userId) return true;
  const membership = await getUserMembership(userId, folder.orgId);
  return !!membership && membership.role === "admin";
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await prisma.ledger.findUnique({ where: { id: params.id } });
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  if (!(await canManageLedgerParticipants(ledger, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to remove participants from this document." }, { status: 403 });
  }

  await prisma.ledgerParticipant.deleteMany({ where: { id: params.participantId, ledgerId: params.id } });
  return NextResponse.json({ ok: true });
}
