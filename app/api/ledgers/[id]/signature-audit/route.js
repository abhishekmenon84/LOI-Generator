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

  // PIPEDA principles 4/5 (limiting collection/disclosure): IP address,
  // city/region/country, device/browser string, and email are collected
  // and RETAINED in SignatureEvent/SignerSlot for legal/compliance defense
  // (tamper-evidence, non-repudiation) -- that retention is unchanged. But
  // disclosing them in this UI to whoever views the audit trail (the
  // folder's admin/creator) isn't necessary for that purpose, so they're
  // no longer included in this response. Name + role + signed/pending +
  // timestamps + the signature image itself remain, since identifying WHO
  // signed and WHEN is the actual point of an audit trail. A signer's own
  // right to see their own full record (PIPEDA principle 9, individual
  // access) is a separate, not-yet-built request-your-own-data flow, not
  // this admin-facing endpoint.
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
        role: getRoleLabel(s.role, s.roleOtherLabel),
        tokenUsedAt: s.tokenUsedAt,
        signed: !!s.signatureEvent,
        signedAt: s.signatureEvent?.signedAt || null,
        signatureImageUrl: s.signatureEvent?.signatureImageUrl || null,
      })),
    })),
  });
}
