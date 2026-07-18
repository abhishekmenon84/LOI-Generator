import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Donate — LOI Builder",
  description: "Support LOI Builder and help keep it free.",
};

export default function DonatePage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Support LOI Builder</h1>
        <p>
          LOI Builder is free to use, with no account and no subscription required. If it saved
          you time on a deal, consider chipping in to help cover hosting costs and fund new
          features like e-signature and additional document templates.
        </p>
        {/* Placeholder link — replace with a real payment provider URL (e.g. Buy Me a Coffee, Stripe) */}
        <a className="marketing-cta-button" href="#" rel="noopener noreferrer">
          Donate
        </a>
      </main>
      <SiteFooter />
    </>
  );
}
