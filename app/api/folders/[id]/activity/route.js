import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";

const AUDIT_ACTION_LABELS = {
  created: "Folder created",
  archived: "Folder archived",
  trashed: "Folder moved to trash",
  restored: "Folder restored",
  moved: "Folder moved",
  linked_child: "Linked a document",
  unlinked_child: "Unlinked a document",
};

// Merges every kind of deal-level event this app tracks into one
// chronological timeline -- previously each lived in its own disconnected
// place (the audit panel showed only FolderAuditEvent, signature status
// only in the audit trail, comments only in their own panel, tasks only
// in theirs). A true unified feed the way dotloop's "Loop Activity" works.
// Read-only, no writes -- purely a merge/sort over existing data.
export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  const ledgers = await prisma.ledger.findMany({
    where: { folderId: folder.id },
    select: { id: true, name: true, createdAt: true },
  });
  const ledgerIds = ledgers.map((l) => l.id);
  const ledgerNameById = new Map(ledgers.map((l) => [l.id, l.name]));

  const [auditEvents, comments, tasks, signatureRequests] = await Promise.all([
    prisma.folderAuditEvent.findMany({
      where: { folderId: folder.id },
      // actorUserId resolved in a batched lookup below, not via include
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.folderComment.findMany({
      where: { folderId: folder.id },
      include: { author: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.task.findMany({
      where: { folderId: folder.id },
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    ledgerIds.length > 0
      ? prisma.signatureRequest.findMany({
          where: { ledgerId: { in: ledgerIds } },
          include: { signers: { include: { signatureEvent: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [],
  ]);

  const actorIds = [...new Set(auditEvents.map((e) => e.actorUserId))];
  const actors = actorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const actorById = new Map(actors.map((u) => [u.id, u]));

  const items = [];

  for (const e of auditEvents) {
    const actor = actorById.get(e.actorUserId);
    items.push({
      type: "folder_event",
      at: e.createdAt,
      text: `${actor?.name || actor?.email || "Someone"} — ${AUDIT_ACTION_LABELS[e.action] || e.action}`,
      detail: e.reason || null,
    });
  }

  for (const c of comments) {
    items.push({
      type: "comment",
      at: c.createdAt,
      text: `${c.author.name || c.author.email} commented`,
      detail: c.body.length > 140 ? `${c.body.slice(0, 140)}…` : c.body,
    });
  }

  for (const t of tasks) {
    items.push({
      type: "task_created",
      at: t.createdAt,
      text: `${t.createdBy.name || t.createdBy.email} added a task: ${t.title}`,
      detail: t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : null,
    });
    if (t.completed && t.completedAt) {
      items.push({
        type: "task_completed",
        at: t.completedAt,
        text: `Task completed: ${t.title}`,
        detail: null,
      });
    }
  }

  for (const r of signatureRequests) {
    const ledgerName = ledgerNameById.get(r.ledgerId) || "a document";
    items.push({
      type: "signature_sent",
      at: r.createdAt,
      text: `Sent for signature: ${ledgerName}`,
      detail: null,
    });
    if (r.voidedAt) {
      items.push({ type: "signature_voided", at: r.voidedAt, text: `Signature request voided: ${ledgerName}`, detail: null });
    }
    for (const s of r.signers) {
      if (s.signatureEvent) {
        items.push({
          type: "signed",
          at: s.signatureEvent.signedAt,
          text: `${s.name} signed: ${ledgerName}`,
          detail: null,
        });
      }
      if (s.declinedAt) {
        items.push({
          type: "declined",
          at: s.declinedAt,
          text: `${s.name} declined to sign: ${ledgerName}`,
          detail: s.declineReason || null,
        });
      }
    }
    if (r.status === "fully_executed") {
      // Approximated by the latest signer's signedAt rather than a
      // separate completedAt field on SignatureRequest (none exists) --
      // good enough for a timeline entry, not used for anything else.
      const lastSigned = r.signers.map((s) => s.signatureEvent?.signedAt).filter(Boolean).sort().pop();
      if (lastSigned) {
        items.push({ type: "fully_signed", at: lastSigned, text: `Fully signed: ${ledgerName}`, detail: null });
      }
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json({ items: items.slice(0, 100) });
}
