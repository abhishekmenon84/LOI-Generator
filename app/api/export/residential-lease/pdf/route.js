import { NextResponse } from "next/server";
import path from "path";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleDeal } from "../../../../../lib/orgAccess";
import { isOrgActive } from "../../../../../lib/orgBilling";
import { buildResidentialLeaseModel } from "../../../../../lib/residentialLeaseEngine";
import { buildResidentialLeasePdf } from "../../../../../lib/pdfBuilder";
import { mergePdfBuffers } from "../../../../../lib/pdfMerge";

const ATTACHMENT_A_PATH = path.join(process.cwd(), "public", "legal", "nb-residential-lease-attachment-a.pdf");

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
    const model = buildResidentialLeaseModel(deal.formData);
    const generatedBuffer = await buildResidentialLeasePdf(model, { watermark: forceWatermark });
    const mergedBuffer = await mergePdfBuffers(generatedBuffer, ATTACHMENT_A_PATH);

    return new NextResponse(mergedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${forceWatermark ? "Residential_Lease_SAMPLE.pdf" : "Residential_Lease.pdf"}"`,
      },
    });
  } catch (err) {
    console.error("export/residential-lease/pdf error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
