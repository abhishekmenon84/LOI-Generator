import { auth } from "../../lib/auth";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";
import PublicPricingSlider from "../../components/PublicPricingSlider";
import { PERSONAL_DOC_PRICE_CENTS, PERSONAL_DAILY_CAP, PERSONAL_MONTHLY_CAP } from "../../lib/orgBilling";

export const metadata = {
  title: "Pricing — Ledgerlot",
  description: "Personal pay-per-document pricing, and Business per-seat pricing with a live team-size slider.",
};

export default async function PricingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} />
      <main className="marketing-page marketing-page-wide">
        <h1>Pricing</h1>
        <p>No punitive middle tier, no forced annual contract, no per-envelope surprise fees.</p>

        <div className="pricing-columns">
          <div className="pricing-slider-card pricing-personal-card">
            <h2 style={{ marginTop: 0 }}>Personal</h2>
            <p>For solo agents building their own deals — no subscription, no monthly minimum.</p>
            <div className="pricing-slider-figures">
              <div>
                <span className="pricing-slider-amount">${(PERSONAL_DOC_PRICE_CENTS / 100).toFixed(2)}</span>
                <span className="pricing-slider-unit">/document</span>
              </div>
            </div>
            <p className="pricing-slider-note">
              Up to {PERSONAL_DAILY_CAP} documents/day, {PERSONAL_MONTHLY_CAP}/month. Billed monthly
              for whatever you actually use.
            </p>
            <a className="marketing-cta-button" href="/login">
              Start free →
            </a>
          </div>

          <div>
            <h2 style={{ marginTop: 0 }}>Business</h2>
            <p>Drag the slider to your team size — pricing per seat drops as you grow.</p>
            <PublicPricingSlider />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
