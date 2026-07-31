// Server component wrapper for the template-creation flow (Task 9). Two
// jobs, both previously missing when this file was a plain client
// component (see final-review.md M2/I1):
//
// 1. Auth gate. `middleware.js` only matches /app/:path* and
//    /dashboard/:path*, so a bare "use client" page here had no
//    server-side redirect and this route also prerendered as a static
//    page -- an anonymous visitor saw the full upload UI before hitting a
//    raw "Not authenticated." error from the API. Gating here matches
//    TemplatesPage (app/templates/page.js)'s own redirect-to-/login
//    pattern and forces this to render dynamically per-request.
// 2. Org list for the creation form's org picker. Fetched the same way
//    DealList.jsx/KanbanDashboard.jsx's dashboard wrapper does (see
//    app/dashboard/page.js), so NewTemplateForm can show a picker only
//    when the user belongs to more than one org.
import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { listUserOrgs } from "../../../lib/orgAccess";
import AppShell from "../../../components/AppShell";
import NewTemplateForm from "../../../components/NewTemplateForm";

export const metadata = {
  title: "New template — Ledgerlot",
};

export default async function NewTemplatePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userOrgs = await listUserOrgs(session.user.id);

  return (
    <AppShell org={null} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <NewTemplateForm userOrgs={userOrgs} />
    </AppShell>
  );
}
