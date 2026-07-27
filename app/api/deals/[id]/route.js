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

  // Resolve this Deal's corresponding Ledger, if any, using the same
  // (name, documentType, createdAt) matching heuristic the one-off
  // scripts/backfill-signature-ledger-ids.mjs script used -- see that
  // script for the full rationale. A Deal with zero or multiple (ambiguous)
  // matches resolves to ledgerId: null rather than crashing.
  let ledgerId = null;
  const ledgerCandidates = await prisma.ledger.findMany({
    where: {
      name: deal.name,
      documentType: deal.documentType,
      createdAt: deal.createdAt,
    },
    select: { id: true },
  });
  if (ledgerCandidates.length === 1) {
    ledgerId = ledgerCandidates[0].id;
  }

  return NextResponse.json({
    id: deal.id,
    name: deal.name,
    documentType: deal.documentType,
    formData: deal.formData,
    stage: deal.stage,
    locked: deal.locked,
    readOnly: !deal._writeAccess,
    ledgerId,
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

  if (deal.locked) {
    return NextResponse.json({ error: "This document has been fully signed and can no longer be edited.", code: "DEAL_LOCKED" }, { status: 409 });
  }
  if (deal.deletedAt) {
    return NextResponse.json({ error: "This deal is in Trash and can no longer be edited. Restore it first.", code: "DEAL_TRASHED" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.formData && typeof body.formData === "object") data.formData = body.formData;
  if (typeof body.stage === "string" && VALID_STAGES.includes(body.stage)) data.stage = body.stage;
  if (body.priority === null || ["green", "yellow", "grey"].includes(body.priority)) data.priority = body.priority;
  const updated = await prisma.deal.update({ where: { id: deal.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, stage: updated.stage, priority: updated.priority, updatedAt: updated.updatedAt });
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
  if (deal.locked) {
    return NextResponse.json({ error: "This document has been fully signed and can no longer be deleted.", code: "DEAL_LOCKED" }, { status: 409 });
  }
  await prisma.deal.update({ where: { id: deal.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
