import Stripe from "stripe";
import { prisma } from "./prisma.js";

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

export const PERSONAL_TIERS = [
  { key: "free", priceCents: 0, documentsPerPeriod: 0, templatesMax: 0, esignPerPeriod: 0, retentionYears: 0, hasAudit: false, hasBranding: false },
  { key: "personal_premium", priceCents: 1500, documentsPerPeriod: 5, templatesMax: 1, esignPerPeriod: 15, retentionYears: 1, hasAudit: true, hasBranding: true },
  { key: "personal_premium_plus", priceCents: 3000, documentsPerPeriod: 15, templatesMax: 10, esignPerPeriod: 30, retentionYears: 1, hasAudit: true, hasBranding: true },
];

export const BUSINESS_SEAT_TIERS = [
  { key: "tier_1_10", minSeats: 1, maxSeats: 10, priceCents: 30000, label: "1-10 seats" },
  { key: "tier_11_30", minSeats: 11, maxSeats: 30, priceCents: 75000, label: "11-30 seats" },
  { key: "tier_31_50", minSeats: 31, maxSeats: 50, priceCents: 100000, label: "31-50 seats" },
  { key: "tier_51_100", minSeats: 51, maxSeats: 100, priceCents: 150000, label: "51-100 seats" },
];

// Deprecated alias, kept for one release so existing imports don't break
// mid-rollout (billing checkout route, Keeper billing tab). Remove once
// every call site uses BUSINESS_SEAT_TIERS directly (see plan Task 6).
export const SEAT_TIERS = BUSINESS_SEAT_TIERS;

const BUSINESS_DEFAULT_RETENTION_YEARS = 3;

// Returns null for seat counts above 100 -- caller must show "contact us"
// rather than a self-serve checkout in that case.
export function getTierForSeatCount(seatCount) {
  return BUSINESS_SEAT_TIERS.find((t) => seatCount >= t.minSeats && seatCount <= t.maxSeats) || null;
}

export function isTrialExpired(org) {
  if (org.isPersonal) return false;
  if (org.planTier !== "trial") return false;
  if (!org.trialEndsAt) return false;
  return new Date() > new Date(org.trialEndsAt);
}

// Single source of truth for what an org is allowed to do right now.
// Every export/create/e-sign/template route should check this instead of
// re-deriving tier rules inline.
export function getOrgLimits(org) {
  if (org.isPersonal) {
    const tier = PERSONAL_TIERS.find((t) => t.key === org.planTier) || PERSONAL_TIERS[0];
    const active = tier.key !== "free";
    return {
      canView: true,
      canCreate: active,
      canExport: active,
      canEsign: active,
      hasAudit: tier.hasAudit,
      hasBranding: tier.hasBranding,
      templatesMax: tier.templatesMax,
      documentsPerPeriod: tier.documentsPerPeriod,
      esignPerPeriod: tier.esignPerPeriod,
      retentionYears: tier.retentionYears,
    };
  }

  // Business org.
  const isBusinessActive = org.planTier !== "expired" && !(org.planTier === "trial" && isTrialExpired(org));
  return {
    canView: true,
    canCreate: isBusinessActive,
    canExport: isBusinessActive,
    canEsign: isBusinessActive,
    hasAudit: isBusinessActive,
    hasBranding: isBusinessActive,
    templatesMax: Infinity,
    documentsPerPeriod: Infinity,
    esignPerPeriod: Infinity,
    // A negotiated retentionYears on the org row overrides the 3-year
    // default (spec: "flat 3-year minimum, negotiable upward" -- this is
    // a manually-set field, not auto-derived from seat tier).
    retentionYears: org.retentionYears && org.retentionYears > BUSINESS_DEFAULT_RETENTION_YEARS ? org.retentionYears : BUSINESS_DEFAULT_RETENTION_YEARS,
  };
}

// True if the org can perform mutating actions right now. Personal orgs on
// the free tier are NOT active -- this is the behavior change from the old
// "personal orgs are always active" logic.
export function isOrgActive(org) {
  return getOrgLimits(org).canCreate;
}

const USAGE_PERIOD_DAYS = 30;

// Checks `kind` ("document" | "esign") against the org's tier limit for
// its current rolling 30-day usage window, incrementing on success.
// Business orgs are unlimited and never touch UsageCounter at all --
// checked and returned before any Prisma call, matching the spec's
// "no per-user monthly cap at any business tier."
export async function checkAndIncrementUsage(orgId, kind, org) {
  if (!org.isPersonal) return { ok: true };

  const limits = getOrgLimits(org);
  const limit = kind === "document" ? limits.documentsPerPeriod : limits.esignPerPeriod;
  if (limit === 0) return { ok: false, error: "Your plan does not include this. Upgrade to Premium to continue." };

  const now = new Date();
  let counter = await prisma.usageCounter.findUnique({ where: { orgId } });

  if (!counter || now > counter.periodEnd) {
    // First use, or the rolling window has expired -- start a fresh
    // 30-day window from now, matching "rolling 30 days from
    // subscription date": each renewal/usage cycle rolls forward from
    // whenever the previous window closed, not from a fixed calendar
    // anchor.
    const periodStart = now;
    const periodEnd = new Date(now.getTime() + USAGE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    counter = await prisma.usageCounter.upsert({
      where: { orgId },
      create: { orgId, periodStart, periodEnd, documentsCreated: 0, esignRequestsSent: 0 },
      update: { periodStart, periodEnd, documentsCreated: 0, esignRequestsSent: 0 },
    });
  }

  const currentCount = kind === "document" ? counter.documentsCreated : counter.esignRequestsSent;
  if (currentCount >= limit) {
    return { ok: false, error: `You've reached your plan's limit of ${limit} ${kind === "document" ? "documents" : "e-signature requests"} this period. Upgrade for a higher limit.` };
  }

  await prisma.usageCounter.update({
    where: { orgId },
    data: kind === "document" ? { documentsCreated: { increment: 1 } } : { esignRequestsSent: { increment: 1 } },
  });

  return { ok: true };
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
          product_data: { name: `Ledgerlot — ${tier.label}` },
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
          product_data: { name: `Ledgerlot — ${newTier.label}` },
        },
      },
    ],
    proration_behavior: "create_prorations",
  });

  await prisma.organization.update({ where: { id: orgId }, data: { planTier: newTier.key } });
}
