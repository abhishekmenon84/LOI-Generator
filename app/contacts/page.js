import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { getPrimaryOrgForShell } from "../../lib/orgAccess";
import AppShell from "../../components/AppShell";

export const metadata = {
  title: "Contacts — Ledgerlot",
};

// Placeholder -- no Contact data model exists yet. Kept as its own route
// (rather than omitted) so the sidebar nav matches the approved design;
// building a real contacts/CRM feature is a separate, larger piece of work.
export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const primaryOrg = await getPrimaryOrgForShell(session.user.id);

  return (
    <AppShell org={primaryOrg} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px" }}>
        <h1 style={{ marginBottom: 12 }}>Contacts</h1>
        <p style={{ color: "var(--text-secondary)" }}>Coming soon — a place to keep the people you deal with.</p>
      </div>
    </AppShell>
  );
}
