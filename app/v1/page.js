import { auth } from "../../lib/auth";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Version 1 — Ledgerlot",
  description: "The current feature set of Ledgerlot.",
};

const FEATURES = [
  "Guided document builders for a combined business + real estate purchase LOI, a commercial lease LOI, and a New Brunswick residential lease — live preview as you fill out the form.",
  "Upload any of your own PDF forms and anchor its fields once — it becomes a reusable template for every future deal, with signature/date/text fields auto-detected on real AcroForms.",
  "Sequential e-signature with enforced signer order, decline/expiry handling, reminder emails, and a tamper-evident, hash-verified audit trail.",
  "Folder-based deal pipeline with stages, tasks, threaded comments, and a unified activity feed.",
  "Granular sharing — grant access to a whole deal folder, or to just one document within it.",
  "Business accounts get org-wide branding on outgoing emails, an included REST API, and webhooks for CRM/automation integrations.",
  "Sign in with an emailed magic link, or set a password for faster returning sign-in — your choice, and the link always keeps working either way.",
  "Configurable document retention: 30 days fixed for personal accounts, 1–7 years (business-configurable) for business accounts.",
];

export default async function V1Page() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} />
      <main className="marketing-page">
        <h1>Version 1</h1>
        <p>
          The current version of Ledgerlot covers the full path from drafting a document to
          getting it signed and organized — not just the first draft.
        </p>
        <ul>
          {FEATURES.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <a className="marketing-cta-button" href={isLoggedIn ? "/dashboard" : "/login"}>
          {isLoggedIn ? "Go to Dashboard →" : "Try It Now →"}
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
