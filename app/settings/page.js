import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { getPersonalOrgId, getPrimaryOrgForShell } from "../../lib/orgAccess";
import AppShell from "../../components/AppShell";
import PersonalProfileSettings from "../../components/PersonalProfileSettings";
import PasswordSettings from "../../components/PasswordSettings";
import { PERSONAL_DOC_PRICE_CENTS, PERSONAL_DAILY_CAP, PERSONAL_MONTHLY_CAP } from "../../lib/orgBilling";

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
  const usage = orgId ? await prisma.usageCounter.findUnique({ where: { orgId } }) : null;
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  const businessMembership = await prisma.membership.findFirst({
    where: { userId: session.user.id, org: { isPersonal: false } },
    include: { org: true },
  });
  const businessOrg = businessMembership?.org || null;
  const shellOrg = await getPrimaryOrgForShell(session.user.id);

  return (
    <AppShell org={shellOrg} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
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

        <h2 style={{ margin: "28px 0 8px" }}>Password</h2>
        <PasswordSettings hasPassword={!!currentUser?.passwordHash} />

        <h2 style={{ marginBottom: 8 }}>Change tier</h2>

        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Personal</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>
          Pay-as-you-go — <strong>${(PERSONAL_DOC_PRICE_CENTS / 100).toFixed(2)} per document</strong>, no subscription. Billed
          monthly for whatever you use, up to {PERSONAL_DAILY_CAP} documents/day and {PERSONAL_MONTHLY_CAP} documents/month.
        </p>
        {usage && (
          <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 13 }}>
            Used today: {usage.dayCount}/{PERSONAL_DAILY_CAP} · This month: {usage.monthCount}/{PERSONAL_MONTHLY_CAP}
          </p>
        )}

        <h3 style={{ fontSize: 15, margin: "28px 0 4px" }}>Business</h3>
        {businessOrg ? (
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            <strong>{businessOrg.name}</strong> · {businessOrg.planTier === "trial" ? "Trial" : businessOrg.planTier} — manage seats and billing in{" "}
            <Link href="/keeper" style={{ color: "var(--accent-light)" }}>Keeper</Link>.
          </p>
        ) : (
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            Manage a team&apos;s deal pipeline with a Business org — pick your team size and start a
            7-day free trial. A card is required to start, but nothing is charged until day 7.{" "}
            <Link href="/pricing" className="marketing-cta-button" style={{ display: "inline-block", marginLeft: 8 }}>
              Start a Business org
            </Link>
          </p>
        )}

        <h2 style={{ margin: "28px 0 8px" }}>Your data</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
          Download a copy of your account profile, folders, documents, and signature history.
        </p>
        <a href="/api/users/me/export" className="marketing-cta-button" style={{ display: "inline-block" }}>
          Export my data
        </a>
      </div>
    </AppShell>
  );
}
