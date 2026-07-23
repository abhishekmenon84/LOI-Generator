import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { getStripeClient, getTierForSeatCount } from "../../../../../../lib/orgBilling";

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("orgs/billing/webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object;
    if (checkoutSession.mode === "subscription" && checkoutSession.metadata?.orgId) {
      await prisma.organization.update({
        where: { id: checkoutSession.metadata.orgId },
        data: {
          planTier: checkoutSession.metadata.tierKey,
          stripeSubscriptionId: checkoutSession.subscription,
        },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const org = await prisma.organization.findUnique({ where: { stripeSubscriptionId: subscription.id } });
    if (org) {
      await prisma.organization.update({ where: { id: org.id }, data: { planTier: "expired", stripeSubscriptionId: null } });
    }
  }

  return NextResponse.json({ received: true });
}
