import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../../lib/folderAccess";
import { renderEmail, escapeHtml } from "../../../../../../lib/emailTemplate";
import { Resend } from "resend";

async function loadAccessibleLedger(ledgerId, userId) {
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) return null;
  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  if (!folder) return null;
  return { ...ledger, _writeAccess: folder._writeAccess };
}

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
    return NextResponse.json({ error: "Not authorized to void this document's signature request." }, { status: 403 });
  }

  const pending = await prisma.signatureRequest.findFirst({
    where: { ledgerId: ledger.id, status: "pending" },
    include: { signers: true },
  });
  if (!pending) {
    return NextResponse.json({ error: "No in-progress signature request to void." }, { status: 400 });
  }

  await prisma.signatureRequest.update({ where: { id: pending.id }, data: { status: "voided", voidedAt: new Date() } });

  // Every recipient's link is now dead -- notify them rather than letting
  // them silently hit a "no longer active" error if they click it later
  // with no explanation of why.
  const resend = new Resend(process.env.RESEND_API_KEY);
  await Promise.all(
    pending.signers.map((s) =>
      resend.emails
        .send({
          from: "Ledgerlot <onboarding@resend.dev>",
          to: s.email,
          subject: `Signature request cancelled: ${ledger.name}`,
          html: renderEmail({
            title: "Signature request cancelled",
            body: `The request to sign <strong>${escapeHtml(ledger.name)}</strong> has been cancelled by the sender. No action is needed on your part.`,
          }),
        })
        .catch((err) => console.error("[signature-request void] notification email failed:", err))
    )
  );

  return NextResponse.json({ ok: true });
}
