import { NextResponse } from "next/server";
import { buildLeaseModel } from "../../../../../lib/leaseEngine";
import { buildLeasePdf } from "../../../../../lib/pdfBuilder";

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData } = body;

    const model = buildLeaseModel(formData);
    const buffer = await buildLeasePdf(model);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Letter_of_Intent_to_Lease.pdf"',
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
