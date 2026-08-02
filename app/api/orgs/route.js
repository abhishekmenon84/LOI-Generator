import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { hasBusinessOrgMembership } from "../../../lib/orgAccess";

const VALID_ACCOUNT_TYPES = ["individual", "real_estate_agency", "company", "corporation"];

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const accountType = body.accountType;
  if (!name) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }
  if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
    return NextResponse.json({ error: "Invalid account type." }, { status: 400 });
  }

  // A user gets exactly 1 personal org (automatic) + at most 1 business
  // org membership -- enforced here rather than relying on the UI to not
  // offer a second "Create org" action, since this is a real invariant
  // (e.g. Sidebar's workspace panel and Settings' "Change tier" both
  // assume a single business org per user).
  if (await hasBusinessOrgMembership(session.user.id)) {
    return NextResponse.json({ error: "You already belong to a business organization. Ledgerlot supports one business org per account." }, { status: 400 });
  }

  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const org = await prisma.organization.create({
    data: {
      name,
      accountType,
      isPersonal: false,
      planTier: "trial",
      trialEndsAt,
      ownerUserId: session.user.id,
      memberships: {
        create: { userId: session.user.id, role: "admin" },
      },
    },
  });

  return NextResponse.json({ id: org.id, name: org.name, planTier: org.planTier, trialEndsAt: org.trialEndsAt }, { status: 201 });
}
