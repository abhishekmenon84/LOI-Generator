import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authenticateApiKey } from "../../../../lib/apiKeyAuth";
import { checkRateLimit, getClientIp } from "../../../../lib/rateLimit";

// Public API v1 -- Bearer-token (API key) authenticated, not session-cookie
// based. Scoped strictly to the key's own org (never cross-org, unlike a
// session's org-admin-sees-all rule) -- an external integration should
// only ever see the one org it was issued a key for.
export async function GET(request) {
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`api-v1-ip:${ip}`, { max: 100, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  const folders = await prisma.folder.findMany({
    where: { orgId: auth.orgId, archivedAt: null },
    select: { id: true, name: true, stage: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ folders });
}
