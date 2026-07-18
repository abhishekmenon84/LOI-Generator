import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "What's coming in v2 — LOI Builder",
  description: "The roadmap for the next version of LOI Builder.",
};

const UPCOMING = [
  {
    title: "Optional attorney review add-on",
    body: "A flat-fee legal review service as a premium upsell after your document is generated — similar in spirit to LegalZoom's model.",
  },
  {
    title: "API access",
    body: "Let other platforms — deal marketplaces, brokerage CRMs, accounting firms — generate LOIs programmatically for a per-call fee.",
  },
  {
    title: "AI-assisted clause suggestions",
    body: "Given the deal type and a few inputs, get suggestions for the risk-protection clauses (environmental, licensing, financing contingencies) typically included for that industry.",
  },
  {
    title: "Full deal-progression suite",
    body: "Extend from a single LOI into \"LOI → Purchase Agreement → Closing Checklist,\" turning the tool into a lightweight deal-management suite rather than a single-document generator.",
  },
];

export default function V2Page() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>What&apos;s coming in v2</h1>
        <p>
          Here&apos;s what&apos;s on the roadmap after v1. None of this is live yet — this page
          exists so you know what to expect next.
        </p>
        {UPCOMING.map((item, i) => (
          <div key={i}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </div>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
