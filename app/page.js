import { auth } from "../lib/auth";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} />
      <main>
        <div className="home-hero">
          <h1>Draft, share, and sign real estate deals — without leaving one tab.</h1>
          <p>
            Ledgerlot drafts LOIs and leases, collects e-signatures in the right order, and
            keeps every folder's tasks, comments, and audit trail in one place — for solo agents
            and full brokerage teams alike.
          </p>
          <a className="marketing-cta-button" href={isLoggedIn ? "/dashboard" : "/login"}>
            {isLoggedIn ? "Go to Dashboard →" : "Start Building →"}
          </a>
          <div className="home-feature-strip">
            <span>Free personal account</span>
            <span>·</span>
            <span>7-day business trial, no card charged upfront</span>
            <span>·</span>
            <span>Export to Word or PDF</span>
          </div>
        </div>

        <div className="home-features">
          <h2>Everything a deal needs, in one place</h2>
          <div className="home-features-grid">
            <div className="home-feature-card">
              <h3>Draft LOIs &amp; leases</h3>
              <p>Guided forms for purchase LOIs, commercial leases, and New Brunswick residential leases — live preview as you type.</p>
            </div>
            <div className="home-feature-card">
              <h3>Any PDF, made fillable</h3>
              <p>Upload your own brokerage forms and anchor the fields once — reuse them as a template on every future deal.</p>
            </div>
            <div className="home-feature-card">
              <h3>Sequential e-signature</h3>
              <p>Buyer signs, then seller is unlocked, then the brokerage — enforced automatically, with a tamper-evident audit trail.</p>
            </div>
            <div className="home-feature-card">
              <h3>Deal collaboration</h3>
              <p>Tasks, threaded comments, and a unified activity feed live on the folder itself — no separate project tool needed.</p>
            </div>
            <div className="home-feature-card">
              <h3>API &amp; webhooks</h3>
              <p>Push a new folder from your CRM, or get notified the instant a document is fully signed — included, no add-on tier.</p>
            </div>
            <div className="home-feature-card">
              <h3>Granular sharing</h3>
              <p>Grant a lender view-only access to one financing document, without exposing the rest of the deal folder.</p>
            </div>
          </div>
          <div className="home-features-cta">
            <a href="/compare">See how this compares to dotloop &amp; DocuSign →</a>
            <a href="/pricing">View pricing →</a>
          </div>
        </div>

        <div className="home-why-loi">
          <h2>Why start with an LOI instead of going straight to CREA forms?</h2>
          <p className="home-why-loi-intro">
            Standard real estate board forms — like a CREA Agreement of Purchase and Sale —
            are built to be binding. That's exactly right once both sides have actually agreed
            on the deal. It's the wrong tool for getting there.
          </p>
          <div className="home-why-loi-grid">
            <div className="home-why-loi-card">
              <h3>Letter of Intent first</h3>
              <ul>
                <li>Non-binding — either side can walk away while terms are still being worked out</li>
                <li>Built in minutes, no lawyer required to get the first draft in front of the other party</li>
                <li>Gets price, structure, and key terms agreed on paper before anyone pays for a binding contract</li>
                <li>Easy to revise as negotiation moves — no formal amendments needed</li>
              </ul>
            </div>
            <div className="home-why-loi-card home-why-loi-card-alt">
              <h3>Straight to a CREA-style form</h3>
              <ul>
                <li>Binding once signed — walking away can have real legal and financial consequences</li>
                <li>Assumes the deal's terms are already settled, not still being negotiated</li>
                <li>Typically drafted by a lawyer or agent, adding cost and delay before terms are even confirmed</li>
                <li>Right tool once both sides are ready to commit — not before</li>
              </ul>
            </div>
          </div>
          <p className="home-why-loi-footnote">
            Once your LOI's terms are agreed, your lawyer or agent still drafts the binding
            CREA agreement — the LOI just makes sure that's worth doing before you get there.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
