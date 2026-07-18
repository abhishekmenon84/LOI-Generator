import { NextResponse } from "next/server";
import { buildLOIModel } from "../../../../lib/loiEngine";
import { buildLOIDocx } from "../../../../lib/docxBuilder";

// Google Docs, Word, and Pages all import real .docx files reliably, so the
// "GDoc" export reuses the same docx builder as the Word export rather than
// a hand-rolled HTML document (which legacy HTML-to-.doc importers, notably
// macOS Pages, rendered with broken table layout).
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
    console.error("export/gdoc error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
