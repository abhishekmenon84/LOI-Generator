import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { getUserMembership } from "../../../../lib/orgAccess";
import { slugifyLabel, uniqueKey } from "../../../../lib/formFieldKeys.mjs";
import { requireActiveTemplateOrgAccess } from "../route";

const VALID_TYPES = new Set(["text", "checkbox", "radio", "date", "signature", "initials"]);

// Loads a template only if the caller has active membership in its org.
// Never distinguishes "template doesn't exist" from "exists but you can't
// see it" -- both return null, matching this project's established
// not-found access pattern (see lib/orgAccess.js's loadAccessibleDeal and
// app/api/ledgers/[id]/route.js's loadAccessibleLedger).
async function loadAccessibleTemplate(templateId, userId) {
  const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
  if (!template) return null;
  const membership = await getUserMembership(userId, template.orgId);
  if (!membership) return null;
  return template;
}

// Same page-indexing convention as validateFields in ../route.js: 0-based,
// per resolveWidgetPageIndex in app/api/folders/[id]/files/route.js.
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

// `existingKeysById` maps this template's CURRENT FormField.id -> key
// (queried before the PATCH wipes the rows). Field.key is the spec's
// "stable machine key" that Ledger.formData will eventually be keyed by
// (see final-review.md I4); regenerating every key from the label on every
// PATCH -- as this used to do unconditionally -- means renaming a label
// ("Buyer" -> "Buyer Name") reassigns its key ("buyer" -> "buyer_name"),
// silently orphaning any answer already saved under the old key. Preserve
// the key for any incoming field whose `id` matches an existing row; only
// mint a fresh key for genuinely new fields (no id, or an id that doesn't
// match -- e.g. from a different template, which just falls through to
// "mint new" rather than ever borrowing another field's key).
//
// Two passes, not one: reserve every preserved key FIRST (in `taken`),
// then mint new keys for the rest. Doing it in a single pass in array
// order would let a new field's freshly-minted base key collide with a
// not-yet-processed preserved key later in the array, corrupting a
// perfectly good existing key with an arbitrary "_2" suffix depending on
// incoming array order.
function assignFieldKeys(fields, existingKeysById = new Map()) {
  const taken = new Set();
  const preservedKeyByIndex = new Map();

  fields.forEach((field, index) => {
    const existingKey = field.id ? existingKeysById.get(field.id) : null;
    if (existingKey && !taken.has(existingKey)) {
      preservedKeyByIndex.set(index, existingKey);
      taken.add(existingKey);
    }
  });

  return fields.map((field, index) => {
    let key = preservedKeyByIndex.get(index);
    if (!key) {
      const base = slugifyLabel(field.label);
      key = uniqueKey(base, taken);
      taken.add(key);
    }
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

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const template = await loadAccessibleTemplate(params.id, session.user.id);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  const fields = await prisma.formField.findMany({
    where: { templateId: template.id },
    orderBy: [{ page: "asc" }, { order: "asc" }],
  });
  return NextResponse.json({ ...template, fields });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const template = await loadAccessibleTemplate(params.id, session.user.id);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  // Membership alone (loadAccessibleTemplate) gets you a 404-safe read;
  // mutating a template additionally requires admin role + an active org,
  // matching every sibling org-scoped mutation route (see I2,
  // final-review.md) -- the earlier version let any active member PATCH.
  const gate = await requireActiveTemplateOrgAccess(template.orgId, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error, ...(gate.code ? { code: gate.code } : {}) }, { status: gate.status });
  }

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "A template name is required." }, { status: 400 });
    }
    data.name = name;
  }

  let preparedFields = null;
  if (body.fields !== undefined) {
    const fieldError = validateFields(body.fields, template.pageCount);
    if (fieldError) {
      return NextResponse.json({ error: fieldError }, { status: 400 });
    }
    // Fetched BEFORE the transaction wipes the rows -- see assignFieldKeys'
    // comment (I4) for why ids are matched against these existing keys.
    const existingFields = await prisma.formField.findMany({
      where: { templateId: template.id },
      select: { id: true, key: true },
    });
    const existingKeysById = new Map(existingFields.map((f) => [f.id, f.key]));
    preparedFields = assignFieldKeys(body.fields, existingKeysById);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.formTemplate.update({ where: { id: template.id }, data });
    }
    if (preparedFields !== null) {
      await tx.formField.deleteMany({ where: { templateId: template.id } });
      if (preparedFields.length > 0) {
        await tx.formField.createMany({
          data: preparedFields.map((f) => ({ ...f, templateId: template.id })),
        });
      }
    }
    return tx.formTemplate.findUnique({
      where: { id: template.id },
      include: { fields: { orderBy: [{ page: "asc" }, { order: "asc" }] } },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const template = await loadAccessibleTemplate(params.id, session.user.id);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  // Same admin+billing gate as PATCH (I2, final-review.md) -- previously
  // any active member could permanently destroy an admin-authored
  // template (cascading every FormField) with no role check at all.
  const gate = await requireActiveTemplateOrgAccess(template.orgId, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error, ...(gate.code ? { code: gate.code } : {}) }, { status: gate.status });
  }
  // FormField.templateId has onDelete: Cascade in the schema, so deleting
  // the template alone cascades the field rows -- no explicit deleteMany.
  await prisma.formTemplate.delete({ where: { id: template.id } });
  return NextResponse.json({ ok: true });
}
