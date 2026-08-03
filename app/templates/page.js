import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { listUserOrgs, getPrimaryOrgForShell } from "../../lib/orgAccess";
import AppShell from "../../components/AppShell";
import TemplateRow from "../../components/TemplateRow";
import UseFormTemplateButton from "../../components/UseFormTemplateButton";
import DuplicateTemplateButton from "../../components/DuplicateTemplateButton";
import { RESIDENTIAL_LEASE_SUPPORTED_PROVINCES, provinceName } from "../../lib/provinces";

export const metadata = {
  title: "Templates — Ledgerlot",
};

// The app's 3 real built-in document types (see app/api/ledgers/route.js's
// VALID_DOC_TYPES) -- these always exist for every user and start a Ledger
// directly from /dashboard, unlike FormTemplates below. Shown here with a
// fixed "Default" source label so this page reflects everything a user
// could pick from, not just their own uploads.
const BUILT_IN_TEMPLATES = [
  { value: "purchase_loi", label: "Business + Real Estate Purchase LOI" },
  { value: "commercial_lease", label: "Commercial Lease LOI" },
  { value: "residential_lease", label: "Residential Lease (New Brunswick)" },
];

// Lists the app's built-in templates plus the org's FormTemplates (the
// universal PDF form framework's own template type -- distinct from the
// older CustomTemplate system used by KeeperTemplates.jsx). Each
// FormTemplate is labeled with who added it: "Personal" for a template
// uploaded under the user's personal org, or the uploader's name/"Org
// admin" for one uploaded under a business org -- per-org membership role
// already exists (Membership.role), so no schema change was needed for
// this beyond what FormTemplate.createdByUserId already tracked.
export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userOrgs = await listUserOrgs(session.user.id);
  const orgIds = userOrgs.map((o) => o.orgId);
  const orgById = new Map(userOrgs.map((o) => [o.orgId, o]));

  const templates = orgIds.length > 0
    ? await prisma.formTemplate.findMany({
        where: { orgId: { in: orgIds } },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { fields: true } }, createdBy: { select: { name: true, email: true } } },
      })
    : [];

  // CustomTemplate is a second, older template system (KeeperTemplates.jsx,
  // and the auto-promotion in PATCH /api/folders/files/[fileId] when a
  // user places anchors on an uploaded PDF). Unlike FormTemplate (shared
  // org-wide), a CustomTemplate is private to whoever created it -- scoped
  // to the current user here, matching the same restriction enforced
  // server-side by GET/PATCH/DELETE /api/orgs/[id]/templates[/...].
  const customTemplates = orgIds.length > 0
    ? await prisma.customTemplate.findMany({
        where: { orgId: { in: orgIds }, createdByUserId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { anchors: true } }, createdBy: { select: { name: true, email: true } } },
        // pdfUrl is a plain scalar field (already included by default), kept
        // here as an explicit reminder that AddTemplateToFolderModal's PDF
        // preview depends on it -- do not narrow this query with a `select`
        // that would drop it.
      })
    : [];

  const allCreatorUserIds = [...templates.map((t) => t.createdByUserId), ...customTemplates.map((t) => t.createdByUserId)];
  const uploaderMemberships = allCreatorUserIds.length > 0
    ? await prisma.membership.findMany({
        where: { userId: { in: allCreatorUserIds }, orgId: { in: orgIds } },
        select: { userId: true, orgId: true, role: true },
      })
    : [];
  const roleByUserOrg = new Map(uploaderMemberships.map((m) => [`${m.userId}:${m.orgId}`, m.role]));

  function sourceLabelFor(template) {
    const org = orgById.get(template.orgId);
    if (org?.isPersonal) return "Personal";
    const role = roleByUserOrg.get(`${template.createdByUserId}:${template.orgId}`);
    if (role === "admin") return "Org admin";
    return template.createdBy?.name || template.createdBy?.email || "Org member";
  }

  const primaryOrg = await getPrimaryOrgForShell(session.user.id);

  return (
    <AppShell org={primaryOrg} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ margin: 0 }}>Templates</h1>
          <Link href="/templates/new" className="marketing-cta-button">
            + New template
          </Link>
        </div>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Default</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {BUILT_IN_TEMPLATES.map((t) => {
            // Residential Lease is New Brunswick's real statutory Form 6 --
            // only NB has a verified, real per-province lease implemented
            // (see lib/provinces.js). This is purely informational (never
            // blocks selecting it -- any user can still use the NB form),
            // shown only when the org's own province is known and differs.
            const provinceMismatch = t.value === "residential_lease"
              && primaryOrg?.province
              && !RESIDENTIAL_LEASE_SUPPORTED_PROVINCES.has(primaryOrg.province);
            return (
              <TemplateRow key={t.value} template={t} kind="built-in">
                <div>
                  <div style={{ fontWeight: 650 }}>{t.label}</div>
                  {provinceMismatch && (
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                      Not yet available as a statutory form for {provinceName(primaryOrg.province)} -- this generates New Brunswick&apos;s form regardless of your org&apos;s province.
                    </div>
                  )}
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
                  Default
                </span>
              </TemplateRow>
            );
          })}
        </div>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Uploaded</h2>
        {templates.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No uploaded templates yet. Create one to get started.</p>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                    {sourceLabelFor(t)}
                  </span>
                  <DuplicateTemplateButton orgId={t.orgId} templateId={t.id} />
                  <UseFormTemplateButton template={{ id: t.id, name: t.name, pdfUrl: t.pdfUrl, pageCount: t.pageCount, fieldCount: t._count.fields }} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {customTemplates.length > 0 && (
          <>
            <h2 style={{ fontSize: 15, margin: "28px 0 10px" }}>From uploaded files</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {customTemplates.map((t) => (
                <TemplateRow
                  key={t.id}
                  kind="custom_template"
                  template={{ id: t.id, name: t.name, pdfUrl: t.pdfUrl, pageCount: t.pageCount, fieldCount: t._count.anchors }}
                >
                  <div>
                    <div style={{ fontWeight: 650 }}>{t.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                      {t.pageCount} page{t.pageCount === 1 ? "" : "s"} · {t._count.anchors} field{t._count.anchors === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                      {sourceLabelFor(t)}
                    </span>
                    <DuplicateTemplateButton orgId={t.orgId} templateId={t.id} />
                  </div>
                </TemplateRow>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
