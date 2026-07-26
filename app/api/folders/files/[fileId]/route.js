import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";

async function loadAccessibleFolderFile(fileId, userId) {
  const file = await prisma.folderFile.findUnique({ where: { id: fileId }, include: { anchors: true } });
  if (!file) return null;
  const folder = await loadAccessibleFolder(file.folderId, userId);
  if (!folder) return null;
  return { ...file, _writeAccess: folder._writeAccess };
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const file = await loadAccessibleFolderFile(params.fileId, session.user.id);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: file.id,
    folderId: file.folderId,
    name: file.name,
    fileUrl: file.fileUrl,
    mimeType: file.mimeType,
    pageCount: file.pageCount,
    fieldTier: file.fieldTier,
    formValues: file.formValues,
    anchors: file.anchors,
    readOnly: !file._writeAccess,
  });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const file = await loadAccessibleFolderFile(params.fileId, session.user.id);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (!file._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this file." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body.formValues && typeof body.formValues === "object") {
    data.formValues = body.formValues;
  }
  if (Array.isArray(body.anchors)) {
    await prisma.folderFileAnchor.deleteMany({ where: { folderFileId: file.id } });
    data.anchors = {
      create: body.anchors.map((a) => ({
        type: a.type,
        label: a.label,
        page: a.page,
        xPct: a.xPct,
        yPct: a.yPct,
        widthPct: a.widthPct,
        heightPct: a.heightPct,
      })),
    };
    data.fieldTier = "manual";
  }

  const updated = await prisma.folderFile.update({ where: { id: file.id }, data });
  return NextResponse.json({ id: updated.id, updatedAt: updated.updatedAt });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const file = await loadAccessibleFolderFile(params.fileId, session.user.id);
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (!file._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this file." }, { status: 403 });
  }
  await prisma.folderFile.delete({ where: { id: file.id } });
  return NextResponse.json({ ok: true });
}
