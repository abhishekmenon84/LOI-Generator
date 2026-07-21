import { NextResponse } from "next/server";
import path from "path";
import { buildResidentialLeaseModel } from "../../../../../lib/residentialLeaseEngine";
import { buildResidentialLeasePdf } from "../../../../../lib/pdfBuilder";
import { mergePdfBuffers } from "../../../../../lib/pdfMerge";

const ATTACHMENT_A_PATH = path.join(process.cwd(), "public", "legal", "nb-residential-lease-attachment-a.pdf");

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData } = body;

    const model = buildResidentialLeaseModel(formData);
    const generatedBuffer = await buildResidentialLeasePdf(model);
    const mergedBuffer = await mergePdfBuffers(generatedBuffer, ATTACHMENT_A_PATH);

    return new NextResponse(mergedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Residential_Lease.pdf"',
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
