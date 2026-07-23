import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

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

  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const org = await prisma.organization.create({
    data: {
      name,
      accountType,
      isPersonal: false,
      planTier: "trial",
      trialEndsAt,
      memberships: {
        create: { userId: session.user.id, role: "admin" },
      },
    },
  });

  return NextResponse.json({ id: org.id, name: org.name, planTier: org.planTier, trialEndsAt: org.trialEndsAt }, { status: 201 });
}
