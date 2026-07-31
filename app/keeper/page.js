import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import TrialBanner from "../../components/TrialBanner";
import CreateOrgForm from "../../components/CreateOrgForm";
import OrgMembersPanel from "../../components/OrgMembersPanel";
import OrgLogoSettings from "../../components/OrgLogoSettings";
import SubscribeButtons from "../../components/SubscribeButtons";
import KeeperTabs from "../../components/KeeperTabs";
import KeeperReceipts from "../../components/KeeperReceipts";
import KeeperTemplates from "../../components/KeeperTemplates";
import { SEAT_TIERS } from "../../lib/orgBilling";

export const metadata = {
  title: "Keeper — Ledgerlot",
};

export default async function KeeperPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const adminMembership = await prisma.membership.findFirst({
    where: { userId: session.user.id, role: "admin", org: { isPersonal: false } },
    include: {
      org: {
        include: {
          memberships: { include: { user: { select: { id: true, email: true, name: true } } } },
        },
      },
    },
  });
  const org = adminMembership?.org || null;

  const receipts = org ? await prisma.receipt.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" } }) : [];
  const serializedReceipts = receipts.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));

  return (
    <>
      <SiteHeader isLoggedIn={true} />
      <main className="app-page">
        <h1>Keeper</h1>
        {!org ? (
          <>
            <p>You don&apos;t manage an organization yet. Create one to invite teammates and get shared billing.</p>
            <CreateOrgForm />
          </>
        ) : (
          <>
            <TrialBanner org={{ ...org, trialEndsAt: org.trialEndsAt?.toISOString() || null }} />
            <p>
              <strong>{org.name}</strong> · {org.planTier === "trial" ? "Trial" : org.planTier}
            </p>
            <KeeperTabs
              panels={{
                members: (
                  <OrgMembersPanel
                    org={{
                      id: org.id,
                      members: org.memberships.map((m) => ({ userId: m.userId, email: m.user.email, name: m.user.name, role: m.role, active: m.active })),
                    }}
                    currentUserId={session.user.id}
                  />
                ),
                templates: <KeeperTemplates orgId={org.id} />,
                branding: <OrgLogoSettings orgId={org.id} initialLogoUrl={org.logoUrl} />,
                billing:
                  org.planTier === "trial" || org.planTier === "expired" ? (
                    <SubscribeButtons orgId={org.id} tiers={SEAT_TIERS} />
                  ) : (
                    <p>Current plan: {org.planTier}</p>
                  ),
                receipts: <KeeperReceipts receipts={serializedReceipts} />,
              }}
            />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
