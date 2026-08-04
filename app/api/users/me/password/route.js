import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { validatePassword } from "../../../../../lib/passwordPolicy";

const BCRYPT_ROUNDS = 12;

// Sets or replaces the current user's password. Reachable only while
// already authenticated (via magic link, or an existing password) --
// there is no "forgot password" reset flow here; losing a password just
// means falling back to the magic link, which always keeps working (see
// lib/auth.js's Credentials provider comment).
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const { valid, error } = validatePassword(password);
  if (!valid) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}

// Removes the password, reverting the account to magic-link-only. Kept
// simple and always allowed while authenticated -- no re-auth challenge,
// matching this route's own low blast radius (worst case, someone with an
// already-open session turns password login back off).
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash: null } });
  return NextResponse.json({ ok: true });
}
