import Stripe from "stripe";
import { prisma } from "./prisma";

let _stripe = null;

export function getStripeClient() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  }
  return _stripe;
}

export const SEAT_TIERS = [
  { key: "tier_1_10", minSeats: 1, maxSeats: 10, priceCents: 29900, label: "1-10 seats" },
  { key: "tier_11_30", minSeats: 11, maxSeats: 30, priceCents: 69900, label: "11-30 seats" },
  { key: "tier_31_50", minSeats: 31, maxSeats: 50, priceCents: 99900, label: "31-50 seats" },
];

// Returns null for seat counts above 50 — caller must show "contact us"
// rather than a self-serve checkout in that case.
export function getTierForSeatCount(seatCount) {
  return SEAT_TIERS.find((t) => seatCount >= t.minSeats && seatCount <= t.maxSeats) || null;
}

export function isTrialExpired(org) {
  if (org.isPersonal) return false;
  if (org.planTier !== "trial") return false;
  if (!org.trialEndsAt) return false;
  return new Date() > new Date(org.trialEndsAt);
}

// True if the org can perform mutating actions right now (not personal,
// not trial-expired-without-subscription). Personal orgs are always "active"
// for the purposes of this check — their own pay-per-document gating is a
// separate, not-yet-built system per this plan's Global Constraints.
export function isOrgActive(org) {
  if (org.isPersonal) return true;
  if (org.planTier === "expired") return false;
  if (org.planTier === "trial" && isTrialExpired(org)) return false;
  return true;
}

export async function createOrgSubscriptionCheckout({ org, tier, successUrl, cancelUrl }) {
  const stripe = getStripeClient();

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ name: org.name, metadata: { orgId: org.id } });
    customerId = customer.id;
    await prisma.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customerId } });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: tier.priceCents,
          product_data: { name: `LOI Builder — ${tier.label}` },
        },
        quantity: 1,
      },
    ],
    metadata: { orgId: org.id, tierKey: tier.key },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return checkoutSession;
}

// Called after a new Membership is created. If the org's new total seat
// count crosses into a higher tier than its current Stripe Subscription
// reflects, updates the subscription's price (Stripe prorates the
// difference automatically) and updates planTier to match.
export async function maybeAutoUpgradeTier(orgId) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org || org.isPersonal || !org.stripeSubscriptionId) return;

  const seatCount = await prisma.membership.count({ where: { orgId } });
  const newTier = getTierForSeatCount(seatCount);
  if (!newTier || newTier.key === org.planTier) return;

  const currentTierIndex = SEAT_TIERS.findIndex((t) => t.key === org.planTier);
  const newTierIndex = SEAT_TIERS.findIndex((t) => t.key === newTier.key);
  if (newTierIndex <= currentTierIndex) return; // only auto-upgrade, never downgrade automatically

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  const currentItemId = subscription.items.data[0].id;

  await stripe.subscriptions.update(org.stripeSubscriptionId, {
    items: [
      {
        id: currentItemId,
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: newTier.priceCents,
          product_data: { name: `LOI Builder — ${newTier.label}` },
        },
      },
    ],
    proration_behavior: "create_prorations",
  });

  await prisma.organization.update({ where: { id: orgId }, data: { planTier: newTier.key } });
}
