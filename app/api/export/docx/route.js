import { NextResponse } from "next/server";
import { buildLOIModel } from "../../../../lib/loiEngine";
import { buildLOIDocx } from "../../../../lib/docxBuilder";

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData } = body;

    const model = buildLOIModel(formData);
    const buffer = await buildLOIDocx(model);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="Letter_of_Intent.docx"',
      },
    });
  } catch (err) {
    console.error("export/docx error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
