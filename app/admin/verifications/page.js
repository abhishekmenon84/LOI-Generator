import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { isPlatformAdmin } from "../../../lib/platformAdmin";
import AppShell from "../../../components/AppShell";
import VerificationQueue from "../../../components/VerificationQueue";

export const metadata = {
  title: "Business Verifications — Ledgerlot",
};

// Platform-admin-only (see lib/platformAdmin.js for why this is a
// separate concept from Organization/Membership.role admin) surface for
// reviewing business verification submissions. Not nested under /keeper
// since Keeper is scoped to "your one business org" -- this spans every
// org on the platform.
export default async function AdminVerificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!isPlatformAdmin(session.user.email)) {
    redirect("/dashboard");
  }

  return (
    <AppShell org={null} userInitial={(session.user.email || "?").charAt(0).toUpperCase()}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px" }}>
        <h1>Business Verifications</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          Review business registration documents submitted at signup. Verification is informational only -- it never
          blocks an org from using the product.
        </p>
        <VerificationQueue />
      </div>
    </AppShell>
  );
}
