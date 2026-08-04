import Stripe from "stripe";
import { prisma } from "./prisma.js";
import { BUSINESS_SEAT_TIERS, getTierForSeatCount, quotaForSeatCount } from "./pricingTiers.js";

export { BUSINESS_SEAT_TIERS, getTierForSeatCount, quotaForSeatCount };

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

// Personal tier, effective immediately: pure pay-as-you-go, no
// subscription. $2.00/document, billed as an accumulated Stripe invoice
// item at the end of the month (see reportPendingOverage below) rather
// than charged synchronously per document -- this app has no saved
// payment method / off-session charge flow, so metered "bill later" is
// the correct shape here, matching how Business overage is already billed.
export const PERSONAL_DOC_PRICE_CENTS = 200;
export const PERSONAL_DAILY_CAP = 5;
export const PERSONAL_MONTHLY_CAP = 30;

// Business tiers, effective immediately: per-seat monthly subscription
// (billed upfront), with a per-seat-per-day document quota and a flat
// $0.50/doc overage charge for anything created above the monthly quota.
// Monthly quota = seats x docsPerSeatPerDay x 30 (see quotaForSeatCount).
// Definitions now live in lib/pricingTiers.js (a zero-dependency module,
// safe to import from client components like the business-signup pricing
// slider) and are re-exported above for every existing server-side caller.
export const BUSINESS_OVERAGE_CENTS_PER_DOC = 50;

const BUSINESS_DEFAULT_RETENTION_YEARS = 3;
const USAGE_DAY_MS = 24 * 60 * 60 * 1000;
const USAGE_MONTH_MS = 30 * USAGE_DAY_MS;

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
    // Personal never blocks on "no active subscription" -- there is no
    // subscription. It blocks only on the daily/monthly document caps,
    // enforced by checkAndIncrementUsage. Viewing/exporting an already-
    // created document is always allowed; only NEW document creation is
    // capped, per the spec ("users are not blocked... they can continue"
    // is a Business-only overage behavior -- Personal has a hard cap).
    return {
      canView: true,
      canCreate: true,
      canExport: true,
      canEsign: true,
      hasAudit: true,
      hasBranding: true,
      templatesMax: Infinity,
      documentsPerDay: PERSONAL_DAILY_CAP,
      documentsPerMonth: PERSONAL_MONTHLY_CAP,
      esignPerPeriod: Infinity,
      retentionYears: org.retentionYears || 1,
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
    documentsPerDay: Infinity, // Business has no daily cap, only a monthly quota (soft, overage-billed)
    documentsPerMonth: Infinity, // Business is never hard-blocked by quota -- see checkAndIncrementUsage
    esignPerPeriod: Infinity,
    // A negotiated retentionYears on the org row overrides the 3-year
    // default (spec: "flat 3-year minimum, negotiable upward" -- this is
    // a manually-set field, not auto-derived from seat tier).
    retentionYears: org.retentionYears && org.retentionYears > BUSINESS_DEFAULT_RETENTION_YEARS ? org.retentionYears : BUSINESS_DEFAULT_RETENTION_YEARS,
  };
}

// True if the org can perform mutating actions right now.
export function isOrgActive(org) {
  return getOrgLimits(org).canCreate;
}

async function getOrCreateCounter(orgId) {
  const now = new Date();
  let counter = await prisma.usageCounter.findUnique({ where: { orgId } });
  if (!counter) {
    counter = await prisma.usageCounter.create({
      data: {
        orgId,
        dayStart: now,
        dayCount: 0,
        periodStart: now,
        periodEnd: new Date(now.getTime() + USAGE_MONTH_MS),
        monthCount: 0,
        esignRequestsSent: 0,
        pendingOverageCents: 0,
      },
    });
  }
  return counter;
}

// Rolls dayStart/dayCount forward to a fresh 24h window if the current one
// has elapsed, and periodStart/periodEnd/monthCount forward to a fresh
// 30-day window if the current one has elapsed. Each window rolls
// independently of the other. Returns the counter reflecting the current
// (possibly just-reset) windows.
async function rollWindowsIfNeeded(counter) {
  const now = new Date();
  const data = {};
  if (now.getTime() - new Date(counter.dayStart).getTime() >= USAGE_DAY_MS) {
    data.dayStart = now;
    data.dayCount = 0;
  }
  if (now > new Date(counter.periodEnd)) {
    data.periodStart = now;
    data.periodEnd = new Date(now.getTime() + USAGE_MONTH_MS);
    data.monthCount = 0;
  }
  if (Object.keys(data).length === 0) return counter;
  return prisma.usageCounter.update({ where: { orgId: counter.orgId }, data });
}

// Checks `kind` ("document" | "esign") against the org's current usage
// windows, incrementing on success, and accumulates the dollar cost of
// the action into pendingOverageCents for later Stripe invoicing.
//
// Personal: hard caps (PERSONAL_DAILY_CAP, PERSONAL_MONTHLY_CAP) block
// document creation once reached; every document that succeeds adds
// PERSONAL_DOC_PRICE_CENTS to pendingOverageCents (there is no
// subscription to cover any of it). E-signatures are not capped or
// billed for Personal.
//
// Business: never blocked by quota ("users are not blocked... overage
// charges accumulate" per the spec) -- once monthCount exceeds the
// seat-derived monthly quota, each additional document adds
// BUSINESS_OVERAGE_CENTS_PER_DOC to pendingOverageCents. E-signatures are
// not capped or billed for Business either (unchanged from before).
export async function checkAndIncrementUsage(orgId, kind, org) {
  if (kind === "esign") {
    // No cap or charge on e-signatures under the new pricing model for
    // either tier -- still tracked for visibility, never blocks.
    let counter = await getOrCreateCounter(orgId);
    counter = await rollWindowsIfNeeded(counter);
    await prisma.usageCounter.update({ where: { orgId }, data: { esignRequestsSent: { increment: 1 } } });
    return { ok: true };
  }

  let counter = await getOrCreateCounter(orgId);
  counter = await rollWindowsIfNeeded(counter);

  if (org.isPersonal) {
    if (counter.dayCount >= PERSONAL_DAILY_CAP) {
      return { ok: false, error: `You've reached your daily limit of ${PERSONAL_DAILY_CAP} documents. Try again tomorrow.` };
    }
    if (counter.monthCount >= PERSONAL_MONTHLY_CAP) {
      return { ok: false, error: `You've reached your monthly limit of ${PERSONAL_MONTHLY_CAP} documents.` };
    }
    await prisma.usageCounter.update({
      where: { orgId },
      data: {
        dayCount: { increment: 1 },
        monthCount: { increment: 1 },
        pendingOverageCents: { increment: PERSONAL_DOC_PRICE_CENTS },
      },
    });
    return { ok: true };
  }

  // Business: never blocks. Track the count; bill overage once the
  // seat-derived monthly quota is exceeded.
  const seatCount = await prisma.membership.count({ where: { orgId } });
  const quota = quotaForSeatCount(seatCount);
  const isOverage = counter.monthCount >= quota;
  await prisma.usageCounter.update({
    where: { orgId },
    data: {
      dayCount: { increment: 1 },
      monthCount: { increment: 1 },
      ...(isOverage ? { pendingOverageCents: { increment: BUSINESS_OVERAGE_CENTS_PER_DOC } } : {}),
    },
  });
  return { ok: true };
}

// Called by a monthly billing job (cron or manual invocation) to invoice
// an org's accumulated pendingOverageCents and zero it out. Both Personal
// ($2/doc, unconditional) and Business (overage only) route through this
// same "accumulate, then invoice" mechanism -- Stripe requires a
// customer, so an org with no stripeCustomerId yet (never checked out)
// has nothing to invoice against and is skipped.
export async function reportPendingOverage(orgId) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const counter = await prisma.usageCounter.findUnique({ where: { orgId } });
  if (!org || !counter || counter.pendingOverageCents <= 0) return { billed: 0 };
  if (!org.stripeCustomerId) return { billed: 0, error: "No Stripe customer on file yet." };

  const stripe = getStripeClient();
  const amountCents = counter.pendingOverageCents;
  await stripe.invoiceItems.create({
    customer: org.stripeCustomerId,
    amount: amountCents,
    currency: "usd",
    description: org.isPersonal
      ? `Ledgerlot — pay-as-you-go documents (${amountCents / PERSONAL_DOC_PRICE_CENTS} @ $${(PERSONAL_DOC_PRICE_CENTS / 100).toFixed(2)})`
      : "Ledgerlot — document overage this month",
  });
  await prisma.usageCounter.update({ where: { orgId }, data: { pendingOverageCents: 0 } });
  return { billed: amountCents };
}

// trialDays: when set, the subscription starts in Stripe's native
// "trialing" status for that many days -- Stripe collects and validates
// the card now (payment_method_collection: "always" makes this mandatory
// rather than optional-during-trial, which is Checkout's default when a
// trial is present) but charges nothing until the trial ends, at which
// point Stripe automatically invoices the card for the upcoming period
// (i.e. billed in advance, same as every subsequent period) with zero
// app-side cron/scheduling needed. Passing trialDays only on an org's
// FIRST subscribe (no existing stripeSubscriptionId) is the caller's
// responsibility -- Stripe would reject a second trial on a resubscribe
// in most cases anyway, but the intent (one trial per org, ever) belongs
// at the call site, not buried in this generic helper.
export async function createOrgSubscriptionCheckout({ org, tier, successUrl, cancelUrl, seatCount, trialDays }) {
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
    ...(trialDays ? { payment_method_collection: "always" } : {}),
    subscription_data: trialDays ? { trial_period_days: trialDays } : undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: tier.priceCentsPerSeat,
          product_data: { name: `Ledgerlot — ${tier.label}` },
        },
        quantity: seatCount,
      },
    ],
    metadata: { orgId: org.id, tierKey: tier.key, seatCount: String(seatCount) },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return checkoutSession;
}

// Called after a new Membership is created. If the org's new total seat
// count crosses into a higher tier bracket than its current Stripe
// Subscription reflects, updates the subscription's price and quantity
// (Stripe prorates the difference automatically) and updates planTier to
// match.
export async function maybeAutoUpgradeTier(orgId) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org || org.isPersonal || !org.stripeSubscriptionId) return;

  const seatCount = await prisma.membership.count({ where: { orgId } });
  const newTier = getTierForSeatCount(seatCount);
  if (!newTier || newTier.key === org.planTier) return;

  const currentTierIndex = BUSINESS_SEAT_TIERS.findIndex((t) => t.key === org.planTier);
  const newTierIndex = BUSINESS_SEAT_TIERS.findIndex((t) => t.key === newTier.key);
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
          unit_amount: newTier.priceCentsPerSeat,
          product_data: { name: `Ledgerlot — ${newTier.label}` },
        },
        quantity: seatCount,
      },
    ],
    proration_behavior: "create_prorations",
  });

  await prisma.organization.update({ where: { id: orgId }, data: { planTier: newTier.key } });
}
