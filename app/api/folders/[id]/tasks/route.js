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

  const tasks = await prisma.task.findMany({
    where: { folderId: folder.id },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      completed: t.completed,
      completedAt: t.completedAt,
      assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: t.assignedTo.name, email: t.assignedTo.email } : null,
      createdAt: t.createdAt,
    })),
  });
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const folder = await loadAccessibleFolder(params.id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }
  if (!folder._writeAccess) {
    return NextResponse.json({ error: "You only have read access to this folder." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "A task title is required." }, { status: 400 });
  }
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
  }

  let assignedToUserId = null;
  if (typeof body.assignedToUserId === "string" && body.assignedToUserId) {
    // Only a real participant (creator, org admin/member with folder
    // access, or explicit FolderParticipant) can be assigned -- validated
    // by checking they can themselves access this folder, rather than a
    // DB relation constraint (a task can otherwise reference anyone).
    const assigneeAccess = await loadAccessibleFolder(folder.id, body.assignedToUserId);
    if (!assigneeAccess) {
      return NextResponse.json({ error: "The assigned user doesn't have access to this folder." }, { status: 400 });
    }
    assignedToUserId = body.assignedToUserId;
  }

  const task = await prisma.task.create({
    data: {
      folderId: folder.id,
      title,
      dueDate,
      assignedToUserId,
      createdByUserId: session.user.id,
    },
  });

  return NextResponse.json({ id: task.id, title: task.title, dueDate: task.dueDate, completed: task.completed }, { status: 201 });
}
