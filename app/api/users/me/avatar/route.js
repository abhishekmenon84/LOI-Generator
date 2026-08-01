import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { uploadFile, deleteFile } from "../../../../../lib/blobStorage";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "An image file is required." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Profile picture must be a PNG, JPEG, or WebP image." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let uploaded;
  try {
    uploaded = await uploadFile(buffer, file.name, file.type);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const existing = await prisma.user.findUnique({ where: { id: session.user.id }, select: { image: true } });
  await prisma.user.update({ where: { id: session.user.id }, data: { image: uploaded.url } });

  // Best-effort cleanup of the previous avatar blob, mirroring
  // KeeperTemplates/CustomTemplate deletion's "best effort, DB is the
  // source of truth" precedent -- a failure here must not block the
  // new avatar from being saved.
  if (existing?.image) {
    try {
      await deleteFile(existing.image);
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ imageUrl: uploaded.url });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const existing = await prisma.user.findUnique({ where: { id: session.user.id }, select: { image: true } });
  await prisma.user.update({ where: { id: session.user.id }, data: { image: null } });

  if (existing?.image) {
    try {
      await deleteFile(existing.image);
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ ok: true });
}
