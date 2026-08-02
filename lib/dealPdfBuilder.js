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

// Single shared implementation of "render a document's base PDF" for every
// documentType -- previously duplicated verbatim across signatureFinalize.js,
// app/api/sign/[token]/route.js, and app/api/verify/[verifyCode]/route.js,
// and each copy only ever covered the 3 built-in types + custom_template
// (verify/sign's copies didn't even have the custom_template branch, so a
// custom_template Ledger would 500 on GET/POST /api/sign/[token] -- fixed by
// consolidating here). Also now covers form_template (see formTemplateStamp.js),
// closing the gap where FormTemplate had no way to ever become a real,
// signable Ledger.
//
// Accepts either a live Ledger row or a SignatureRequest's own frozen
// snapshot ({documentType, formData, templateId} -- see
// SignatureRequest.snapshotFormData/snapshotDocumentType/snapshotTemplateId
// in prisma/schema.prisma) since both shapes are structurally identical.
// Signing-time and finalize-time callers MUST pass the snapshot, not the
// live Ledger, so a Ledger edited after being voided-and-resent can never
// retroactively change what an earlier signer actually saw and signed.
export async function buildDealPdf(source) {
  if (source.documentType === "purchase_loi") {
    return buildLOIPdf(buildLOIModel(source.formData));
  }
  if (source.documentType === "commercial_lease") {
    return buildLeasePdf(buildLeaseModel(source.formData));
  }
  if (source.documentType === "residential_lease") {
    const generated = await buildResidentialLeasePdf(buildResidentialLeaseModel(source.formData));
    return mergePdfBuffers(generated, ATTACHMENT_A_PATH);
  }
  if (source.documentType === "custom_template") {
    const templateId = source.formData?.templateId;
    if (!templateId) throw new Error("This custom-template Ledger has no associated template.");
    const template = await prisma.customTemplate.findUnique({ where: { id: templateId }, include: { anchors: true } });
    if (!template) throw new Error("Template not found.");
    const pdfRes = await fetch(template.pdfUrl);
    if (!pdfRes.ok) throw new Error("Could not fetch the template PDF.");
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const answers = source.formData?.customTemplateAnswers || {};
    return stampCustomTemplate(pdfBuffer, template.anchors, answers);
  }
  if (source.documentType === "form_template") {
    const templateId = source.templateId;
    if (!templateId) throw new Error("This form-template Ledger has no associated template.");
    const template = await prisma.formTemplate.findUnique({ where: { id: templateId }, include: { fields: true } });
    if (!template) throw new Error("Template not found.");
    const pdfRes = await fetch(template.pdfUrl);
    if (!pdfRes.ok) throw new Error("Could not fetch the template PDF.");
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const answers = source.formData?.formTemplateAnswers || {};
    return stampFormTemplate(pdfBuffer, template.fields, answers);
  }
  throw new Error("Unsupported document type.");
}
