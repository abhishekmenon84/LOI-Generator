import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../../lib/folderAccess";

async function loadAccessibleLedger(ledgerId, userId) {
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) return null;
  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  if (!folder) return null;
  return { ...ledger, _writeAccess: folder._writeAccess };
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await loadAccessibleLedger(params.id, session.user.id);
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  if (!ledger._writeAccess) {
    return NextResponse.json({ error: "Not authorized to void this document's signature request." }, { status: 403 });
  }

  const pending = await prisma.signatureRequest.findFirst({ where: { ledgerId: ledger.id, status: "pending" } });
  if (!pending) {
    return NextResponse.json({ error: "No in-progress signature request to void." }, { status: 400 });
  }

  await prisma.signatureRequest.update({ where: { id: pending.id }, data: { status: "voided", voidedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
