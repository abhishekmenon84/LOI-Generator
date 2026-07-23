import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import TrialBanner from "../../../components/TrialBanner";
import CreateOrgForm from "../../../components/CreateOrgForm";
import OrgMembersPanel from "../../../components/OrgMembersPanel";
import SubscribeButtons from "../../../components/SubscribeButtons";
import { SEAT_TIERS } from "../../../lib/orgBilling";

export const metadata = {
  title: "Organization Settings — LOI Builder",
};

export default async function OrgSettingsPage() {
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

  return (
    <>
      <SiteHeader isLoggedIn={true} />
      <main className="marketing-page">
        <h1>Organization Settings</h1>
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
            {(org.planTier === "trial" || org.planTier === "expired") && (
              <div style={{ marginBottom: 24 }}>
                <h2>Subscribe</h2>
                <SubscribeButtons orgId={org.id} tiers={SEAT_TIERS} />
              </div>
            )}
            <OrgMembersPanel
              org={{
                id: org.id,
                members: org.memberships.map((m) => ({ userId: m.userId, email: m.user.email, name: m.user.name, role: m.role })),
              }}
              currentUserId={session.user.id}
            />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
