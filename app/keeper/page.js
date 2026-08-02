import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import AppShell from "../../components/AppShell";
import TrialBanner from "../../components/TrialBanner";
import CreateOrgForm from "../../components/CreateOrgForm";
import OrgMembersPanel from "../../components/OrgMembersPanel";
import OrgLogoSettings from "../../components/OrgLogoSettings";
import SubscribeButtons from "../../components/SubscribeButtons";
import KeeperTabs from "../../components/KeeperTabs";
import KeeperReceipts from "../../components/KeeperReceipts";
import KeeperTemplates from "../../components/KeeperTemplates";
import { getTierForSeatCount, quotaForSeatCount } from "../../lib/orgBilling";

export const metadata = {
  title: "Settings — Ledgerlot",
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

  const seatCount = org ? org.memberships.length : 0;
  const tier = org ? getTierForSeatCount(seatCount) : null;
  const monthlyQuota = org ? quotaForSeatCount(seatCount) : 0;
  const usage = org ? await prisma.usageCounter.findUnique({ where: { orgId: org.id } }) : null;

  return (
    <AppShell
      org={org ? { name: org.name, isPersonal: false, planTier: org.planTier } : null}
      userInitial={(session.user.email || "?").charAt(0).toUpperCase()}
    >
      <div style={{ padding: "32px 28px" }}>
        <h1>Settings</h1>
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
              tabs={[
                { id: "members", label: "Members" },
                { id: "billing", label: "Billing" },
              ]}
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
                    <div>
                      {tier ? (
                        <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
                          {seatCount} seat{seatCount === 1 ? "" : "s"} puts you in <strong>{tier.label}</strong> — $
                          {(tier.priceCentsPerSeat / 100).toFixed(0)}/seat/mo, {monthlyQuota} documents/month included.
                          Documents over quota are billed at $0.50 each.
                        </p>
                      ) : (
                        <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
                          Business pricing starts at 2 seats. Invite a teammate to unlock a plan, or contact us for solo pricing.
                        </p>
                      )}
                      <SubscribeButtons orgId={org.id} />
                    </div>
                  ) : (
                    <div>
                      <p style={{ marginBottom: 8 }}>
                        Current plan: <strong>{tier?.label || org.planTier}</strong> · {seatCount} seat{seatCount === 1 ? "" : "s"}
                      </p>
                      {usage && (
                        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                          This month: {usage.monthCount}/{monthlyQuota} documents included
                          {usage.pendingOverageCents > 0 && ` · $${(usage.pendingOverageCents / 100).toFixed(2)} overage pending`}
                        </p>
                      )}
                    </div>
                  ),
                receipts: <KeeperReceipts receipts={serializedReceipts} />,
              }}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
