import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { getUserMembership } from "../../../../lib/orgAccess";

async function loadContactWithAccess(contactId, userId) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { error: "Contact not found.", status: 404 };
  const membership = await getUserMembership(userId, contact.orgId);
  if (!membership) return { error: "Contact not found.", status: 404 };
  return { contact };
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const gate = await loadContactWithAccess(params.id, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if ("name" in body) {
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    data.name = name;
  }
  if ("role" in body) {
    const role = (body.role || "").trim();
    if (!role) return NextResponse.json({ error: "Role cannot be empty." }, { status: 400 });
    data.role = role;
  }
  if ("email" in body) {
    data.email = typeof body.email === "string" ? body.email.trim() || null : null;
  }

  const updated = await prisma.contact.update({ where: { id: params.id }, data });
  return NextResponse.json({ id: updated.id, orgId: updated.orgId, name: updated.name, role: updated.role, email: updated.email });
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const gate = await loadContactWithAccess(params.id, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  await prisma.contact.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
