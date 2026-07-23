"use client";

export default function TrialBanner({ org }) {
  if (org.isPersonal || org.planTier !== "trial" || !org.trialEndsAt) return null;

  const daysLeft = Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const expired = daysLeft === 0 && new Date() > new Date(org.trialEndsAt);

  if (expired) {
    return (
      <div className="status-banner status-error" role="alert" style={{ marginBottom: 20 }}>
        ⚠️ Your organization&apos;s 7-day trial has ended. Subscribe below to continue creating, editing, and downloading documents.
      </div>
    );
  }

  return (
    <div className="status-banner" role="status" style={{ marginBottom: 20, background: "var(--accent-subtle)", border: "1px solid var(--accent)" }}>
      🕐 {daysLeft} day{daysLeft === 1 ? "" : "s"} left in your trial. Downloads are watermarked until you subscribe.
    </div>
  );
}
