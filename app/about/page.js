import { redirect } from "next/navigation";

// Retired -- folded into the refreshed homepage (the "Product" tab) rather
// than kept as a near-duplicate page. Redirect (not a 404) so any existing
// bookmarks/links keep working.
export default function AboutPage() {
  redirect("/");
}
