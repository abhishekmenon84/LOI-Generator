import { createHmac, randomBytes } from "crypto";
import { prisma } from "./prisma";

// Event types an org can subscribe a Webhook to. Kept small and
// high-value rather than firing on every internal state change.
export const WEBHOOK_EVENT_TYPES = [
  "document.signed", // every individual signer's completion
  "document.fully_signed", // the whole SignatureRequest reached fully_executed
  "document.declined",
  "folder.archived",
];

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

function signPayload(secret, payloadString) {
  return createHmac("sha256", secret).update(payloadString).digest("hex");
}

// Fires `eventType` to every active Webhook an org has subscribed to it,
// logging each attempt to WebhookDelivery (success or failure) -- no
// automatic retry queue (out of scope for this pass), but every attempt
// is visible to an admin. Never throws -- a broken/unreachable webhook
// must not affect the caller's own request (e.g. a signature completing
// should never fail because a customer's CRM endpoint is down).
export async function dispatchWebhookEvent(orgId, eventType, data) {
  if (!WEBHOOK_EVENT_TYPES.includes(eventType)) {
    console.error(`[webhooks] unknown event type: ${eventType}`);
    return;
  }
  const webhooks = await prisma.webhook.findMany({
    where: { orgId, active: true, eventTypes: { has: eventType } },
  });
  if (webhooks.length === 0) return;

  const payload = { event: eventType, createdAt: new Date().toISOString(), data };
  const payloadString = JSON.stringify(payload);

  await Promise.all(
    webhooks.map(async (webhook) => {
      const signature = signPayload(webhook.secret, payloadString);
      let statusCode = null;
      let error = null;
      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Ledgerlot-Signature": signature },
          body: payloadString,
          signal: AbortSignal.timeout(10_000),
        });
        statusCode = res.status;
      } catch (err) {
        error = String(err?.message || err).slice(0, 500);
      }
      await prisma.webhookDelivery.create({
        data: { webhookId: webhook.id, eventType, payload, statusCode, error },
      }).catch((err) => console.error("[webhooks] failed to log delivery:", err));
    })
  );
}
