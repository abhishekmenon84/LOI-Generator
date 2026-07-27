import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getUserMembership, listUserOrgs, getPersonalOrgId } from "../../../lib/orgAccess";
import { slugifyLabel, uniqueKey } from "../../../lib/formFieldKeys.mjs";

const VALID_TYPES = new Set(["text", "checkbox", "radio", "date", "signature", "initials"]);
const VALID_SOURCE_TIERS = new Set(["acroform", "detected", "manual"]);

// Validates the raw `fields` array from the request body against `pageCount`
// and returns a plain-language error, or null if everything checks out.
// `page` is 0-based, matching resolveWidgetPageIndex in
// app/api/folders/[id]/files/route.js and the FormField schema it feeds.
function validateFields(fields, pageCount) {
  if (!Array.isArray(fields)) return "fields must be an array.";
  for (const field of fields) {
    if (!field || typeof field !== "object") return "Each field must be an object.";
    if (!VALID_TYPES.has(field.type)) return `Unknown field type: ${field.type}.`;
    if (!Number.isInteger(field.page) || field.page < 0 || field.page > pageCount - 1) {
      return `Field page ${field.page} is out of range for a ${pageCount}-page document.`;
    }
    for (const key of ["xPct", "yPct", "widthPct", "heightPct"]) {
      const value = field[key];
      if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) {
        return `Field ${key} must be a number between 0 and 100.`;
      }
    }
  }
  return null;
}

// Assigns a unique, server-side `key` to every field, based on its label.
// Client-supplied keys are never trusted -- @@unique([templateId, key])
// would otherwise reject the entire insert on the first collision.
function assignFieldKeys(fields) {
  const taken = new Set();
  return fields.map((field, index) => {
    const base = slugifyLabel(field.label);
    const key = uniqueKey(base, taken);
    taken.add(key);
    return {
      key,
      label: String(field.label || ""),
      type: field.type,
      page: field.page,
      xPct: field.xPct,
      yPct: field.yPct,
      widthPct: field.widthPct,
      heightPct: field.heightPct,
      required: !!field.required,
      radioGroup: field.radioGroup ? String(field.radioGroup) : null,
      signerRole: field.signerRole ? String(field.signerRole) : null,
      confidence: typeof field.confidence === "number" ? field.confidence : null,
      order: Number.isInteger(field.order) ? field.order : index,
    };
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const userOrgs = await listUserOrgs(session.user.id);
  const orgIds = userOrgs.map((o) => o.orgId);
  if (orgIds.length === 0) {
    return NextResponse.json({ templates: [] });
  }
  const templates = await prisma.formTemplate.findMany({
    where: { orgId: { in: orgIds } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").toString().trim();
  const pdfUrl = (body.pdfUrl || "").toString().trim();
  const pageCount = Number(body.pageCount);
  const sourceTier = body.sourceTier;
  const fields = body.fields;

  if (!name) {
    return NextResponse.json({ error: "A template name is required." }, { status: 400 });
  }
  if (!pdfUrl) {
    return NextResponse.json({ error: "pdfUrl is required." }, { status: 400 });
  }
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return NextResponse.json({ error: "pageCount must be an integer of at least 1." }, { status: 400 });
  }
  if (!VALID_SOURCE_TIERS.has(sourceTier)) {
    return NextResponse.json({ error: `Unknown sourceTier: ${sourceTier}.` }, { status: 400 });
  }
  const fieldError = validateFields(fields || [], pageCount);
  if (fieldError) {
    return NextResponse.json({ error: fieldError }, { status: 400 });
  }

  let orgId = body.orgId;
  if (orgId) {
    const membership = await getUserMembership(session.user.id, orgId);
    if (!membership) {
      return NextResponse.json({ error: "You are not a member of that organization." }, { status: 403 });
    }
  } else {
    orgId = await getPersonalOrgId(session.user.id);
    if (!orgId) {
      return NextResponse.json({ error: "No organization found for this account." }, { status: 500 });
    }
  }

  const preparedFields = assignFieldKeys(fields || []);

  const created = await prisma.$transaction(async (tx) => {
    const template = await tx.formTemplate.create({
      data: {
        orgId,
        name,
        pdfUrl,
        pageCount,
        sourceTier,
        createdByUserId: session.user.id,
      },
    });
    if (preparedFields.length > 0) {
      await tx.formField.createMany({
        data: preparedFields.map((f) => ({ ...f, templateId: template.id })),
      });
    }
    return tx.formTemplate.findUnique({
      where: { id: template.id },
      include: { fields: { orderBy: [{ page: "asc" }, { order: "asc" }] } },
    });
  });

  return NextResponse.json(created, { status: 201 });
}
