import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { getUserMembership } from "../../../../../../lib/orgAccess";
import { createOrgSubscriptionCheckout, SEAT_TIERS } from "../../../../../../lib/orgBilling";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({ where: { id: params.id } });
  if (!org || org.isPersonal) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedTierKey = body.tierKey;
  const tier = SEAT_TIERS.find((t) => t.key === requestedTierKey);
  if (!tier) {
    return NextResponse.json({ error: "Invalid or unsupported tier (50+ seats requires contacting support)." }, { status: 400 });
  }

  const origin = request.headers.get("origin") || new URL(request.url).origin;

  try {
    const checkoutSession = await createOrgSubscriptionCheckout({
      org,
      tier,
      successUrl: `${origin}/settings/organization?billing=success`,
      cancelUrl: `${origin}/settings/organization?billing=cancelled`,
    });
    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (err) {
    console.error("orgs/billing/checkout error:", err);
    return NextResponse.json({ error: err.message || "Could not start checkout." }, { status: 500 });
  }
}
