import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { getUserMembership } from "../../../../../lib/orgAccess";
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
  return { ...file, _writeAccess: folder._writeAccess, _orgId: folder.orgId };
}

// Auto-promotes an uploaded FolderFile into a reusable CustomTemplate as
// soon as it has real anchors placed on it -- per the product decision,
// this happens automatically on every anchor save, no separate "save as
// template" action. Scoped to whichever org the file's folder belongs to:
// on a personal org this always succeeds (a personal org has exactly one
// member); on a business org it's admin-only, matching the existing
// upload-time restriction in POST /api/orgs/[id]/templates -- a
// non-admin's anchors are still saved on the file itself, they just don't
// also become a shared org template. Re-promoting an already-promoted
// file (tracked via FolderFile.name + orgId + createdByUserId, since
// there's no direct FK between the two tables) updates the existing
// CustomTemplate's anchors instead of creating a duplicate every time
// fields are re-edited.
async function promoteToTemplateIfEligible(file, sanitizedAnchors, userId) {
  if (sanitizedAnchors.length === 0) return;
  const org = await prisma.organization.findUnique({ where: { id: file._orgId } });
  if (!org) return;
  if (!org.isPersonal) {
    const membership = await getUserMembership(userId, org.id);
    if (!membership || membership.role !== "admin") return;
  }

  const templateAnchors = sanitizedAnchors.map((a) => ({
    type: a.type,
    role: a.label,
    page: a.page,
    xPct: a.xPct,
    yPct: a.yPct,
    widthPct: a.widthPct,
    heightPct: a.heightPct,
  }));

  const existing = await prisma.customTemplate.findFirst({
    where: { orgId: org.id, createdByUserId: userId, name: file.name },
  });

  if (existing) {
    await prisma.templateAnchor.deleteMany({ where: { templateId: existing.id } });
    await prisma.customTemplate.update({
      where: { id: existing.id },
      data: { pdfUrl: file.fileUrl, pageCount: file.pageCount || 1, anchors: { create: templateAnchors } },
    });
  } else {
    await prisma.customTemplate.create({
      data: {
        orgId: org.id,
        name: file.name,
        pdfUrl: file.fileUrl,
        pageCount: file.pageCount || 1,
        createdByUserId: userId,
        anchors: { create: templateAnchors },
      },
    });
  }
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
  let sanitizedAnchors = null;
  if (Array.isArray(body.anchors)) {
    await prisma.folderFileAnchor.deleteMany({ where: { folderFileId: file.id } });
    // Filter out anchors with an invalid `type` rather than rejecting the
    // whole request -- more forgiving of partial client-side issues.
    sanitizedAnchors = body.anchors
      .map(sanitizeAnchor)
      .filter((a) => VALID_ANCHOR_TYPES.has(a.type));
    data.anchors = { create: sanitizedAnchors };
    data.fieldTier = "manual";
  }

  // Returns the full file including its freshly-saved anchors, not just
  // {id, updatedAt} -- a separate follow-up GET (a different request,
  // potentially a different pooled connection on Neon's serverless
  // Postgres) is not guaranteed to observe this same write immediately,
  // which was showing up as "I saved anchors and they're just gone" even
  // though the write itself succeeded. Returning them directly from the
  // same update() call sidesteps that entirely.
  const updated = await prisma.folderFile.update({ where: { id: file.id }, data, include: { anchors: true } });

  if (sanitizedAnchors !== null) {
    // Best-effort -- a promotion failure must not block the anchors from
    // being saved on the file itself, which already succeeded above.
    await promoteToTemplateIfEligible(file, sanitizedAnchors, session.user.id).catch(() => {});
  }
  return NextResponse.json({
    id: updated.id,
    folderId: updated.folderId,
    name: updated.name,
    fileUrl: updated.fileUrl,
    mimeType: updated.mimeType,
    pageCount: updated.pageCount,
    fieldTier: updated.fieldTier,
    formValues: updated.formValues,
    anchors: updated.anchors,
    readOnly: !file._writeAccess,
  });
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
