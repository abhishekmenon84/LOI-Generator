import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { isPlatformAdmin } from "../../../../lib/platformAdmin";

const VALID_STATUSES = new Set(["unverified", "pending", "verified", "rejected"]);

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email || !isPlatformAdmin(session.user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
  }

  const orgs = await prisma.organization.findMany({
    where: { isPersonal: false, verificationStatus: status },
    include: { verificationDocument: true },
    orderBy: { verificationSubmittedAt: "desc" },
  });

  return NextResponse.json({
    organizations: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      businessName: o.businessName,
      province: o.province,
      verificationStatus: o.verificationStatus,
      verificationSubmittedAt: o.verificationSubmittedAt,
      document: o.verificationDocument
        ? {
            id: o.verificationDocument.id,
            documentType: o.verificationDocument.documentType,
            fileName: o.verificationDocument.fileName,
            fileUrl: o.verificationDocument.fileUrl,
            uploadedAt: o.verificationDocument.uploadedAt,
          }
        : null,
    })),
  });
}
