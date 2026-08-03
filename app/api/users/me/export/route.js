import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { listAccessibleFolders } from "../../../../../lib/folderAccess";
import { listUserOrgs } from "../../../../../lib/orgAccess";
import { getRoleLabel } from "../../../../../lib/signerRoles";
import { buildZip } from "../../../../../lib/zipBundle";
import { checkRateLimit, getClientIp } from "../../../../../lib/rateLimit";

// PIPEDA principle 9 (individual access) / GDPR Article 20 (data
// portability): a user can request a reasonably complete copy of their own
// personal data. Unlike the admin-facing signature-audit UI (which
// deliberately redacts IP/geo/device per principles 4/5, since a folder
// admin doesn't need that data about OTHER people), this is the account
// owner requesting their OWN data -- so signature events they're party to
// include full detail, matching what their own completion certificate
// already shows them.
//
// Scope: every folder the user can currently access (owned, admin'd, or
// shared with them), that folder's ledgers/files, and every signature
// request tied to those ledgers. Does not include other users' folders in
// a shared org merely because the requester is an org admin with
// unrelated access -- this is "your data", not "everything your role can
// see", so it walks the same accessible-folder scope any other feature
// already uses, not a raw org-wide dump.
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`export-me-ip:${ip}`, { max: 5, windowMs: 60_000 });
  if (ipLimit.limited) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true, licenseNumber: true },
  });

  const orgs = await listUserOrgs(userId);
  const folders = await listAccessibleFolders(userId, { includeArchived: true });
  const folderIds = folders.map((f) => f.id);

  const ledgers = folderIds.length > 0
    ? await prisma.ledger.findMany({
        where: { folderId: { in: folderIds } },
        select: { id: true, folderId: true, name: true, documentType: true, formData: true, locked: true, archivedAt: true, createdAt: true, updatedAt: true },
      })
    : [];
  const ledgerIds = ledgers.map((l) => l.id);

  const files = folderIds.length > 0
    ? await prisma.folderFile.findMany({
        where: { folderId: { in: folderIds } },
        select: { id: true, folderId: true, name: true, mimeType: true, fileUrl: true, archivedAt: true, createdAt: true },
      })
    : [];

  const signatureRequests = ledgerIds.length > 0
    ? await prisma.signatureRequest.findMany({
        where: { ledgerId: { in: ledgerIds } },
        include: { signers: { include: { signatureEvent: true } } },
      })
    : [];

  const exportedAt = new Date().toISOString();

  const zipFiles = [
    {
      name: "account.json",
      buffer: Buffer.from(JSON.stringify({ exportedAt, user, organizations: orgs }, null, 2)),
    },
    {
      name: "folders.json",
      buffer: Buffer.from(JSON.stringify(folders.map((f) => ({
        id: f.id, name: f.name, stage: f.stage, orgId: f.orgId, parentFolderId: f.parentFolderId,
        archivedAt: f.archivedAt, createdAt: f.createdAt, updatedAt: f.updatedAt,
      })), null, 2)),
    },
    {
      name: "documents.json",
      buffer: Buffer.from(JSON.stringify(ledgers, null, 2)),
    },
    {
      name: "uploaded_files.json",
      buffer: Buffer.from(JSON.stringify(files, null, 2)),
    },
    {
      name: "signature_requests.json",
      buffer: Buffer.from(JSON.stringify(
        signatureRequests.map((r) => ({
          id: r.id,
          ledgerId: r.ledgerId,
          status: r.status,
          verifyCode: r.verifyCode,
          createdAt: r.createdAt,
          voidedAt: r.voidedAt,
          expiresAt: r.expiresAt,
          finalDocumentHash: r.finalDocumentHash,
          signers: r.signers.map((s) => ({
            kind: s.kind,
            name: s.name,
            email: s.email,
            role: getRoleLabel(s.role, s.roleOtherLabel),
            order: s.order,
            tokenUsedAt: s.tokenUsedAt,
            declinedAt: s.declinedAt,
            declineReason: s.declineReason,
            signatureEvent: s.signatureEvent
              ? {
                  signedAt: s.signatureEvent.signedAt,
                  documentHash: s.signatureEvent.documentHash,
                  ipAddress: s.signatureEvent.ipAddress,
                  geoCity: s.signatureEvent.geoCity,
                  geoRegion: s.signatureEvent.geoRegion,
                  geoCountry: s.signatureEvent.geoCountry,
                  userAgent: s.signatureEvent.userAgent,
                  screenInfo: s.signatureEvent.screenInfo,
                  timezoneOffset: s.signatureEvent.timezoneOffset,
                }
              : null,
          })),
        })),
        null,
        2
      )),
    },
    {
      name: "README.txt",
      buffer: Buffer.from(
        `Ledgerlot data export for ${user.email}\nGenerated: ${exportedAt}\n\n` +
        "This archive contains your account profile, organization memberships, every folder you have access to, " +
        "the documents (Ledgers) and uploaded files inside them, and every signature request tied to those documents " +
        "(including full signing-event detail for requests you created or participated in).\n\n" +
        "uploaded_files.json lists each file's storage URL rather than embedding the file itself -- fetch each fileUrl " +
        "directly if you need the underlying file content.\n"
      ),
    },
  ];

  const zipBuffer = await buildZip(zipFiles);

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="ledgerlot-export-${userId}.zip"`,
    },
  });
}
