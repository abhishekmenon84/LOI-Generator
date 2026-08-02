import { prisma } from "./prisma";

// Fixed-window rate limiter backed by Postgres (no Redis in this stack).
// Not perfectly precise under heavy concurrency, but more than sufficient
// to stop scraping/brute-force against public, unauthenticated endpoints
// like /api/sign/[token] and /api/verify/[verifyCode].
export async function checkRateLimit(bucketKey, { max, windowMs }) {
  const windowStart = new Date(Date.now() - windowMs);

  const count = await prisma.rateLimitHit.count({
    where: { bucketKey, createdAt: { gte: windowStart } },
  });

  if (count >= max) {
    return { limited: true };
  }

  await prisma.rateLimitHit.create({ data: { bucketKey } });

  // Best-effort cleanup of old rows for this bucket so the table doesn't
  // grow unbounded; failure here must never block the request itself.
  prisma.rateLimitHit
    .deleteMany({ where: { bucketKey, createdAt: { lt: windowStart } } })
    .catch(() => {});

  return { limited: false };
}

export function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
