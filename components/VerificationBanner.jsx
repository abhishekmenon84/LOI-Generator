"use client";

// Persistent, non-blocking banner for a business org's verification
// status -- per product decision, verification NEVER blocks any action
// (no export/create/e-sign gating), it only informs. Self-fetching so it
// can be dropped into AppShell without every page needing to pass org
// verification data down manually.
export default function VerificationBanner({ org }) {
  if (!org || org.isPersonal) return null;
  if (org.verificationStatus === "verified" || org.verificationStatus === "unverified") return null;

  if (org.verificationStatus === "pending") {
    return (
      <div className="status-banner" role="status" style={{ margin: "16px 28px 0", background: "var(--accent-subtle)", border: "1px solid var(--accent)" }}>
        🕐 Your business verification is pending review. This doesn&apos;t affect your ability to use Ledgerlot.
      </div>
    );
  }

  if (org.verificationStatus === "rejected") {
    return (
      <div className="status-banner status-error" role="alert" style={{ margin: "16px 28px 0" }}>
        ⚠️ Your business verification wasn&apos;t approved. You can re-submit from{" "}
        <a href="/keeper" style={{ color: "inherit", textDecoration: "underline" }}>Settings</a>. This doesn&apos;t affect your ability to use Ledgerlot.
      </div>
    );
  }

  return null;
}
