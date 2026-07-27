import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getUserMembership, listUserOrgs, getPersonalOrgId } from "../../../lib/orgAccess";
import { isOrgActive } from "../../../lib/orgBilling";
import { slugifyLabel, uniqueKey } from "../../../lib/formFieldKeys.mjs";

const VALID_TYPES = new Set(["text", "checkbox", "radio", "date", "signature", "initials"]);
const VALID_SOURCE_TIERS = new Set(["acroform", "detected", "manual"]);

// Mirrors requireAdminActiveOrg (app/api/orgs/[id]/templates/route.js) for
// the newer FormTemplate routes: an admin-role check plus the
// isOrgActive()/TRIAL_EXPIRED billing gate every other mutating org-scoped
// route enforces. One deliberate difference -- FormTemplates (unlike the
// legacy CustomTemplate system) may live in a user's PERSONAL org: POST
// falls back there via getPersonalOrgId() for a user with no business org,
// and getPersonalOrgId() also now falls back to a user's sole membership
// when they have no personal org at all. isOrgActive() already treats
// every personal org as active, so the only adjustment needed here is to
// not require admin role for a personal org -- its sole member is its
// de facto admin.
export async function requireActiveTemplateOrgAccess(orgId, userId) {
  const membership = await getUserMembership(userId, orgId);
  if (!membership) return { error: "You are not a member of that organization.", status: 403 };
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { error: "Organization not found.", status: 404 };
  if (!org.isPersonal && membership.role !== "admin") {
    return { error: "Admin access required.", status: 403 };
  }
  if (!isOrgActive(org)) {
    return { error: "Your organization's trial has ended. Subscribe to continue.", status: 402, code: "TRIAL_EXPIRED" };
  }
  return { org, membership };
}

// Accepts only a URL this app's own blob storage (lib/blobStorage.js's
// `put()`, via @vercel/blob) would have produced -- not an XSS sink today
// (the value only ever reaches pdf.js's getDocument({url}), never rendered
// as an href/src), but free hardening against an org member pointing a
// template at an arbitrary external URL that every other member's browser
// would then fetch. Hostname check matches @vercel/blob's OWN validation
// (node_modules/@vercel/blob/dist/index.js's `.endsWith(".blob.vercel-storage.com")`)
// rather than hardcoding the "public" access-level segment, so this stays
// correct if the store's access level ever changes.
function isOwnBlobUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return parsed.hostname.endsWith(".blob.vercel-storage.com");
}

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
  if (!isOwnBlobUrl(pdfUrl)) {
    return NextResponse.json({ error: "pdfUrl must be a URL returned by this app's own upload/normalize endpoint." }, { status: 400 });
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
  if (!orgId) {
    orgId = await getPersonalOrgId(session.user.id);
    if (!orgId) {
      return NextResponse.json({ error: "No organization found for this account." }, { status: 500 });
    }
  }

  const gate = await requireActiveTemplateOrgAccess(orgId, session.user.id);
  if (gate.error) {
    return NextResponse.json({ error: gate.error, ...(gate.code ? { code: gate.code } : {}) }, { status: gate.status });
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
