import { auth } from "./lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const PROTECTED_PREFIXES = ["/app", "/dashboard", "/documents", "/contacts", "/inbox", "/templates", "/settings", "/keeper", "/ledgerboard"];
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/app/:path*", "/dashboard/:path*", "/documents/:path*", "/contacts/:path*", "/inbox/:path*", "/templates/:path*", "/settings/:path*", "/keeper/:path*", "/ledgerboard/:path*"],
};
