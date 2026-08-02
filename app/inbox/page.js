import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { getPrimaryOrgForShell } from "../../lib/orgAccess";
import AppShell from "../../components/AppShell";

export const metadata = {
  title: "Inbox — Ledgerlot",
};

// Placeholder -- no notifications/messages data model exists yet. Kept as
// its own route (rather than omitted) so the sidebar nav matches the
// approved design; building a real inbox/notifications feature is a
// separate, larger piece of work.
export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const primaryOrg = await getPrimaryOrgForShell(session.user.id);

  return (
    <AppShell org={primaryOrg} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px" }}>
        <h1 style={{ marginBottom: 12 }}>Inbox</h1>
        <p style={{ color: "var(--text-secondary)" }}>Coming soon — notifications and activity will show up here.</p>
      </div>
    </AppShell>
  );
}
