import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// Vercel Cron target (see vercel.json's crons entry) -- daily auto-purge
// of unsigned draft Ledgers older than their org's Organization.retentionDays
// (personal orgs: fixed 30 days; business orgs: user-configured at
// signup, 1-7 years in days). Deliberately NEVER deletes a fully-signed
// (locked: true) Ledger regardless of age -- retention exists to PRESERVE
// completed deal records, not auto-destroy them; only unsigned drafts
// that were simply abandoned are purged. Protected by CRON_SECRET, same
// pattern as the other crons.
const BATCH_SIZE = 500;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true, retentionDays: true },
  });

  let purgedTotal = 0;
  for (const org of orgs) {
    const cutoff = new Date(Date.now() - org.retentionDays * 24 * 60 * 60 * 1000);
    const candidates = await prisma.ledger.findMany({
      where: {
        folder: { orgId: org.id },
        locked: false,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (candidates.length === 0) continue;

    // A Ledger with any signature request in flight (pending) is not an
    // "abandoned draft" in the same sense -- skip it rather than deleting
    // out from under an active signing process.
    const idsWithPendingRequest = new Set(
      (
        await prisma.signatureRequest.findMany({
          where: { ledgerId: { in: candidates.map((c) => c.id) }, status: "pending" },
          select: { ledgerId: true },
        })
      ).map((r) => r.ledgerId)
    );
    const toDelete = candidates.filter((c) => !idsWithPendingRequest.has(c.id));
    if (toDelete.length === 0) continue;

    const { count } = await prisma.ledger.deleteMany({ where: { id: { in: toDelete.map((c) => c.id) } } });
    purgedTotal += count;
  }

  return NextResponse.json({ ok: true, purged: purgedTotal });
}
