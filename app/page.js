import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <div className="home-hero">
          <h1>The fastest way to draft a combined business + real estate Letter of Intent.</h1>
          <p>
            Trusted structure for brokers, buyers, and sellers. Build a professional,
            non-binding LOI in minutes — itemized price allocation, dollars-in-words, and
            export-ready formatting handled for you.
          </p>
          <a className="marketing-cta-button" href="/app">Start Building →</a>
          <div className="home-feature-strip">
            <span>No signup</span>
            <span>·</span>
            <span>No subscription</span>
            <span>·</span>
            <span>Export to Word, PDF, or Google Doc</span>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
