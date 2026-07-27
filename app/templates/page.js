import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { listUserOrgs } from "../../lib/orgAccess";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Templates — Ledgerlot",
};

// Lists the org's FormTemplates (the universal PDF form framework's own
// template type -- distinct from the older CustomTemplate system used by
// KeeperTemplates.jsx). Server component, matching the established
// dashboard/page.js pattern of querying Prisma directly rather than
// round-tripping through the GET /api/templates route from a client
// component.
export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userOrgs = await listUserOrgs(session.user.id);
  const orgIds = userOrgs.map((o) => o.orgId);

  const templates = orgIds.length > 0
    ? await prisma.formTemplate.findMany({
        where: { orgId: { in: orgIds } },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { fields: true } } },
      })
    : [];

  return (
    <>
      <SiteHeader isLoggedIn={true} />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ margin: 0 }}>Templates</h1>
          <Link href="/templates/new" className="marketing-cta-button">
            + New template
          </Link>
        </div>

        {templates.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No templates yet. Create one to get started.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {templates.map((t) => (
              <Link
                key={t.id}
                href={`/templates/${t.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "inherit",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 650 }}>{t.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {t.pageCount} page{t.pageCount === 1 ? "" : "s"} · {t._count.fields} field{t._count.fields === 1 ? "" : "s"}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.sourceTier}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
