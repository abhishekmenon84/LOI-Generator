import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { buildResidentialLeaseModel } from "../../../../../lib/residentialLeaseEngine";
import { buildResidentialLeaseDocx } from "../../../../../lib/docxBuilder";
import { buildZip } from "../../../../../lib/zipBundle";

const ATTACHMENT_A_PATH = path.join(process.cwd(), "public", "legal", "nb-residential-lease-attachment-a.pdf");

export async function POST(request) {
  try {
    const body = await request.json();
    const { formData } = body;

    const model = buildResidentialLeaseModel(formData);
    const docxBuffer = await buildResidentialLeaseDocx(model);
    const attachmentABuffer = await readFile(ATTACHMENT_A_PATH);

    const zipBuffer = await buildZip([
      { name: "Residential_Lease_Sections_1-7.docx", buffer: docxBuffer },
      { name: "Attachment_A.pdf", buffer: attachmentABuffer },
    ]);

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Residential_Lease.zip"',
      },
    });
  } catch (err) {
    console.error("export/residential-lease/docx error:", err);
    return NextResponse.json(
      { error: err.message || "Export failed." },
      { status: err.status || 500 }
    );
  }
}
