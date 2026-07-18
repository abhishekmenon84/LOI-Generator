import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";

// Strips the simple <strong>...</strong> markup used in loiEngine's HTML
// snippets and converts it into an array of docx TextRun objects with bold
// runs where appropriate, so the same content model drives both the web
// preview (raw HTML) and the Word export (docx TextRuns).
function htmlToRuns(html) {
  const runs = [];
  const regex = /<strong>(.*?)<\/strong>/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun(html.slice(lastIndex, match.index)));
    }
    runs.push(new TextRun({ text: match[1], bold: true }));
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < html.length) {
    runs.push(new TextRun(html.slice(lastIndex)));
  }
  return runs.length ? runs : [new TextRun(html)];
}

function bulletParagraph(html) {
  return new Paragraph({
    children: htmlToRuns(html),
    bullet: { level: 0 },
    spacing: { after: 120 },
  });
}

function moneyCell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 50, type: WidthType.PERCENTAGE },
    borders: opts.total
      ? {
          top: { style: BorderStyle.DOUBLE, size: 6 },
          bottom: { style: BorderStyle.DOUBLE, size: 6 },
        }
      : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: !!opts.total })],
      }),
    ],
  });
}

export async function buildLOIDocx(model) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({ text: "LETTER OF INTENT TO PURCHASE", bold: true, size: 28 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: "Date: ", bold: true }), new TextRun(model.date)],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: "TO: ", bold: true }), new TextRun(model.sellerText)],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: "RE: ", bold: true }), new TextRun(model.reSubject)],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun(`Dear ${model.salutation},`)],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun(
                `This Letter of Intent ("LOI") outlines the preliminary terms and conditions under which ${model.buyerName} ("Buyer") proposes to execute the purchase of designated strategic assets and property from the corporate and individual entities currently holding interest as detailed herein ("Sellers").`
              ),
            ],
          }),

          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: "1. ASSETS TO BE ACQUIRED AND TRANSACTION SCOPE", bold: true })],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun('The transaction comprises the purchase of the following assets (collectively, the "Assets"):')],
          }),
          ...model.inclusionPoints.map((p) => bulletParagraph(p.html)),

          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: "2. PURCHASE PRICE AND ALLOCATION", bold: true })],
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun(
                `The proposed aggregate contract purchase value is $${model.grandTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })} (${model.grandTotalWords}), with financial allocation structures detailed explicitly below:`
              ),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: model.allocationRows.map(
              (row) =>
                new TableRow({
                  children: [
                    moneyCell(row.label, { width: 70, total: row.total }),
                    moneyCell(
                      `$${row.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                      { width: 30, total: row.total }
                    ),
                  ],
                })
            ),
          }),

          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: "3. BROKERAGE COMMISSION ARRANGEMENTS", bold: true })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Commission Notice: ", bold: true }),
              new TextRun(
                `It is hereby mutually acknowledged and agreed that the ${model.commissionPayerLabel} shall hold exclusive responsibility for satisfying the agent commission fee of ${model.commissionSizeLabel} directly to the designated Brokerage Representative. The opposing principal party shall possess zero liability or performance obligations regarding this specific representative transaction element.`
              ),
            ],
          }),

          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: "4. CONFIDENTIALITY", bold: true })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun(
                "Both Buyer and Sellers agree that all financial details, operational frameworks, and negotiation tracks tied to this potential asset acquisition remain strictly confidential and shall not be released to unapproved external parties without execution of written consent."
              ),
            ],
          }),

          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: "5. CONDITIONS PRECEDENT AND STRATEGIC PROTECTIONS", bold: true })],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun(
                "Final commercial transaction execution and asset transitions remain contingent upon satisfactory satisfaction of the following structural checkpoints within 45 days of LOI signing:"
              ),
            ],
          }),
          ...model.conditions.map((c) => bulletParagraph(c)),

          new Paragraph({
            spacing: { before: 200, after: 300 },
            children: [new TextRun({ text: "6. NON-BINDING NATURE", bold: true })],
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [
              new TextRun(
                "This document outlines intent for framework architecture only. Excepting the Confidentiality covenants above, this LOI does not create enforceable closing mandates. Legal bindings manifest exclusively inside finalized, formal Purchase and Sale agreements executed later by explicit signatures."
              ),
            ],
          }),

          ...(model.agencyDisclosures.length > 0
            ? [
                new Paragraph({
                  spacing: { before: 200, after: 300 },
                  children: [new TextRun({ text: "7. AGENCY DISCLOSURE", bold: true })],
                }),
                ...model.agencyDisclosures.map(
                  (d) =>
                    new Paragraph({
                      spacing: { after: 120 },
                      children: [
                        new TextRun({ text: `${d.label}: `, bold: true }),
                        new TextRun(d.text),
                      ],
                    })
                ),
              ]
            : []),

          new Paragraph({ text: "Accepted and Agreed:", spacing: { before: 400, after: 300 } }),
          ...model.signatureBlocks.flatMap((s) => [
            new Paragraph({ text: "___________________________" }),
            new Paragraph({ children: [new TextRun({ text: s.name, bold: true })] }),
            new Paragraph({ text: s.title, spacing: { after: 300 } }),
          ]),

          new Paragraph({ text: "Sincerely,", spacing: { after: 400 } }),
          new Paragraph({ text: "___________________________" }),
          new Paragraph({ children: [new TextRun({ text: model.buyerName, bold: true })] }),
          new Paragraph({ text: "Buyer Authorized Representative", spacing: { after: 400 } }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
