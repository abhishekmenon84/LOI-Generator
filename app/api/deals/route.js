import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { DEFAULT_FORM_DATA } from "../../../lib/loiEngine";
import { DEFAULT_LEASE_DATA } from "../../../lib/leaseEngine";

const DOCUMENT_TYPE_DEFAULTS = {
  purchase_loi: DEFAULT_FORM_DATA,
  commercial_lease_loi: DEFAULT_LEASE_DATA,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deals = await prisma.deal.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, documentType: true, updatedAt: true, createdAt: true },
  });
  return NextResponse.json({ deals });
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
  const deal = await prisma.deal.create({
    data: {
      userId: session.user.id,
      name,
      documentType,
      formData: DOCUMENT_TYPE_DEFAULTS[documentType],
    },
  });
  return NextResponse.json({ id: deal.id, documentType: deal.documentType }, { status: 201 });
}
