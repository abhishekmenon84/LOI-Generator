import path from "path";
import { prisma } from "./prisma";
import { buildLOIModel } from "./loiEngine";
import { buildLeaseModel } from "./leaseEngine";
import { buildResidentialLeaseModel } from "./residentialLeaseEngine";
import { buildLOIPdf, buildLeasePdf, buildResidentialLeasePdf } from "./pdfBuilder";
import { mergePdfBuffers } from "./pdfMerge";
import { stampCustomTemplate } from "./customTemplateStamp.js";
import { stampFormTemplate } from "./formTemplateStamp.js";

const ATTACHMENT_A_PATH = path.join(process.cwd(), "public", "legal", "nb-residential-lease-attachment-a.pdf");

// Single shared implementation of "render this Ledger's base PDF" for every
// documentType -- previously duplicated verbatim across signatureFinalize.js,
// app/api/sign/[token]/route.js, and app/api/verify/[verifyCode]/route.js,
// and each copy only ever covered the 3 built-in types + custom_template
// (verify/sign's copies didn't even have the custom_template branch, so a
// custom_template Ledger would 500 on GET/POST /api/sign/[token] -- fixed by
// consolidating here). Also now covers form_template (see formTemplateStamp.js),
// closing the gap where FormTemplate had no way to ever become a real,
// signable Ledger.
export async function buildDealPdf(ledger) {
  if (ledger.documentType === "purchase_loi") {
    return buildLOIPdf(buildLOIModel(ledger.formData));
  }
  if (ledger.documentType === "commercial_lease") {
    return buildLeasePdf(buildLeaseModel(ledger.formData));
  }
  if (ledger.documentType === "residential_lease") {
    const generated = await buildResidentialLeasePdf(buildResidentialLeaseModel(ledger.formData));
    return mergePdfBuffers(generated, ATTACHMENT_A_PATH);
  }
  if (ledger.documentType === "custom_template") {
    const templateId = ledger.formData?.templateId;
    if (!templateId) throw new Error("This custom-template Ledger has no associated template.");
    const template = await prisma.customTemplate.findUnique({ where: { id: templateId }, include: { anchors: true } });
    if (!template) throw new Error("Template not found.");
    const pdfRes = await fetch(template.pdfUrl);
    if (!pdfRes.ok) throw new Error("Could not fetch the template PDF.");
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const answers = ledger.formData?.customTemplateAnswers || {};
    return stampCustomTemplate(pdfBuffer, template.anchors, answers);
  }
  if (ledger.documentType === "form_template") {
    const templateId = ledger.templateId;
    if (!templateId) throw new Error("This form-template Ledger has no associated template.");
    const template = await prisma.formTemplate.findUnique({ where: { id: templateId }, include: { fields: true } });
    if (!template) throw new Error("Template not found.");
    const pdfRes = await fetch(template.pdfUrl);
    if (!pdfRes.ok) throw new Error("Could not fetch the template PDF.");
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const answers = ledger.formData?.formTemplateAnswers || {};
    return stampFormTemplate(pdfBuffer, template.fields, answers);
  }
  throw new Error("Unsupported document type.");
}
