import { auth } from "../../lib/auth";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Compare — Ledgerlot vs. dotloop & DocuSign",
  description: "How Ledgerlot compares to dotloop and DocuSign for drafting and e-signing real estate deals.",
};

const ROWS = [
  {
    label: "Drafts a Letter of Intent / lease from scratch",
    ledgerlot: "Yes — guided LOI, commercial & residential lease builders",
    dotloop: "No — forms library only, no drafting engine",
    docusign: "No — upload a finished PDF only",
  },
  {
    label: "Custom PDF + your own template, field-mapped",
    ledgerlot: "Yes — drag-and-drop anchors, auto-detected AcroForm fields",
    dotloop: "Partial — template library, limited custom upload",
    docusign: "Yes — tagging UI, steeper learning curve",
  },
  {
    label: "Sequential / conditional signer order",
    ledgerlot: "Yes, native",
    dotloop: "No",
    docusign: "Yes, add-on tier",
  },
  {
    label: "Signed-copy audit trail + tamper-evident hash",
    ledgerlot: "Yes — PIPEDA-aware, redacted UI vs. full export split",
    dotloop: "Partial — basic activity log",
    docusign: "Yes — Certificate of Completion",
  },
  {
    label: "Deal pipeline (Kanban stages, tasks, comments)",
    ledgerlot: "Yes, built in",
    dotloop: "Yes, its core strength",
    docusign: "No — signature tool only",
  },
  {
    label: "API + webhooks for CRM automation",
    ledgerlot: "Yes — included, no add-on",
    dotloop: "No public API",
    docusign: "Partial — enterprise plans only",
  },
  {
    label: "Per-document / per-envelope fees",
    ledgerlot: "None — flat seat pricing, generous monthly quota",
    dotloop: "Yes, per-loop overages",
    docusign: "Yes, per-envelope past plan limit",
  },
  {
    label: "Solo agent / personal use tier",
    ledgerlot: "Pay-per-document, no monthly minimum",
    dotloop: "Partial — individual plan, still monthly",
    docusign: "Partial — personal plan, capped envelopes",
  },
];

const FEATURES = [
  { title: "LOI & lease drafting engine", body: "Guided forms for purchase LOIs, commercial leases, and residential leases (NB-aware) — a live preview builds the document as you type." },
  { title: "Any PDF becomes fillable", body: "Upload your brokerage's own dual-agency form, lease addendum, or disclosure — anchor the fields once, reuse it as a template for every future deal." },
  { title: "Sequential e-signature", body: "Buyer signs, then seller is unlocked, then the brokerage — enforced automatically, with decline/expiry handling and reminder emails built in." },
  { title: "Deal-level collaboration", body: "Tasks, threaded comments, and a unified activity feed live on the folder itself — no separate project-management tool for closing-date follow-ups." },
  { title: "API & webhooks, included", body: "Push a new folder from your CRM, or get notified the instant a document is fully signed — no enterprise upsell tier required." },
  { title: "Granular, document-level sharing", body: "Give a lender view-only access to one financing document without exposing the rest of the deal folder — a scope neither competitor offers." },
];

export default async function ComparePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} />
      <main className="marketing-page marketing-page-wide">
        <h1>Ledgerlot vs. the field</h1>
        <p>
          dotloop drafts and files. DocuSign signs. Neither drafts a Letter of Intent, prices a
          deal by seat instead of by envelope, or gives a solo agent business-grade tooling on
          day one. Ledgerlot does all three — at less than half the per-seat cost of either.
        </p>

        <div className="compare-table-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th className="compare-table-hl">Ledgerlot</th>
                <th>dotloop</th>
                <th>DocuSign eSignature</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  <td className="compare-table-hl">{row.ledgerlot}</td>
                  <td>{row.dotloop}</td>
                  <td>{row.docusign}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>What you get that they don&apos;t bundle</h2>
        <div className="home-features-grid">
          {FEATURES.map((f) => (
            <div className="home-feature-card" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>

        <p style={{ marginTop: 32, fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Competitive figures reflect publicly listed dotloop/DocuSign pricing and features at
          time of writing — confirm current rates directly with those vendors.
        </p>

        <a className="marketing-cta-button" href={isLoggedIn ? "/dashboard" : "/login"} style={{ marginTop: 8 }}>
          {isLoggedIn ? "Go to Dashboard →" : "Start Building →"}
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
