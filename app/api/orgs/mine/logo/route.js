import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { listUserOrgs } from "../../../../../lib/orgAccess";

// Returns the logo for the caller's active business org, so Navbar/SiteHeader
// can self-fetch it on mount without every page that renders them needing to
// thread org data through as a prop. If the caller has no active business
// org (personal-only account), or the org has no logo set, returns null —
// the header falls back to the default LOI Builder logo in both cases.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ logoUrl: null });
  }
  const orgs = await listUserOrgs(session.user.id);
  const businessOrg = orgs.find((o) => !o.isPersonal);
  if (!businessOrg) {
    return NextResponse.json({ logoUrl: null });
  }
  const org = await prisma.organization.findUnique({
    where: { id: businessOrg.orgId },
    select: { logoUrl: true },
  });
  return NextResponse.json({ logoUrl: org?.logoUrl || null });
}
