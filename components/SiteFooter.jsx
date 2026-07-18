import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-disclaimer">
        LOI Builder generates non-binding letters of intent and does not provide legal advice.{" "}
        <Link href="/legal">See Terms &amp; Disclaimer</Link>.
      </p>
      <div className="site-footer-links">
        <Link href="/changelog">Changelog</Link>
        <span aria-hidden="true">·</span>
        <Link href="/support">Support</Link>
        <span aria-hidden="true">·</span>
        <Link href="/legal">Legal</Link>
      </div>
      <p className="site-footer-copyright">© {new Date().getFullYear()} LOI Builder. Created by Abhishek Menon.</p>
    </footer>
  );
}
