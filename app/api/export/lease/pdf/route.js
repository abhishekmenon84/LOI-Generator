import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleDeal } from "../../../../../lib/orgAccess";
import { isOrgActive } from "../../../../../lib/orgBilling";
import { buildLeaseModel } from "../../../../../lib/leaseEngine";
import { buildLeasePdf } from "../../../../../lib/pdfBuilder";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const dealId = body.dealId;
    if (!dealId) {
      return NextResponse.json({ error: "dealId is required." }, { status: 400 });
    }

    const deal = await loadAccessibleDeal(dealId, session.user.id);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }

    const org = await prisma.organization.findUnique({ where: { id: deal.orgId } });
    if (!isOrgActive(org)) {
      return NextResponse.json({ error: "Your organization's trial has ended. Subscribe to continue.", code: "TRIAL_EXPIRED" }, { status: 402 });
    }

    const forceWatermark = !org.isPersonal && org.planTier === "trial";
    const model = buildLeaseModel(deal.formData);
    const buffer = await buildLeasePdf(model, { watermark: forceWatermark });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${forceWatermark ? "Letter_of_Intent_to_Lease_SAMPLE.pdf" : "Letter_of_Intent_to_Lease.pdf"}"`,
      },
    });
  } catch (err) {
    console.error("export/lease/pdf error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
