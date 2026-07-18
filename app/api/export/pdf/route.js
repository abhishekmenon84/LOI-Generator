import { NextResponse } from "next/server";
import { buildLOIModel } from "../../../../lib/loiEngine";
import { buildLOIPdf } from "../../../../lib/pdfBuilder";

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData } = body;

    const model = buildLOIModel(formData);
    const buffer = await buildLOIPdf(model);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Letter_of_Intent.pdf"',
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
