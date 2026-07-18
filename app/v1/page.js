import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "What's in v1 — LOI Builder",
  description: "The current feature set of LOI Builder.",
};

const FEATURES = [
  "Combine real estate and business-operations deals in a single document — no need to draft two separate letters for a mixed acquisition.",
  "Live, itemized purchase-price allocation with calculated totals and dollars-in-words, updated in real time as you fill out the form.",
  "True pay-per-use pricing — no account, no subscription required.",
  "Built-in e-signature flow so both parties can sign the LOI immediately after it's generated.",
  "Email delivery — send the finished document directly to buyer and seller instead of just downloading it.",
  "Save and resume a draft via a shareable link, no login required — useful since these deals often involve back-and-forth over several days.",
  "Multiple pricing tiers, from a single export up to a bundle that includes a matching NDA or Purchase & Sale Agreement template.",
  "Basic usage analytics to track exports and understand how the tool is being used.",
  "Additional guided templates beyond the combo business+real estate flow — residential real estate, commercial lease, franchise acquisition, employment offer, and asset-only purchase.",
  "State and jurisdiction-aware clauses that flag or auto-include language relevant to specific US states or Canadian provinces.",
  "A white-label version for real estate and business brokers who generate many LOIs, with brokerage branding on the letterhead.",
  "Version history and redline comparison, so regenerating a document after a negotiation round shows what changed against the prior version.",
];

export default function V1Page() {
  return (
    <>
      <SiteHeader />
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
