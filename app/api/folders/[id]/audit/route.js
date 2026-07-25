import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../lib/folderAccess";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  // Step 1: Fetch audit events without actor relation (since it doesn't exist in schema)
  const events = await prisma.folderAuditEvent.findMany({
    where: { folderId: params.id },
    orderBy: { createdAt: "asc" },
  });

  // Step 2: Extract unique actorUserIds and fetch User records
  const actorUserIds = [...new Set(events.map((e) => e.actorUserId))];
  const users = await prisma.user.findMany({
    where: { id: { in: actorUserIds } },
    select: { id: true, name: true, email: true },
  });

  // Build a map from userId to {name, email}
  const userMap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));

  // Merge actor info into events
  const eventsWithActors = events.map((e) => {
    const actor = userMap.get(e.actorUserId) || { name: null, email: null };
    return {
      id: e.id,
      action: e.action,
      reason: e.reason,
      actorName: actor.name,
      actorEmail: actor.email,
      createdAt: e.createdAt,
    };
  });

  return NextResponse.json({ events: eventsWithActors });
}
