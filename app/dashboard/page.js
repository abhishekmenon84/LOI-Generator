import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { listAccessibleDeals, hasBusinessOrgMembership } from "../../lib/orgAccess";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import DealList from "../../components/DealList";
import KanbanDashboard from "../../components/KanbanDashboard";

export const metadata = {
  title: "Dashboard — LOI Builder",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isBusiness = await hasBusinessOrgMembership(session.user.id);
  const deals = await listAccessibleDeals(session.user.id);
  const serializedDeals = deals.map((d) => ({
    id: d.id,
    name: d.name,
    documentType: d.documentType,
    stage: d.stage,
    updatedAt: d.updatedAt.toISOString(),
    isShared: d._accessReason === "share",
    writeAccess: d._writeAccess,
  }));

  if (isBusiness) {
    return (
      <>
        <SiteHeader isLoggedIn={true} />
        <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 28px" }}>
          <h1 style={{ marginBottom: 4 }}>Deal Pipeline</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>Signed in as {session.user.email}.</p>
          <KanbanDashboard initialDeals={serializedDeals} />
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader isLoggedIn={true} />
      <main className="marketing-page">
        <h1>Your Deals</h1>
        <p>Signed in as {session.user.email}.</p>
        <DealList initialDeals={serializedDeals} />
      </main>
      <SiteFooter />
    </>
  );
}
