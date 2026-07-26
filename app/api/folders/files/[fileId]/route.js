import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { deleteFile } from "../../../../../lib/blobStorage";

const VALID_ANCHOR_TYPES = new Set(["signature", "date", "initials", "text", "checkbox", "radio"]);

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

// Sanitizes a single client-submitted anchor before it's persisted. Client
// input (xPct/yPct/etc.) comes from the generic AnchorEditor drag/resize UI
// and could in principle be out of range or malformed; we clamp/coerce
// rather than trust it, but stay forgiving (clamp, not reject) since a
// slightly-out-of-range value from a UI bug is more useful clamped than
// silently dropped.
function sanitizeAnchor(a) {
  const label = String(a?.label ?? "").trim() || "Field";
  return {
    type: a?.type,
    label,
    page: Math.max(0, Math.floor(Number(a?.page) || 0)),
    xPct: clampPct(a?.xPct),
    yPct: clampPct(a?.yPct),
    widthPct: clampPct(a?.widthPct),
    heightPct: clampPct(a?.heightPct),
  };
}

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
    // Filter out anchors with an invalid `type` rather than rejecting the
    // whole request -- more forgiving of partial client-side issues.
    const sanitized = body.anchors
      .map(sanitizeAnchor)
      .filter((a) => VALID_ANCHOR_TYPES.has(a.type));
    data.anchors = { create: sanitized };
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
  // Best-effort blob cleanup: a failure here shouldn't block the DB delete,
  // which is the source of truth for whether the file still "exists".
  try {
    await deleteFile(file.fileUrl);
  } catch {}
  return NextResponse.json({ ok: true });
}
