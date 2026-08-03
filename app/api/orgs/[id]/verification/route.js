import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { getUserMembership } from "../../../../../lib/orgAccess";
import { uploadFile } from "../../../../../lib/blobStorage";
import { isAllowedUploadMimeType, MAX_UPLOAD_BYTES } from "../../../../../lib/uploadPolicy";

const VALID_DOCUMENT_TYPES = new Set([
  "incorporation_certificate",
  "business_registration",
  "partnership_agreement",
  "sole_proprietor_id",
  "other",
]);

// Uploads (or re-uploads, after a rejection) a business's registration
// proof. Purely informational per product decision -- uploading, or never
// uploading at all, never blocks any action; it only ever moves
// Organization.verificationStatus between unverified/pending/verified/
// rejected, which the UI surfaces as a banner (see
// components/VerificationBanner.jsx) and nothing else reads.
export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Only an org admin can submit business verification." }, { status: 403 });
  }
  const org = await prisma.organization.findUnique({ where: { id: params.id } });
  if (!org || org.isPersonal) {
    return NextResponse.json({ error: "Business verification only applies to Business organizations." }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const documentType = formData?.get("documentType");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (!VALID_DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedUploadMimeType(mimeType) && mimeType !== "application/msword") {
    return NextResponse.json({ error: "This file type isn't supported. Upload a PDF, Word document, or common image format." }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File is too large. The limit is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  let uploaded;
  try {
    uploaded = await uploadFile(buffer, file.name, mimeType);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  await prisma.$transaction([
    prisma.businessVerificationDocument.upsert({
      where: { orgId: org.id },
      create: {
        orgId: org.id,
        documentType,
        fileName: file.name,
        fileUrl: uploaded.url,
        fileHash,
        fileSizeBytes: file.size,
        uploadedByUserId: session.user.id,
      },
      update: {
        documentType,
        fileName: file.name,
        fileUrl: uploaded.url,
        fileHash,
        fileSizeBytes: file.size,
        uploadedByUserId: session.user.id,
        uploadedAt: new Date(),
        reviewedByUserId: null,
        reviewNotes: null,
      },
    }),
    prisma.organization.update({ where: { id: org.id }, data: { verificationStatus: "pending", verificationSubmittedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true, status: "pending" });
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const membership = await getUserMembership(session.user.id, params.id);
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this organization." }, { status: 403 });
  }
  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    include: { verificationDocument: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }
  return NextResponse.json({
    status: org.verificationStatus,
    submittedAt: org.verificationSubmittedAt,
    approvedAt: org.verificationApprovedAt,
    document: org.verificationDocument
      ? {
          documentType: org.verificationDocument.documentType,
          fileName: org.verificationDocument.fileName,
          uploadedAt: org.verificationDocument.uploadedAt,
          reviewNotes: org.verificationDocument.reviewNotes,
        }
      : null,
  });
}
