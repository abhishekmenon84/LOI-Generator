import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { getStripeClient } from "../../../../../../lib/orgBilling";

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

  // Stripe delivers events at-least-once, so the same event.id can arrive
  // more than once (retries, redeliveries). Record it before processing and
  // bail out on a duplicate — otherwise a stale redelivery of an OLD
  // checkout.session.completed could overwrite a planTier that has since
  // been auto-upgraded, silently desyncing the DB from the real Stripe
  // subscription.
  try {
    await prisma.processedWebhookEvent.create({ data: { id: event.id } });
  } catch (err) {
    if (err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
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
      const fallbackTier = org.isPersonal ? "free" : "expired";
      await prisma.organization.update({ where: { id: org.id }, data: { planTier: fallbackTier, stripeSubscriptionId: null } });
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    const org = await prisma.organization.findUnique({ where: { stripeCustomerId: invoice.customer } });
    if (org) {
      await prisma.receipt.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          orgId: org.id,
          stripeInvoiceId: invoice.id,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
        },
        update: {
          amountPaid: invoice.amount_paid,
          status: invoice.status,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
