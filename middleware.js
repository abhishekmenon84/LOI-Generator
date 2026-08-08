import { auth } from "./lib/auth";
import { NextResponse } from "next/server";

const APP_HOST = "app.ledgerlot.ca";
const MARKETING_HOST = "ledgerlot.ca";

const PROTECTED_PREFIXES = ["/app", "/dashboard", "/documents", "/contacts", "/inbox", "/templates", "/settings", "/keeper", "/ledgerboard"];
// Everything that belongs on the app subdomain: the protected product
// surfaces above, plus /login (its own redirect target), /admin, and the
// two pages an external counterparty reaches with no account at all --
// /sign/[token] (click an emailed link to sign) and /verify/[verifyCode]
// (check a document's authenticity). "app.ledgerlot.ca = every product
// surface, including ones non-users interact with" is the one rule this
// keeps to, so every link this app builds only ever needs NEXT_PUBLIC_APP_URL.
const APP_ONLY_PREFIXES = [...PROTECTED_PREFIXES, "/login", "/admin", "/sign", "/verify"];

function matchesPrefix(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("host") || "";

  // Host-based routing only ever fires for the two real production
  // hostnames -- localhost and Vercel preview deployments (*.vercel.app)
  // pass straight through untouched, so local dev and PR previews keep
  // serving every route from one host exactly like before this split.
  if (host === MARKETING_HOST || host === `www.${MARKETING_HOST}`) {
    if (pathname !== "/" && matchesPrefix(pathname, APP_ONLY_PREFIXES)) {
      // Keeps old bookmarks/shared links (e.g. https://ledgerlot.ca/ledgerboard/...)
      // working instead of 404ing once the app moves to its own subdomain.
      return NextResponse.redirect(new URL(`https://${APP_HOST}${pathname}${search}`, req.url), 308);
    }
  } else if (host === APP_HOST) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", req.url), 307);
    }
    if (!matchesPrefix(pathname, APP_ONLY_PREFIXES)) {
      // A marketing-only path hit directly on the app subdomain (e.g. an
      // old link to a pricing/legal page) -- send it back to the
      // marketing host rather than 404ing or serving it from the wrong domain.
      return NextResponse.redirect(new URL(`https://${MARKETING_HOST}${pathname}${search}`, req.url), 308);
    }
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

// Runs on every path except API routes, Next internals, and files with an
// extension (images, etc.) -- widened from the old protected-paths-only
// matcher because the host-based redirects above need to see marketing
// paths too, not just the protected ones.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
