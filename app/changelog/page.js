import { auth } from "../../lib/auth";
import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

export const metadata = {
  title: "Changelog — LOI Builder",
  description: "A running log of what's shipped in LOI Builder.",
};

const ENTRIES = [
  {
    version: "1.0.0",
    date: "2026-07-18",
    notes: [
      "Initial release: combined business + real estate Letter of Intent generator.",
      "Live document preview with itemized purchase-price allocation and dollars-in-words.",
      "Export to Word, PDF, and Google Doc.",
      "Dark, light, and dusk themes.",
    ],
  },
];

export default async function ChangelogPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} />
      <main className="marketing-page">
        <h1>Changelog</h1>
        {ENTRIES.map((entry) => (
          <div key={entry.version}>
            <h2>v{entry.version} — {entry.date}</h2>
            <ul>
              {entry.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
