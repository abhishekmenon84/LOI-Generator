import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { authenticateApiKey } from "../../../../../../lib/apiKeyAuth";
import { getOrgLimits, checkAndIncrementUsage } from "../../../../../../lib/orgBilling";
import { checkRateLimit, getClientIp } from "../../../../../../lib/rateLimit";

const VALID_DOC_TYPES = ["purchase_loi", "commercial_lease", "residential_lease"];

async function loadOwnedFolder(folderId, orgId) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder || folder.orgId !== orgId) return null;
  return folder;
}

export async function GET(request, { params }) {
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`api-v1-ip:${ip}`, { max: 100, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }
  const folder = await loadOwnedFolder(params.id, auth.orgId);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  const ledgers = await prisma.ledger.findMany({
    where: { folderId: folder.id, archivedAt: null },
    select: { id: true, name: true, documentType: true, locked: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ documents: ledgers });
}

// Only the 3 built-in document types are creatable via the public API --
// custom_template/form_template ledgers depend on a specific template
// existing in the org, which an external integration has no way to
// reference safely without a much larger template-discovery surface
// (out of scope for this first API pass).
export async function POST(request, { params }) {
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`api-v1-ip:${ip}`, { max: 30, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }
  const folder = await loadOwnedFolder(params.id, auth.orgId);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({ where: { id: auth.orgId } });
  const limits = getOrgLimits(org);
  if (!limits.canCreate) {
    return NextResponse.json({ error: "Creating documents requires an active subscription.", code: "UPGRADE_REQUIRED" }, { status: 402 });
  }
  const usage = await checkAndIncrementUsage(org.id, "document", org);
  if (!usage.ok) {
    return NextResponse.json({ error: usage.error, code: "USAGE_LIMIT_REACHED" }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const documentType = body.documentType;
  if (!VALID_DOC_TYPES.includes(documentType)) {
    return NextResponse.json({ error: `documentType must be one of: ${VALID_DOC_TYPES.join(", ")}` }, { status: 400 });
  }
  const name = (body.name || "").trim() || "Untitled Ledger";
  const formData = typeof body.formData === "object" && body.formData !== null ? body.formData : {};

  const ledger = await prisma.ledger.create({
    data: { folderId: folder.id, createdByUserId: org.ownerUserId || folder.createdByUserId, name, documentType, formData },
  });

  return NextResponse.json(
    { id: ledger.id, name: ledger.name, documentType: ledger.documentType, folderId: ledger.folderId },
    { status: 201 }
  );
}
