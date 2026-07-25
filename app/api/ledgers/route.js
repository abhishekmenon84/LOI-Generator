import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { loadAccessibleFolder } from "../../../lib/folderAccess";

const VALID_DOC_TYPES = ["purchase_loi", "commercial_lease", "residential_lease", "custom_template"];

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const folderId = body.folderId;
  const documentType = VALID_DOC_TYPES.includes(body.documentType) ? body.documentType : "purchase_loi";
  const name = (body.name || "").trim() || "Untitled Ledger";

  if (!folderId) {
    return NextResponse.json({ error: "A folderId is required." }, { status: 400 });
  }

  const folder = await loadAccessibleFolder(folderId, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!folder._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this folder." }, { status: 403 });
  }

  const ledger = await prisma.ledger.create({
    data: {
      folderId: folder.id,
      createdByUserId: session.user.id,
      name,
      documentType,
      formData: {},
    },
  });

  return NextResponse.json(
    { id: ledger.id, folderId: ledger.folderId, documentType: ledger.documentType, name: ledger.name, formData: ledger.formData },
    { status: 201 }
  );
}
