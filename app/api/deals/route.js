import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { DEFAULT_FORM_DATA } from "../../../lib/loiEngine";
import { DEFAULT_LEASE_DATA } from "../../../lib/leaseEngine";
import { DEFAULT_RESIDENTIAL_LEASE_DATA } from "../../../lib/residentialLeaseEngine";
import { listAccessibleDeals, getPersonalOrgId } from "../../../lib/orgAccess";

const DOCUMENT_TYPE_DEFAULTS = {
  purchase_loi: DEFAULT_FORM_DATA,
  commercial_lease_loi: DEFAULT_LEASE_DATA,
  residential_lease: DEFAULT_RESIDENTIAL_LEASE_DATA,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deals = await listAccessibleDeals(session.user.id);
  const shaped = deals.map((d) => ({
    id: d.id,
    name: d.name,
    documentType: d.documentType,
    updatedAt: d.updatedAt,
    createdAt: d.createdAt,
  }));
  return NextResponse.json({ deals: shaped });
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Deal name is required." }, { status: 400 });
  }
  const documentType = body.documentType;
  if (!Object.prototype.hasOwnProperty.call(DOCUMENT_TYPE_DEFAULTS, documentType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }

  const orgId = await getPersonalOrgId(session.user.id);
  if (!orgId) {
    return NextResponse.json({ error: "No organization found for this account." }, { status: 500 });
  }

  const deal = await prisma.deal.create({
    data: {
      orgId,
      createdByUserId: session.user.id,
      name,
      documentType,
      formData: DOCUMENT_TYPE_DEFAULTS[documentType],
    },
  });
  return NextResponse.json({ id: deal.id, documentType: deal.documentType }, { status: 201 });
}
