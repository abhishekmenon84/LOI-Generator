import { NextResponse } from "next/server";
import path from "path";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleDeal } from "../../../../../lib/orgAccess";
import { getOrgLimits } from "../../../../../lib/orgBilling";
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
    const limits = getOrgLimits(org);
    if (!limits.canExport) {
      return NextResponse.json({ error: "Exporting requires an active subscription. Upgrade to continue.", code: "UPGRADE_REQUIRED" }, { status: 402 });
    }

    const model = buildResidentialLeaseModel(deal.formData);
    const generatedBuffer = await buildResidentialLeasePdf(model);
    const mergedBuffer = await mergePdfBuffers(generatedBuffer, ATTACHMENT_A_PATH);

    return new NextResponse(mergedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Residential_Lease.pdf"`,
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
