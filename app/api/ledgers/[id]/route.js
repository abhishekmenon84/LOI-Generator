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
    archivedAt: ledger.archivedAt ? ledger.archivedAt.toISOString() : null,
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

  const body = await request.json().catch(() => ({}));
  // The lock only blocks changes to the document's actual CONTENT
  // (name, formData) -- once fully signed, the file itself must never be
  // modified again. Archiving/restoring is purely organizational metadata,
  // not a content change, so it stays allowed even on a locked ledger
  // (previously this whole PATCH 409'd unconditionally on any locked
  // ledger, which incorrectly blocked archiving a signed document too).
  const isContentChange = "name" in body || "formData" in body;
  if (ledger.locked && isContentChange) {
    return NextResponse.json({ error: "This document has been fully signed and can no longer be edited.", code: "LEDGER_LOCKED" }, { status: 409 });
  }

  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.formData && typeof body.formData === "object") data.formData = body.formData;
  // Document-level archive -- distinct from Folder.archivedAt (see
  // prisma/schema.prisma's comment on Ledger.archivedAt): archiving a
  // single Ledger doesn't touch its folder or sibling documents.
  if (typeof body.archived === "boolean") data.archivedAt = body.archived ? new Date() : null;

  const updated = await prisma.ledger.update({ where: { id: ledger.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, archivedAt: updated.archivedAt ? updated.archivedAt.toISOString() : null, updatedAt: updated.updatedAt });
}
