import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { loadAccessibleDeal, getUserMembership } from "../../../../../lib/orgAccess";
import { getRoleLabel } from "../../../../../lib/signerRoles";
import { prisma } from "../../../../../lib/prisma";

async function canViewAudit(deal, userId) {
  if (deal.createdByUserId === userId) return true;
  const membership = await getUserMembership(userId, deal.orgId);
  return !!membership && membership.role === "admin";
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const deal = await loadAccessibleDeal(params.id, session.user.id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  if (!(await canViewAudit(deal, session.user.id))) {
    return NextResponse.json({ error: "Not authorized to view this deal's signature audit trail." }, { status: 403 });
  }

  const requests = await prisma.signatureRequest.findMany({
    where: { dealId: deal.id },
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
