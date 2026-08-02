import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { getPrimaryOrgForShell, listUserOrgs } from "../../lib/orgAccess";
import { prisma } from "../../lib/prisma";
import AppShell from "../../components/AppShell";
import ContactsList from "../../components/ContactsList";

export const metadata = {
  title: "Contacts — Ledgerlot",
};

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [primaryOrg, userOrgs] = await Promise.all([
    getPrimaryOrgForShell(session.user.id),
    listUserOrgs(session.user.id),
  ]);

  const orgIds = userOrgs.map((o) => o.orgId);
  const contacts = orgIds.length > 0
    ? await prisma.contact.findMany({ where: { orgId: { in: orgIds } }, orderBy: { createdAt: "desc" } })
    : [];

  const emails = contacts.map((c) => c.email).filter(Boolean);
  const slots = emails.length > 0
    ? await prisma.signerSlot.findMany({ where: { email: { in: emails } }, select: { email: true, tokenUsedAt: true, createdAt: true } })
    : [];
  const slotsByEmail = new Map();
  for (const s of slots) {
    const list = slotsByEmail.get(s.email) || [];
    list.push(s);
    slotsByEmail.set(s.email, list);
  }

  const initialContacts = contacts.map((c) => {
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

  return (
    <AppShell org={primaryOrg} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px" }}>
        <h1 style={{ marginBottom: 24 }}>Contacts</h1>
        <ContactsList initialContacts={initialContacts} userOrgs={userOrgs} />
      </div>
    </AppShell>
  );
}
