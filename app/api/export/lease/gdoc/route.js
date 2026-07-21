import { NextResponse } from "next/server";
import { buildLeaseModel } from "../../../../../lib/leaseEngine";
import { buildLeaseDocx } from "../../../../../lib/docxBuilder";

// Google Docs, Word, and Pages all import real .docx files reliably, so the
// "GDoc" export reuses the same docx builder as the Word export rather than
// a hand-rolled HTML document (which legacy HTML-to-.doc importers, notably
// macOS Pages, rendered with broken table layout).
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
    console.error("export/lease/gdoc error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
