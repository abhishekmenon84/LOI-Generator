import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { getPersonalOrgId } from "../../lib/orgAccess";
import AppShell from "../../components/AppShell";
import PersonalProfileSettings from "../../components/PersonalProfileSettings";
import PersonalSubscribeButtons from "../../components/PersonalSubscribeButtons";
import { PERSONAL_TIERS } from "../../lib/orgBilling";

export const metadata = {
  title: "Settings — Ledgerlot",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const orgId = await getPersonalOrgId(session.user.id);
  const org = orgId ? await prisma.organization.findUnique({ where: { id: orgId } }) : null;
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });

  return (
    <AppShell org={org ? { name: org.name, isPersonal: true, planTier: org.planTier } : null} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px" }}>
        <h1>Settings</h1>
        <PersonalProfileSettings
          initialUser={{
            name: currentUser?.name || "",
            phone: currentUser?.phone || "",
            licenseNumber: currentUser?.licenseNumber || "",
            image: currentUser?.image || null,
            signatureImageUrl: currentUser?.signatureImageUrl || null,
            email: session.user.email,
          }}
        />
        {org && (
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            Current plan: <strong>{org.planTier}</strong>
          </p>
        )}
        <PersonalSubscribeButtons orgId={org?.id} tiers={PERSONAL_TIERS} />
      </div>
    </AppShell>
  );
}
