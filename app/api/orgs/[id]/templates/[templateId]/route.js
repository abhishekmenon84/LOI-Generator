import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { getUserMembership } from "../../../../../../lib/orgAccess";
import { deleteFile } from "../../../../../../lib/blobStorage";
import { requireAdminActiveOrg } from "../route";

const VALID_ANCHOR_TYPES = new Set(["signature", "date", "initials", "text", "checkbox", "radio"]);

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

// Sanitizes a single client-submitted anchor before it's persisted, mirroring
// Phase 7a's FolderFileAnchor PATCH route (app/api/folders/files/[fileId]/route.js)
// exactly: clamp/coerce numeric fields (forgiving of out-of-range UI values),
// but leave `type` unclamped so the caller can filter out invalid types rather
// than silently coercing them to something wrong.
function sanitizeAnchor(a) {
  const role = String(a?.role ?? a?.label ?? "").trim() || "Role";
  return {
    type: a?.type,
    role,
    page: Math.max(0, Math.floor(Number(a?.page) || 0)),
    xPct: clampPct(a?.xPct),
    yPct: clampPct(a?.yPct),
    widthPct: clampPct(a?.widthPct),
    heightPct: clampPct(a?.heightPct),
  };
}

async function loadTemplateWithOrg(templateId) {
  return prisma.customTemplate.findUnique({ where: { id: templateId }, include: { anchors: true } });
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const template = await loadTemplateWithOrg(params.templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  const membership = await getUserMembership(session.user.id, template.orgId);
  if (!membership) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: template.id,
    orgId: template.orgId,
    name: template.name,
    pdfUrl: template.pdfUrl,
    pageCount: template.pageCount,
    anchors: template.anchors,
  });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const template = await loadTemplateWithOrg(params.templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  const gate = await requireAdminActiveOrg(template.orgId, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error, ...(gate.code ? { code: gate.code } : {}) }, { status: gate.status });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (Array.isArray(body.anchors)) {
    // Filter out anchors with an invalid `type` rather than rejecting the
    // whole request -- more forgiving of partial client-side issues, same
    // pattern as Phase 7a's FolderFileAnchor PATCH route.
    const sanitized = body.anchors
      .map(sanitizeAnchor)
      .filter((a) => VALID_ANCHOR_TYPES.has(a.type));
    await prisma.templateAnchor.deleteMany({ where: { templateId: template.id } });
    data.anchors = { create: sanitized };
  }

  const updated = await prisma.customTemplate.update({ where: { id: template.id }, data });
  return NextResponse.json({ id: updated.id, updatedAt: updated.updatedAt });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const template = await loadTemplateWithOrg(params.templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  const gate = await requireAdminActiveOrg(template.orgId, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error, ...(gate.code ? { code: gate.code } : {}) }, { status: gate.status });
  }
  await prisma.customTemplate.delete({ where: { id: template.id } });
  try {
    await deleteFile(template.pdfUrl);
  } catch {
    // Best-effort; the DB row is the source of truth, matching Phase 7a's
    // identical FolderFile deletion precedent.
  }
  return NextResponse.json({ ok: true });
}
