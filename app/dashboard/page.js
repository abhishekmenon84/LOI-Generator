import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "../../lib/auth";
import { getPrimaryOrgForShell, hasBusinessOrgMembership } from "../../lib/orgAccess";
import { listAccessibleFolders } from "../../lib/folderAccess";
import { retentionYearsToDays, getTierForSeatCount } from "../../lib/pricingTiers";
import { createOrgSubscriptionCheckout } from "../../lib/orgBilling";
import { prisma } from "../../lib/prisma";
import AppShell from "../../components/AppShell";
import DashboardGreeting from "../../components/DashboardGreeting";
import SetPasswordBanner from "../../components/SetPasswordBanner";

export const metadata = {
  title: "Dashboard — Ledgerlot",
};

function relativeTime(date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const AUDIT_ACTION_LABELS = {
  created: "was created",
  archived: "was archived",
  trashed: "was moved to trash",
  restored: "was restored",
  moved: "was moved",
  linked_child: "had a linked document added",
  unlinked_child: "had a linked document removed",
};

// A lightweight greeting + at-a-glance summary -- NOT the folder/ledger
// pipeline itself (that lives at /documents, see app/documents/page.js).
// "Recent activity" only surfaces what's genuinely tracked today
// (FolderAuditEvent lifecycle events + Ledger.updatedAt) rather than
// fabricating per-field edit history or view-tracking, neither of which
// exist in this codebase.
export default async function DashboardPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Completes the "Business" choice made on /login: that choice can only be
  // threaded through as a callbackUrl query param (see app/login/page.js's
  // comment), since the actual click-through request that lands here is a
  // separate request from the original form submission, with no session of
  // its own to stash a pending choice in. Idempotent -- only fires if the
  // user doesn't already have a business org -- so refreshing this URL or
  // an already-business user landing here again is a no-op.
  if (searchParams?.newAccountType === "business" && !(await hasBusinessOrgMembership(session.user.id))) {
    const retentionYears = Number(searchParams?.retentionYears) || 1;
    const businessOrg = await prisma.organization.create({
      data: {
        name: searchParams?.businessName?.trim() || "My Business",
        accountType: "company",
        isPersonal: false,
        planTier: "trial",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ownerUserId: session.user.id,
        province: searchParams?.province || null,
        businessName: searchParams?.businessName?.trim() || null,
        businessPhone: searchParams?.businessPhone?.trim() || null,
        businessAddress: searchParams?.businessAddress?.trim() || null,
        retentionYears,
        retentionDays: retentionYearsToDays(retentionYears),
        memberships: { create: { userId: session.user.id, role: "admin" } },
      },
    });

    // Collect a card immediately, as part of signup, rather than deferring
    // it to a later "Subscribe" click in Settings -- 7-day Stripe-native
    // trial (see lib/orgBilling.js's createOrgSubscriptionCheckout): the
    // card is validated and stored now, nothing is charged until day 7,
    // and each period after that bills in advance automatically. The org
    // row above already exists in the local no-card "trial" planTier as a
    // fallback -- if Stripe isn't configured, or the user cancels
    // Stripe's hosted checkout page, they land back in that same usable
    // (if unbilled) state rather than a broken half-signed-up org, and can
    // complete checkout later from Settings.
    const seatCount = Math.max(1, Number(searchParams?.seats) || 1);
    const tier = getTierForSeatCount(seatCount);
    // next/navigation's redirect() works by throwing internally, so the
    // call itself must never sit inside a try/catch that's also guarding
    // against real errors -- only the Stripe API call is wrapped here;
    // the resulting URL is redirected to afterward, unconditionally.
    let checkoutUrl = null;
    if (tier && process.env.STRIPE_SECRET_KEY) {
      const host = headers().get("host");
      const protocol = host?.startsWith("localhost") ? "http" : "https";
      const origin = `${protocol}://${host}`;
      try {
        const checkoutSession = await createOrgSubscriptionCheckout({
          org: businessOrg,
          tier,
          seatCount,
          trialDays: 7,
          successUrl: `${origin}/dashboard/verify-business?orgId=${businessOrg.id}`,
          cancelUrl: `${origin}/dashboard/verify-business?orgId=${businessOrg.id}`,
        });
        checkoutUrl = checkoutSession.url;
      } catch (err) {
        console.error("[dashboard] signup-time Stripe checkout failed, continuing with no-card trial:", err);
      }
    }

    redirect(checkoutUrl || `/dashboard/verify-business?orgId=${businessOrg.id}`);
  }

  const primaryOrg = await getPrimaryOrgForShell(session.user.id);
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });

  // listAccessibleFolders with no options already excludes archived
  // folders -- everything returned here is active.
  const activeFolders = await listAccessibleFolders(session.user.id, {});
  const folderIds = activeFolders.map((f) => f.id);

  const stageCounts = new Map();
  for (const f of activeFolders) {
    stageCounts.set(f.stage, (stageCounts.get(f.stage) || 0) + 1);
  }

  const upcomingTasks = folderIds.length > 0
    ? await prisma.task.findMany({
        where: { folderId: { in: folderIds }, completed: false },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: { folder: { select: { name: true, id: true } } },
      })
    : [];

  const [recentAuditEvents, recentLedgers] = folderIds.length > 0
    ? await Promise.all([
        prisma.folderAuditEvent.findMany({
          where: { folderId: { in: folderIds } },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { folder: { select: { name: true } } },
        }),
        prisma.ledger.findMany({
          where: { folderId: { in: folderIds } },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, name: true, folderId: true, updatedAt: true },
        }),
      ])
    : [[], []];

  const actorIds = [...new Set(recentAuditEvents.map((e) => e.actorUserId))];
  const actors = actorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const actorById = new Map(actors.map((u) => [u.id, u]));

  const activityItems = [
    ...recentAuditEvents.map((e) => {
      const actor = actorById.get(e.actorUserId);
      return {
        at: e.createdAt,
        text: `${actor?.name || actor?.email || "Someone"} — ${e.folder?.name || "A folder"} ${AUDIT_ACTION_LABELS[e.action] || e.action}`,
      };
    }),
    ...recentLedgers.map((l) => ({
      at: l.updatedAt,
      text: `${l.name} was last updated`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return (
    <AppShell org={primaryOrg} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px" }}>
        <DashboardGreeting style={{ marginBottom: 4 }} />
        <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>Signed in as {session.user.email}.</p>
        <SetPasswordBanner hasPassword={!!currentUser?.passwordHash} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 32 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{activeFolders.length}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Active ledgers</div>
          </div>
          {["draft", "active", "pending", "closed"].map((stage) => (
            <div key={stage} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{stageCounts.get(stage) || 0}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", textTransform: "capitalize" }}>{stage}</div>
            </div>
          ))}
        </div>

        {upcomingTasks.length > 0 && (
          <>
            <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>Upcoming deadlines</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
              {upcomingTasks.map((t) => {
                const overdue = t.dueDate && new Date(t.dueDate) < new Date();
                return (
                  <Link
                    key={t.id}
                    href={`/ledgerboard/folder/${t.folder.id}`}
                    style={{ display: "block", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, textDecoration: "none", color: "inherit" }}
                  >
                    <strong>{t.title}</strong> — {t.folder.name}
                    {t.dueDate && (
                      <span style={{ color: overdue ? "oklch(50% 0.17 25)" : "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>
                        Due {new Date(t.dueDate).toLocaleDateString()}{overdue ? " (overdue)" : ""}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>Recent activity</h2>
          <Link href="/documents" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-light)", textDecoration: "none" }}>
            Go to Documents →
          </Link>
        </div>

        {activityItems.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No activity yet — create a ledger from Documents to get started.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activityItems.map((item, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5 }}>
                {item.text}
                <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>{relativeTime(item.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
