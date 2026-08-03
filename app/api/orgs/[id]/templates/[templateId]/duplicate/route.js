import { NextResponse } from "next/server";
import { auth } from "../../../../../../../lib/auth";
import { prisma } from "../../../../../../../lib/prisma";
import { getUserMembership } from "../../../../../../../lib/orgAccess";

// Clones a template's structure (name, PDF reference, anchors/fields) --
// works for either template system (CustomTemplate or FormTemplate, same
// distinction as GET .../[templateId]). Reuses the SAME underlying PDF
// blob rather than re-uploading a copy (the file itself doesn't change,
// only the template metadata/anchor definitions), so this is fast and
// doesn't consume extra Blob storage.
export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const customTemplate = await prisma.customTemplate.findUnique({ where: { id: params.templateId }, include: { anchors: true } });
  if (customTemplate) {
    const membership = await getUserMembership(session.user.id, customTemplate.orgId);
    if (!membership) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    // CustomTemplate is private to its creator -- duplicating someone
    // else's isn't allowed, matching the same ownership rule as edit/delete.
    if (customTemplate.createdByUserId !== session.user.id) {
      return NextResponse.json({ error: "Only this template's creator can duplicate it." }, { status: 403 });
    }
    const created = await prisma.customTemplate.create({
      data: {
        orgId: customTemplate.orgId,
        name: `${customTemplate.name} (copy)`,
        pdfUrl: customTemplate.pdfUrl,
        pageCount: customTemplate.pageCount,
        createdByUserId: session.user.id,
        anchors: {
          create: customTemplate.anchors.map((a) => ({
            type: a.type,
            role: a.role,
            page: a.page,
            xPct: a.xPct,
            yPct: a.yPct,
            widthPct: a.widthPct,
            heightPct: a.heightPct,
            customQuestion: a.customQuestion,
          })),
        },
      },
    });
    return NextResponse.json({ id: created.id, name: created.name }, { status: 201 });
  }

  const formTemplate = await prisma.formTemplate.findUnique({ where: { id: params.templateId }, include: { fields: true } });
  if (!formTemplate) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  const membership = await getUserMembership(session.user.id, formTemplate.orgId);
  if (!membership) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  // FormTemplate is org-shared -- any member can duplicate it (matches who
  // can already see/use it via GET /api/templates).
  const created = await prisma.formTemplate.create({
    data: {
      orgId: formTemplate.orgId,
      name: `${formTemplate.name} (copy)`,
      pdfUrl: formTemplate.pdfUrl,
      pageCount: formTemplate.pageCount,
      sourceTier: formTemplate.sourceTier,
      createdByUserId: session.user.id,
      fields: {
        create: formTemplate.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          page: f.page,
          xPct: f.xPct,
          yPct: f.yPct,
          widthPct: f.widthPct,
          heightPct: f.heightPct,
          required: f.required,
          radioGroup: f.radioGroup,
          signerRole: f.signerRole,
          confidence: f.confidence,
          order: f.order,
        })),
      },
    },
  });
  return NextResponse.json({ id: created.id, name: created.name }, { status: 201 });
}
