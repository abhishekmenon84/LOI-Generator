import { NextResponse } from "next/server";
import { auth } from "../../../../../../../lib/auth";
import { loadAccessibleFolder } from "../../../../../../../lib/folderAccess";
import { getRoleLabel } from "../../../../../../../lib/signerRoles";
import { prisma } from "../../../../../../../lib/prisma";
import { buildCompletionCertificate } from "../../../../../../../lib/completionCertificate";

// Regenerates the same Certificate of Completion emailed at finalization
// (see lib/signatureFinalize.js) on demand -- deterministic from the
// SignatureEvent rows, so there's no need to persist a stored copy
// separately. Same access model as the signature-audit route: whoever can
// see this Ledger's audit trail can re-download its certificate.
export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ledger = await prisma.ledger.findUnique({ where: { id: params.id } });
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  const folder = await loadAccessibleFolder(ledger.folderId, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }

  const sigRequest = await prisma.signatureRequest.findUnique({
    where: { id: params.requestId },
    include: { signers: { include: { signatureEvent: true } } },
  });
  if (!sigRequest || sigRequest.ledgerId !== ledger.id || sigRequest.status !== "fully_executed") {
    return NextResponse.json({ error: "No fully executed signature request found." }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const verifyUrl = `${appUrl}/verify/${sigRequest.verifyCode}`;
  const signerSlots = sigRequest.signers.filter((s) => s.kind === "signer" && s.signatureEvent);
  const certificateSlots = signerSlots.map((s) => ({
    name: s.name,
    roleLabel: getRoleLabel(s.role, s.roleOtherLabel),
    signedAt: s.signatureEvent.signedAt.toISOString(),
    ipAddress: s.signatureEvent.ipAddress,
    geoCity: s.signatureEvent.geoCity,
    geoRegion: s.signatureEvent.geoRegion,
    geoCountry: s.signatureEvent.geoCountry,
    userAgent: s.signatureEvent.userAgent,
    screenInfo: s.signatureEvent.screenInfo,
    timezoneOffset: s.signatureEvent.timezoneOffset,
    documentHash: s.signatureEvent.documentHash,
  }));

  const certificatePdf = await buildCompletionCertificate({
    dealName: ledger.name,
    documentHash: sigRequest.finalDocumentHash,
    verifyUrl,
    signedSlots: certificateSlots,
  });

  return new NextResponse(certificatePdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ledger.name.replace(/[^a-z0-9]+/gi, "_")}_certificate.pdf"`,
    },
  });
}
