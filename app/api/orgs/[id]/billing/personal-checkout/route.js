import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { getUserMembership } from "../../../../../../lib/orgAccess";
import { createPersonalSubscriptionCheckout, PERSONAL_TIERS } from "../../../../../../lib/orgBilling";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const org = await prisma.organization.findUnique({ where: { id: params.id } });
  if (!org || !org.isPersonal) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const tier = PERSONAL_TIERS.find((t) => t.key === body.tierKey && t.key !== "free");
  if (!tier) {
    return NextResponse.json({ error: "Invalid or unsupported tier." }, { status: 400 });
  }

  const origin = request.headers.get("origin") || new URL(request.url).origin;

  try {
    const checkoutSession = await createPersonalSubscriptionCheckout({
      org,
      tier,
      successUrl: `${origin}/keeper?billing=success`,
      cancelUrl: `${origin}/keeper?billing=cancelled`,
    });
    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (err) {
    console.error("orgs/billing/personal-checkout error:", err);
    return NextResponse.json({ error: err.message || "Could not start checkout." }, { status: 500 });
  }
}
