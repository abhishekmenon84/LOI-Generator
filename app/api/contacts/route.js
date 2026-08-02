import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getUserMembership, listUserOrgs } from "../../../lib/orgAccess";

// GET returns every Contact across every org the user belongs to (personal
// + business, if any), each annotated with a computed documentCount and
// lastActivityAt derived by matching the Contact's email against
// SignerSlot rows -- these are facts about existing signature requests,
// not stored on Contact itself (see prisma/schema.prisma's Contact model
// comment).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const userOrgs = await listUserOrgs(session.user.id);
  const orgIds = userOrgs.map((o) => o.orgId);
  if (orgIds.length === 0) {
    return NextResponse.json({ contacts: [] });
  }

  const contacts = await prisma.contact.findMany({
    where: { orgId: { in: orgIds } },
    orderBy: { createdAt: "desc" },
  });

  const emails = contacts.map((c) => c.email).filter(Boolean);
  const slots = emails.length > 0
    ? await prisma.signerSlot.findMany({
        where: { email: { in: emails } },
        select: { email: true, tokenUsedAt: true, createdAt: true },
      })
    : [];
  const slotsByEmail = new Map();
  for (const s of slots) {
    const list = slotsByEmail.get(s.email) || [];
    list.push(s);
    slotsByEmail.set(s.email, list);
  }

  const serialized = contacts.map((c) => {
    const matchingSlots = c.email ? slotsByEmail.get(c.email) || [] : [];
    const lastActivityAt = matchingSlots.reduce((latest, s) => {
      const activityDate = s.tokenUsedAt || s.createdAt;
      return !latest || activityDate > latest ? activityDate : latest;
    }, null);
    return {
      id: c.id,
      orgId: c.orgId,
      name: c.name,
      role: c.role,
      email: c.email,
      documentCount: matchingSlots.length,
      lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
    };
  });

  return NextResponse.json({ contacts: serialized });
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const role = (body.role || "").trim();
  const email = typeof body.email === "string" ? body.email.trim() || null : null;
  const orgId = body.orgId;

  if (!name) {
    return NextResponse.json({ error: "A name is required." }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ error: "A role is required." }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "An orgId is required." }, { status: 400 });
  }

  const membership = await getUserMembership(session.user.id, orgId);
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of that organization." }, { status: 403 });
  }

  const contact = await prisma.contact.create({
    data: { orgId, name, role, email, createdByUserId: session.user.id },
  });

  return NextResponse.json(
    { id: contact.id, orgId: contact.orgId, name: contact.name, role: contact.role, email: contact.email, documentCount: 0, lastActivityAt: null },
    { status: 201 }
  );
}
