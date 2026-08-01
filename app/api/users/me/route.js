import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    licenseNumber: user.licenseNumber,
    image: user.image,
    signatureImageUrl: user.signatureImageUrl,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(serializeUser(user));
}

export async function PATCH(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};

  if ("name" in body) {
    if (body.name !== null && typeof body.name !== "string") {
      return NextResponse.json({ error: "name must be a string or null." }, { status: 400 });
    }
    data.name = body.name === null ? null : body.name.trim() || null;
  }
  if ("phone" in body) {
    if (body.phone !== null && typeof body.phone !== "string") {
      return NextResponse.json({ error: "phone must be a string or null." }, { status: 400 });
    }
    data.phone = body.phone === null ? null : body.phone.trim() || null;
  }
  if ("licenseNumber" in body) {
    if (body.licenseNumber !== null && typeof body.licenseNumber !== "string") {
      return NextResponse.json({ error: "licenseNumber must be a string or null." }, { status: 400 });
    }
    data.licenseNumber = body.licenseNumber === null ? null : body.licenseNumber.trim() || null;
  }

  const user = await prisma.user.update({ where: { id: session.user.id }, data });
  return NextResponse.json(serializeUser(user));
}
