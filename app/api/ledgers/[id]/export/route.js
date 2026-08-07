import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleLedger } from "../../../../../lib/ledgerAccess";
import { getOrgLimits } from "../../../../../lib/orgBilling";
import { buildLOIModel } from "../../../../../lib/loiEngine";
import { buildLeaseModel } from "../../../../../lib/leaseEngine";
import { buildResidentialLeaseModel } from "../../../../../lib/residentialLeaseEngine";
import { buildLOIPdf, buildLeasePdf, buildResidentialLeasePdf } from "../../../../../lib/pdfBuilder";
import { buildLOIDocx, buildLeaseDocx, buildResidentialLeaseDocx } from "../../../../../lib/docxBuilder";

// Ledger-scoped export for the three built-in document types -- the
// pre-existing /api/export/pdf and /api/export/docx routes only ever
// accepted a legacy Deal's dealId, so the Folder/Ledger workspace
// (app/ledgerboard/folder/[folderId]/page.js) had no export route to call
// at all and its Export buttons were a permanent stub ("Export isn't
// available in this workspace yet."). custom_template/form_template
// Ledgers are NOT handled here -- they have their own dedicated screen
// (app/ledgerboard/custom-template/[ledgerId]) with no Form/Preview
// mapping in the folder workspace, so its Export button can never target
// one of those anyway.
const BUILDERS = {
  purchase_loi: { buildModel: buildLOIModel, buildPdf: buildLOIPdf, buildDocx: buildLOIDocx, filename: "Letter_of_Intent" },
  commercial_lease: { buildModel: buildLeaseModel, buildPdf: buildLeasePdf, buildDocx: buildLeaseDocx, filename: "Commercial_Lease_LOI" },
  residential_lease: { buildModel: buildResidentialLeaseModel, buildPdf: buildResidentialLeasePdf, buildDocx: buildResidentialLeaseDocx, filename: "Residential_Lease" },
};

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const ledger = await loadAccessibleLedger(params.id, session.user.id);
    if (!ledger) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    // A pure view-only LedgerParticipant grant doesn't include export,
    // matching loadAccessibleLedger's own documented convention.
    if (ledger._viewOnly) {
      return NextResponse.json({ error: "You only have view access to this document." }, { status: 403 });
    }

    const builder = BUILDERS[ledger.documentType];
    if (!builder) {
      return NextResponse.json({ error: "Export isn't available for this document type." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const format = body.format === "docx" ? "docx" : "pdf";

    const folder = await prisma.folder.findUnique({ where: { id: ledger.folderId }, select: { orgId: true } });
    const org = await prisma.organization.findUnique({ where: { id: folder.orgId } });
    const limits = getOrgLimits(org);
    if (!limits.canExport) {
      return NextResponse.json({ error: "Exporting requires an active subscription. Upgrade to continue.", code: "UPGRADE_REQUIRED" }, { status: 402 });
    }

    let buffer;
    let filename = "document";

    if (ledger.documentType === "custom_template" || ledger.documentType === "form_template") {
      if (format === "docx") {
        return NextResponse.json({ error: "Word export is not supported for templates." }, { status: 400 });
      }
      const { buildDealPdf } = await import("../../../../../lib/dealPdfBuilder");
      buffer = await buildDealPdf(ledger);
      filename = ledger.name || "Template_Document";
    } else {
      const builder = BUILDERS[ledger.documentType];
      if (!builder) {
        return NextResponse.json({ error: "Export isn't available for this document type." }, { status: 400 });
      }
      const model = builder.buildModel(ledger.formData);
      buffer = format === "docx" ? await builder.buildDocx(model) : await builder.buildPdf(model);
      filename = `${builder.filename}.${format}`;
    }

    const cleanFilename = filename.replace(/[^a-z0-9]+/gi, "_");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
        "Content-Disposition": `attachment; filename="${cleanFilename}.${format}"`,
      },
    });
  } catch (err) {
    console.error("ledgers/[id]/export error:", err);
    return NextResponse.json({ error: err.message || "Export failed." }, { status: err.status || 500 });
  }
}
