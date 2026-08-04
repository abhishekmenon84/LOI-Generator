import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { getUserMembership } from "../../../../../../lib/orgAccess";
import { createOrgSubscriptionCheckout, getTierForSeatCount } from "../../../../../../lib/orgBilling";

// Tier is derived from the org's actual seat count, not chosen by the
// admin -- pricing is now strictly per-seat-bracket (see
// lib/orgBilling.js's BUSINESS_SEAT_TIERS), so there is no "which tier do
// you want" choice to make; the only choice is whether to subscribe at
// all.
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

  const seatCount = await prisma.membership.count({ where: { orgId: org.id } });
  const tier = getTierForSeatCount(seatCount);
  if (!tier) {
    return NextResponse.json({ error: "100+ seats requires contacting support for custom pricing." }, { status: 400 });
  }

  const origin = request.headers.get("origin") || new URL(request.url).origin;

  // A 7-day trial (card required, nothing charged until day 7) is offered
  // exactly once per org, on its first-ever subscribe -- an org that
  // already has a stripeSubscriptionId (resubscribing after a downgrade,
  // or changing seat count) goes straight to normal billing.
  const trialDays = org.stripeSubscriptionId ? undefined : 7;

  try {
    const checkoutSession = await createOrgSubscriptionCheckout({
      org,
      tier,
      seatCount,
      trialDays,
      successUrl: `${origin}/keeper?billing=success`,
      cancelUrl: `${origin}/keeper?billing=cancelled`,
    });
    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (err) {
    console.error("orgs/billing/checkout error:", err);
    return NextResponse.json({ error: err.message || "Could not start checkout." }, { status: 500 });
  }
}
