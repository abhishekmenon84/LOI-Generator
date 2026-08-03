import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { authenticateApiKey } from "../../../../../lib/apiKeyAuth";
import { checkRateLimit, getClientIp } from "../../../../../lib/rateLimit";

export async function GET(request, { params }) {
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`api-v1-ip:${ip}`, { max: 100, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  const ledger = await prisma.ledger.findUnique({
    where: { id: params.id },
    include: {
      folder: { select: { orgId: true } },
      signatureRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { signers: { include: { signatureEvent: true } } },
      },
    },
  });
  if (!ledger || ledger.folder.orgId !== auth.orgId) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const latestRequest = ledger.signatureRequests[0] || null;

  return NextResponse.json({
    id: ledger.id,
    name: ledger.name,
    documentType: ledger.documentType,
    locked: ledger.locked,
    signatureStatus: latestRequest
      ? {
          status: latestRequest.status,
          verifyCode: latestRequest.verifyCode,
          signers: latestRequest.signers
            .filter((s) => s.kind === "signer")
            .map((s) => ({
              name: s.name,
              signed: !!s.signatureEvent,
              signedAt: s.signatureEvent?.signedAt || null,
              declined: !!s.declinedAt,
            })),
        }
      : null,
  });
}
