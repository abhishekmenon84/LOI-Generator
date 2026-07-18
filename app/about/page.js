import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "About — LOI Builder",
  description: "What LOI Builder is and who built it.",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>About LOI Builder</h1>
        <p>
          LOI Builder is a free, modern tool for generating non-binding Letters of Intent for
          combined business and real estate acquisitions. It handles the parts that are tedious
          to write by hand — itemized purchase-price allocation with calculated totals, dollars-in-words
          conversion, and consistent legal structure — so you can produce a polished, professional
          document in minutes instead of starting from a blank page.
        </p>
        <p>
          There&apos;s no account, no subscription, and no signup wall. Fill out the form, preview
          the document live, and export straight to Word, PDF, or Google Doc.
        </p>
        <p>
          <strong>Created by Abhishek Menon.</strong>
        </p>
        <a className="marketing-cta-button" href="/app">Start Building</a>
      </main>
      <SiteFooter />
    </>
  );
}
