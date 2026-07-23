import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { loadAccessibleDeal } from "../../../../lib/orgAccess";
import { isOrgActive } from "../../../../lib/orgBilling";

const VALID_STAGES = ["draft", "active", "pending", "closed"];

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadAccessibleDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: deal.id,
    name: deal.name,
    documentType: deal.documentType,
    formData: deal.formData,
    stage: deal.stage,
    readOnly: !deal._writeAccess,
  });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadAccessibleDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (!deal._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this deal." }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({ where: { id: deal.orgId } });
  if (!isOrgActive(org)) {
    return NextResponse.json({ error: "Your organization's trial has ended. Subscribe to continue.", code: "TRIAL_EXPIRED" }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.formData && typeof body.formData === "object") data.formData = body.formData;
  if (typeof body.stage === "string" && VALID_STAGES.includes(body.stage)) data.stage = body.stage;
  const updated = await prisma.deal.update({ where: { id: deal.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, stage: updated.stage, updatedAt: updated.updatedAt });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadAccessibleDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (!deal._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this deal." }, { status: 403 });
  }
  await prisma.deal.delete({ where: { id: deal.id } });
  return NextResponse.json({ ok: true });
}
