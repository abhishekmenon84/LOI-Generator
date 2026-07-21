import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import DealList from "../../components/DealList";

export const metadata = {
  title: "Dashboard — LOI Builder",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const deals = await prisma.deal.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, documentType: true, updatedAt: true },
  });
  const serializedDeals = deals.map((d) => ({
    id: d.id,
    name: d.name,
    documentType: d.documentType,
    updatedAt: d.updatedAt.toISOString(),
  }));

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
