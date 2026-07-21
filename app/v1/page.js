import { auth } from "../../lib/auth";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "What's in v1 — LOI Builder",
  description: "The current feature set of LOI Builder.",
};

const FEATURES = [
  "Combine real estate and business-operations deals in a single document — no need to draft two separate letters for a mixed acquisition.",
  "Live, itemized purchase-price allocation with calculated totals and dollars-in-words, updated in real time as you fill out the form.",
  "Free account with email-only sign-in — no password to remember.",
  "Deals save automatically and resume from any device via your dashboard.",
  "Additional guided templates beyond the combo business+real estate flow — residential real estate, commercial lease, franchise acquisition, employment offer, and asset-only purchase.",
  "State and jurisdiction-aware clauses that flag or auto-include language relevant to specific US states or Canadian provinces.",
];

export default async function V1Page() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} />
      <main className="marketing-page">
        <h1>What&apos;s in v1</h1>
        <p>
          The current version of LOI Builder focuses on getting a professional, combined
          business-and-real-estate Letter of Intent into your hands as fast as possible.
        </p>
        <ul>
          {FEATURES.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <a className="marketing-cta-button" href="/app">Try It Now</a>
      </main>
      <SiteFooter />
    </>
  );
}
