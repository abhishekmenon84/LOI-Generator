import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { loadAccessibleFolder } from "../../../lib/folderAccess";
import { getOrgLimits, checkAndIncrementUsage } from "../../../lib/orgBilling";

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

  const org = await prisma.organization.findUnique({ where: { id: folder.orgId } });
  const limits = getOrgLimits(org);
  if (!limits.canCreate) {
    return NextResponse.json({ error: "Creating documents requires an active subscription. Upgrade to continue.", code: "UPGRADE_REQUIRED" }, { status: 402 });
  }
  const usage = await checkAndIncrementUsage(org.id, "document", org);
  if (!usage.ok) {
    return NextResponse.json({ error: usage.error, code: "USAGE_LIMIT_REACHED" }, { status: 402 });
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
