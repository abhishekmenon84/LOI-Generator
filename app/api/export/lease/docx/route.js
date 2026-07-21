import { NextResponse } from "next/server";
import { buildLeaseModel } from "../../../../../lib/leaseEngine";
import { buildLeaseDocx } from "../../../../../lib/docxBuilder";

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData } = body;

    const model = buildLeaseModel(formData);
    const buffer = await buildLeaseDocx(model);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="Letter_of_Intent_to_Lease.docx"',
      },
    });
  } catch (err) {
    console.error("export/lease/docx error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
