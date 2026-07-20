import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";

export const metadata = {
  title: "Check your email — LOI Builder",
};

export default function CheckEmailPage() {
  return (
    <>
      <SiteHeader />
      <main className="marketing-page">
        <h1>Check your email</h1>
        <p>
          We&apos;ve sent you a sign-in link. Click it to finish signing in — the link expires
          in 10 minutes. You can close this tab.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
