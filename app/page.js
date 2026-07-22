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
          <h1>The fastest way to draft a combined business + real estate Letter of Intent.</h1>
          <p>
            Trusted structure for brokers, buyers, and sellers. Build a professional,
            non-binding LOI in minutes — itemized price allocation, dollars-in-words, and
            export-ready formatting handled for you.
          </p>
          <a className="marketing-cta-button" href={isLoggedIn ? "/dashboard" : "/login"}>
            {isLoggedIn ? "Go to Dashboard →" : "Start Building →"}
          </a>
          <div className="home-feature-strip">
            <span>Free account</span>
            <span>·</span>
            <span>Save &amp; resume deals</span>
            <span>·</span>
            <span>Export to Word, PDF, or Google Doc</span>
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
