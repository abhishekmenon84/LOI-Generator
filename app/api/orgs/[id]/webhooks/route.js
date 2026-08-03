import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { getUserMembership } from "../../../../../lib/orgAccess";
import { generateWebhookSecret, WEBHOOK_EVENT_TYPES } from "../../../../../lib/webhooks";

async function requireAdmin(orgId, userId) {
  const membership = await getUserMembership(userId, orgId);
  if (!membership || membership.role !== "admin") return { error: "Admin access required.", status: 403 };
  return {};
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const gate = await requireAdmin(params.id, session.user.id);
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const webhooks = await prisma.webhook.findMany({ where: { orgId: params.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    webhooks: webhooks.map((w) => ({ id: w.id, url: w.url, eventTypes: w.eventTypes, active: w.active, createdAt: w.createdAt })),
  });
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const gate = await requireAdmin(params.id, session.user.id);
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json().catch(() => ({}));
  const url = (body.url || "").trim();
  const eventTypes = Array.isArray(body.eventTypes) ? body.eventTypes.filter((t) => WEBHOOK_EVENT_TYPES.includes(t)) : [];

  if (!url || !/^https:\/\//.test(url)) {
    return NextResponse.json({ error: "A valid https:// URL is required." }, { status: 400 });
  }
  if (eventTypes.length === 0) {
    return NextResponse.json({ error: "At least one event type is required." }, { status: 400 });
  }

  const secret = generateWebhookSecret();
  const webhook = await prisma.webhook.create({
    data: { orgId: params.id, url, secret, eventTypes, createdByUserId: session.user.id },
  });

  // The secret is returned exactly once, here -- used to verify the
  // X-Ledgerlot-Signature header on each delivery (see lib/webhooks.js).
  return NextResponse.json({ id: webhook.id, url: webhook.url, eventTypes: webhook.eventTypes, secret }, { status: 201 });
}
