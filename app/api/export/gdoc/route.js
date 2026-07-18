import { NextResponse } from "next/server";
import { buildLOIModel } from "../../../../lib/loiEngine";
import { buildLOIHtml } from "../../../../lib/htmlBuilder";

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData } = body;

    const model = buildLOIModel(formData);
    const html = buildLOIHtml(model);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "application/msword",
        "Content-Disposition": 'attachment; filename="Letter_of_Intent.doc"',
      },
    });
  } catch (err) {
    console.error("export/gdoc error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
