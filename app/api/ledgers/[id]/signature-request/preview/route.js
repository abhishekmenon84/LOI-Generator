import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../../lib/folderAccess";
import { isValidRole } from "../../../../../../lib/signerRoles";
import { buildDealPdf } from "../../../../../../lib/dealPdfBuilder";
import { findSignatureLines } from "../../../../../../lib/findSignatureLines";
import { findBestNameForLine } from "../../../../../../lib/signatureAnchors.js";

// Renders a preview of the same PDF signers will actually sign (no writes
// -- purely a read/render step) and pre-seeds a suggested placement for
// the sender's review step (components/SignatureAnchorReview.jsx). Same
// access requirement as the actual create route
// (app/api/ledgers/[id]/signature-request/route.js) since this exposes
// the document's real content.
async function loadAccessibleLedger(ledgerId, userId) {
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) return null;
  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  if (!folder) return null;
  return { ...ledger, _writeAccess: folder._writeAccess };
}

const BUILT_IN_TYPES = ["purchase_loi", "commercial_lease", "residential_lease"];

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const ledger = await loadAccessibleLedger(params.id, session.user.id);
  if (!ledger) {
    return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
  }
  if (!ledger._writeAccess) {
    return NextResponse.json({ error: "Not authorized to send this document for signature." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const participants = Array.isArray(body.participants) ? body.participants : [];
  const signerParticipants = participants.filter((p) => p.kind === "signer" && (p.name || "").trim());

  let pdfBuffer;
  try {
    pdfBuffer = await buildDealPdf(ledger);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not render a preview of this document." }, { status: 400 });
  }

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageSizes = pdfDoc.getPages().map((p) => {
    const { width, height } = p.getSize();
    return { width, height };
  });

  const suggestedAnchors = [];

  if (BUILT_IN_TYPES.includes(ledger.documentType)) {
    const lines = await findSignatureLines(pdfBuffer);
    const unmatchedNames = signerParticipants.map((p) => p.name.trim());
    const claimed = new Set();
    for (const line of lines) {
      const available = unmatchedNames.filter((n) => !claimed.has(n));
      const name = findBestNameForLine(line, available);
      if (!name) continue;
      claimed.add(name);
      const signerOrder = signerParticipants.findIndex((p) => p.name.trim() === name);
      const pageSize = pageSizes[line.page];
      if (!pageSize) continue;
      // Mirrors lib/pdfSignatureBurn.js's own placement: the image sits
      // just above the detected line, ~24pt tall, capped at 40% page width.
      const boxHeightPts = 24;
      const boxWidthPts = Math.min(Math.max(line.width, 80), pageSize.width * 0.4);
      const bottomOriginY = line.y + line.height + 2;
      suggestedAnchors.push({
        signerOrder,
        type: "signature",
        page: line.page,
        xPct: (line.x / pageSize.width) * 100,
        yPct: ((pageSize.height - bottomOriginY - boxHeightPts) / pageSize.height) * 100,
        widthPct: (boxWidthPts / pageSize.width) * 100,
        heightPct: (boxHeightPts / pageSize.height) * 100,
      });
    }
  } else if (ledger.documentType === "custom_template") {
    const templateId = ledger.formData?.templateId;
    if (templateId) {
      const template = await prisma.customTemplate.findUnique({ where: { id: templateId }, include: { anchors: true } });
      for (const anchor of template?.anchors || []) {
        if (anchor.type !== "signature" && anchor.type !== "initials" && anchor.type !== "date") continue;
        const signerOrder = signerParticipants.findIndex((p) => p.role === anchor.role);
        if (signerOrder === -1) continue;
        suggestedAnchors.push({
          signerOrder,
          type: anchor.type,
          page: anchor.page,
          xPct: anchor.xPct,
          yPct: anchor.yPct,
          widthPct: anchor.widthPct,
          heightPct: anchor.heightPct,
        });
      }
    }
  }
  // form_template: intentionally returns no suggestions -- see the design
  // spec's "Out of scope" note (FormField is a separate model/shape; the
  // sender can still place anchors manually, nothing is blocked).

  return NextResponse.json({
    pdfBase64: pdfBuffer.toString("base64"),
    pageSizes,
    suggestedAnchors,
  });
}
