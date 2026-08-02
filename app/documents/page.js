import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { getPrimaryOrgForShell } from "../../lib/orgAccess";
import { listAccessibleFolders } from "../../lib/folderAccess";
import AppShell from "../../components/AppShell";

export const metadata = {
  title: "Documents — Ledgerlot",
};

const TYPE_LABELS = {
  purchase_loi: "Purchase LOI",
  commercial_lease: "Commercial Lease",
  residential_lease: "Residential Lease",
  custom_template: "Custom template",
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

// A flat list of every Ledger (document) across every Folder the user can
// access, unlike Dashboard which lists Folders themselves -- distinct
// sidebar destinations for "which deal/ledger" vs "which document inside
// it". Not paginated: this app's usage caps (30 personal docs/month,
// seat-bound business quotas -- see lib/orgBilling.js) keep a single
// user's document count small enough that a flat unpaginated list is fine.
export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const accessibleFolders = await listAccessibleFolders(session.user.id, {});
  const folderIds = accessibleFolders.map((f) => f.id);
  const folderNameById = new Map(accessibleFolders.map((f) => [f.id, f.name]));

  const ledgers = folderIds.length > 0
    ? await prisma.ledger.findMany({
        where: { folderId: { in: folderIds } },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const primaryOrg = await getPrimaryOrgForShell(session.user.id);

  return (
    <AppShell org={primaryOrg} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px" }}>
        <h1 style={{ marginBottom: 24 }}>Documents</h1>

        {ledgers.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No documents yet — create a ledger from the Dashboard to get started.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ledgers.map((ledger) => (
              <Link
                key={ledger.id}
                href={`/ledgerboard/folder/${ledger.folderId}`}
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
                  <div style={{ fontWeight: 650 }}>{ledger.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    In {folderNameById.get(ledger.folderId) || "Unknown folder"} · Edited {relativeTime(ledger.updatedAt)}
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
                  {TYPE_LABELS[ledger.documentType] || ledger.documentType}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
