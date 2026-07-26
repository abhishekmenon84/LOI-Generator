import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { getUserMembership } from "../../../../../lib/orgAccess";
import { isOrgActive } from "../../../../../lib/orgBilling";
import { uploadFile } from "../../../../../lib/blobStorage";

async function requireAdminActiveOrg(orgId, userId) {
  const membership = await getUserMembership(userId, orgId);
  if (!membership || membership.role !== "admin") return { error: "Admin access required.", status: 403 };
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org || org.isPersonal) return { error: "Organization not found.", status: 404 };
  if (!isOrgActive(org)) return { error: "Your organization's trial has ended. Subscribe to continue.", status: 402, code: "TRIAL_EXPIRED" };
  return { org };
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const gate = await requireAdminActiveOrg(params.id, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error, ...(gate.code ? { code: gate.code } : {}) }, { status: gate.status });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const name = (formData?.get("name") || "").toString().trim();
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "A template name is required." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Custom templates must be PDF files." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let pageCount;
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    pageCount = pdfDoc.getPageCount();
  } catch {
    return NextResponse.json({ error: "That file could not be read as a valid PDF." }, { status: 400 });
  }

  let uploaded;
  try {
    uploaded = await uploadFile(buffer, file.name, "application/pdf");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const created = await prisma.customTemplate.create({
    data: {
      orgId: gate.org.id,
      name,
      pdfUrl: uploaded.url,
      pageCount,
      createdByUserId: session.user.id,
    },
    include: { anchors: true },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of that organization." }, { status: 403 });
  }
  const templates = await prisma.customTemplate.findMany({
    where: { orgId: params.id },
    select: { id: true, name: true, pageCount: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}
