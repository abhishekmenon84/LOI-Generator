import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { loadAccessibleDeal } from "../../../../lib/orgAccess";
import { getOrgLimits } from "../../../../lib/orgBilling";
import { buildLOIModel } from "../../../../lib/loiEngine";
import { buildLOIPdf } from "../../../../lib/pdfBuilder";

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

    const model = buildLOIModel(deal.formData);
    const buffer = await buildLOIPdf(model);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Letter_of_Intent.pdf"`,
      },
    });
  } catch (err) {
    console.error("export/pdf error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
