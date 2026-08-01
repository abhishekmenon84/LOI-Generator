import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { uploadFile, deleteFile } from "../../../../../lib/blobStorage";

const DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const match = typeof body.signatureImageDataUrl === "string" ? body.signatureImageDataUrl.match(DATA_URL_RE) : null;
  if (!match) {
    return NextResponse.json({ error: "signatureImageDataUrl must be a PNG data URL." }, { status: 400 });
  }

  const buffer = Buffer.from(match[1], "base64");

  let uploaded;
  try {
    uploaded = await uploadFile(buffer, "signature.png", "image/png");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const existing = await prisma.user.findUnique({ where: { id: session.user.id }, select: { signatureImageUrl: true } });
  await prisma.user.update({ where: { id: session.user.id }, data: { signatureImageUrl: uploaded.url } });

  if (existing?.signatureImageUrl) {
    try {
      await deleteFile(existing.signatureImageUrl);
    } catch {
      // best-effort, matches the avatar route's identical precedent
    }
  }

  return NextResponse.json({ signatureImageUrl: uploaded.url });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const existing = await prisma.user.findUnique({ where: { id: session.user.id }, select: { signatureImageUrl: true } });
  await prisma.user.update({ where: { id: session.user.id }, data: { signatureImageUrl: null } });

  if (existing?.signatureImageUrl) {
    try {
      await deleteFile(existing.signatureImageUrl);
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ ok: true });
}
