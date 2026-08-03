import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

// Generates a new raw API key (never stored) plus its hash/prefix (what
// IS stored). "llk_" prefix (Ledgerlot key) makes a leaked key
// recognizable in logs/secret scanners, matching common practice (e.g.
// Stripe's "sk_", GitHub's "ghp_").
export function generateApiKey() {
  const raw = `llk_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(raw).digest("hex");
  const keyPrefix = raw.slice(0, 12);
  return { raw, keyHash, keyPrefix };
}

// Resolves the Bearer token on a request to its owning Organization, or
// null if missing/invalid/revoked. Updates lastUsedAt best-effort (never
// blocks the request on that write failing).
export async function authenticateApiKey(request) {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const raw = match[1].trim();
  const keyHash = createHash("sha256").update(raw).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || apiKey.revokedAt) return null;

  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { orgId: apiKey.orgId, apiKeyId: apiKey.id };
}
