import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";
import { getRoleLabel } from "../../../../../lib/signerRoles";
import { prisma } from "../../../../../lib/prisma";

async function loadAccessibleLedger(ledgerId, userId) {
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) return null;
  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  if (!folder) return null;
  return { ...ledger, _writeAccess: folder._writeAccess };
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await loadAccessibleLedger(params.id, session.user.id);
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }

  const requests = await prisma.signatureRequest.findMany({
    where: { ledgerId: ledger.id },
    include: { signers: { include: { signatureEvent: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      verifyCode: r.verifyCode,
      createdAt: r.createdAt,
      voidedAt: r.voidedAt,
      finalDocumentHash: r.finalDocumentHash,
      signers: r.signers.map((s) => ({
        kind: s.kind,
        name: s.name,
        email: s.email,
        role: getRoleLabel(s.role, s.roleOtherLabel),
        tokenUsedAt: s.tokenUsedAt,
        signed: !!s.signatureEvent,
        signedAt: s.signatureEvent?.signedAt || null,
        signatureImageUrl: s.signatureEvent?.signatureImageUrl || null,
        userAgent: s.signatureEvent?.userAgent || null,
        screenInfo: s.signatureEvent?.screenInfo || null,
        timezoneOffset: s.signatureEvent?.timezoneOffset ?? null,
        ipAddress: s.signatureEvent?.ipAddress || null,
        geoCountry: s.signatureEvent?.geoCountry || null,
        geoRegion: s.signatureEvent?.geoRegion || null,
        geoCity: s.signatureEvent?.geoCity || null,
        documentHash: s.signatureEvent?.documentHash || null,
      })),
    })),
  });
}
