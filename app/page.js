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
      </main>
      <SiteFooter />
    </>
  );
}
