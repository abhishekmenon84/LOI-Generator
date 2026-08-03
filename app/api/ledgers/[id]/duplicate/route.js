import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { getOrgLimits, checkAndIncrementUsage } from "../../../../../lib/orgBilling";

// Clones a Ledger's content (name, documentType, formData, templateId)
// into a brand-new Ledger in the same folder -- a common real-estate
// workflow (same buyer/terms, different address, or a near-identical deal
// with one prior client) that previously required re-keying every field
// by hand. Deliberately does NOT copy locked/signature history/archivedAt
// -- a duplicate is always a fresh, unsigned draft, never a copy of a
// signed document's lock state.
export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const source = await prisma.ledger.findUnique({ where: { id: params.id } });
  if (!source) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  const folder = await loadAccessibleFolder(source.folderId, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
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

  const duplicate = await prisma.ledger.create({
    data: {
      folderId: source.folderId,
      createdByUserId: session.user.id,
      name: `${source.name} (copy)`,
      documentType: source.documentType,
      templateId: source.templateId,
      formData: source.formData,
    },
  });

  return NextResponse.json(
    { id: duplicate.id, folderId: duplicate.folderId, documentType: duplicate.documentType, name: duplicate.name },
    { status: 201 }
  );
}
