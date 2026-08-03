import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { checkSignatureRequestIntegrity } from "../../../../lib/verifyIntegrity";
import * as Sentry from "@sentry/nextjs";

// Vercel Cron target (see vercel.json's crons entry) -- proactively
// re-verifies every fully_executed SignatureRequest's stored hash against
// a freshly regenerated PDF, rather than relying purely on someone
// happening to hit GET /api/verify/[verifyCode]. Silent corruption (a Blob
// file overwritten, a DB row altered) would otherwise go undetected
// indefinitely. Processes a bounded batch per run (oldest-checked-first)
// so this scales to a large document volume without one run doing
// unbounded work. Protected by CRON_SECRET, same as the signature-reminders
// cron.
const BATCH_SIZE = 200;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const candidates = await prisma.signatureRequest.findMany({
    where: { status: "fully_executed" },
    orderBy: [{ lastIntegrityCheckAt: { sort: "asc", nulls: "first" } }],
    take: BATCH_SIZE,
    include: { ledger: true, signers: { include: { signatureEvent: true } } },
  });

  let checked = 0;
  let failed = 0;

  for (const sigRequest of candidates) {
    let valid = false;
    try {
      valid = await checkSignatureRequestIntegrity(sigRequest);
    } catch (err) {
      console.error(`[cron verify-integrity] check errored for ${sigRequest.id}:`, err.message);
      valid = false;
    }

    checked++;
    const data = { lastIntegrityCheckAt: new Date() };
    if (!valid) {
      failed++;
      data.integrityCheckFailedAt = new Date();
      console.error(`[cron verify-integrity] INTEGRITY FAILURE for SignatureRequest ${sigRequest.id} (Ledger: ${sigRequest.ledger.name})`);
      Sentry.captureMessage(`Signature integrity check failed for ${sigRequest.id}`, {
        level: "error",
        tags: { signatureRequestId: sigRequest.id, ledgerId: sigRequest.ledgerId },
      });
    } else {
      data.integrityCheckFailedAt = null;
    }
    await prisma.signatureRequest.update({ where: { id: sigRequest.id }, data });
  }

  return NextResponse.json({ ok: true, checked, failed });
}
