import { NextResponse } from "next/server";
import { auth } from "../../../../../../lib/auth";
import { prisma } from "../../../../../../lib/prisma";
import { loadAccessibleFolder } from "../../../../../../lib/folderAccess";

export async function PATCH(request, { params }) {
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
  const task = await prisma.task.findFirst({ where: { id: params.taskId, folderId: folder.id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if ("dueDate" in body) {
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.dueDate && Number.isNaN(dueDate?.getTime())) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }
    data.dueDate = dueDate;
    // Changing the due date re-arms the deadline-reminder cron for this
    // task rather than leaving it permanently silenced from a prior date.
    data.reminderSentAt = null;
  }
  if (typeof body.completed === "boolean") {
    data.completed = body.completed;
    data.completedAt = body.completed ? new Date() : null;
  }
  if ("assignedToUserId" in body) {
    if (body.assignedToUserId) {
      const assigneeAccess = await loadAccessibleFolder(folder.id, body.assignedToUserId);
      if (!assigneeAccess) {
        return NextResponse.json({ error: "The assigned user doesn't have access to this folder." }, { status: 400 });
      }
      data.assignedToUserId = body.assignedToUserId;
    } else {
      data.assignedToUserId = null;
    }
  }

  const updated = await prisma.task.update({ where: { id: task.id }, data });
  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    dueDate: updated.dueDate,
    completed: updated.completed,
    completedAt: updated.completedAt,
  });
}

export async function DELETE(request, { params }) {
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
  await prisma.task.deleteMany({ where: { id: params.taskId, folderId: folder.id } });
  return NextResponse.json({ ok: true });
}
