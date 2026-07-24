import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { listUserOrgs } from "../../../../lib/orgAccess";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const orgs = await listUserOrgs(session.user.id);
  return NextResponse.json({ orgs });
}
