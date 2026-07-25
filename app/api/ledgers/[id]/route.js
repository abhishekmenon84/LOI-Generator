import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../lib/folderAccess";

async function loadAccessibleLedger(ledgerId, userId) {
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) return null;
  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  if (!folder) return null;
  return { ...ledger, _writeAccess: folder._writeAccess };
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await loadAccessibleLedger(params.id, session.user.id);
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: ledger.id,
    folderId: ledger.folderId,
    name: ledger.name,
    documentType: ledger.documentType,
    formData: ledger.formData,
    locked: ledger.locked,
    readOnly: !ledger._writeAccess,
  });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await loadAccessibleLedger(params.id, session.user.id);
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  if (!ledger._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this ledger." }, { status: 403 });
  }
  if (ledger.locked) {
    return NextResponse.json({ error: "This document has been fully signed and can no longer be edited.", code: "LEDGER_LOCKED" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.formData && typeof body.formData === "object") data.formData = body.formData;

  const updated = await prisma.ledger.update({ where: { id: ledger.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, updatedAt: updated.updatedAt });
}
