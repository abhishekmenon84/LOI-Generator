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
              new TextRun({ text: model.documentTitle.toUpperCase(), bold: true, size: 28 }),
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

          ...(model.sectionEnabled.assets
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.assets, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun('The transaction comprises the purchase of the following assets (collectively, the "Assets"):')],
                }),
                ...model.inclusionPoints.map((p) => bulletParagraph(p.html)),
              ]
            : []),

          ...(model.sectionEnabled.price
            ? [
                new Paragraph({
                  spacing: { before: 200, after: 100 },
                  children: [new TextRun({ text: model.headings.price, bold: true })],
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
              ]
            : []),

          ...(model.sectionEnabled.commission
            ? [
                new Paragraph({
                  spacing: { before: 200, after: 100 },
                  children: [new TextRun({ text: model.headings.commission, bold: true })],
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
              ]
            : []),

          ...(model.sectionEnabled.confidentiality
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.confidentiality, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [
                    new TextRun(
                      "Both Buyer and Sellers agree that all financial details, operational frameworks, and negotiation tracks tied to this potential asset acquisition remain strictly confidential and shall not be released to unapproved external parties without execution of written consent."
                    ),
                  ],
                }),
              ]
            : []),

          ...(model.sectionEnabled.conditions
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.conditions, bold: true })],
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
              ]
            : []),

          ...(model.sectionEnabled.nonBinding
            ? [
                new Paragraph({
                  spacing: { before: 200, after: 300 },
                  children: [new TextRun({ text: model.headings.nonBinding, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 400 },
                  children: [
                    new TextRun(
                      "This document outlines intent for framework architecture only. Excepting the Confidentiality covenants above, this LOI does not create enforceable closing mandates. Legal bindings manifest exclusively inside finalized, formal Purchase and Sale agreements executed later by explicit signatures."
                    ),
                  ],
                }),
              ]
            : []),

          ...(model.sectionEnabled.agency
            ? [
                new Paragraph({
                  spacing: { before: 200, after: 300 },
                  children: [new TextRun({ text: model.headings.agency, bold: true })],
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

          new Paragraph({ spacing: { before: 400 }, text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0 },
              bottom: { style: BorderStyle.NONE, size: 0 },
              left: { style: BorderStyle.NONE, size: 0 },
              right: { style: BorderStyle.NONE, size: 0 },
              insideHorizontal: { style: BorderStyle.NONE, size: 0 },
              insideVertical: { style: BorderStyle.NONE, size: 0 },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0 },
                      bottom: { style: BorderStyle.NONE, size: 0 },
                      left: { style: BorderStyle.NONE, size: 0 },
                      right: { style: BorderStyle.NONE, size: 0 },
                    },
                    children: [
                      new Paragraph({ text: "Accepted and Agreed:", spacing: { after: 300 } }),
                      ...model.signatureBlocks.flatMap((s) => [
                        new Paragraph({ text: "___________________________" }),
                        new Paragraph({ children: [new TextRun({ text: s.name, bold: true })] }),
                        new Paragraph({ text: s.title, spacing: { after: 300 } }),
                      ]),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0 },
                      bottom: { style: BorderStyle.NONE, size: 0 },
                      left: { style: BorderStyle.NONE, size: 0 },
                      right: { style: BorderStyle.NONE, size: 0 },
                    },
                    children: [
                      new Paragraph({ text: "Sincerely,", spacing: { after: 400 } }),
                      new Paragraph({ text: "___________________________" }),
                      new Paragraph({ children: [new TextRun({ text: model.buyerName, bold: true })] }),
                      new Paragraph({ text: "Buyer Authorized Representative" }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function buildLeaseDocx(model) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({ text: model.documentTitle.toUpperCase(), bold: true, size: 28 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: "Date: ", bold: true }), new TextRun(model.date)],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun(
                `This Letter of Intent ("LOI") outlines the preliminary terms and conditions under which ${model.tenantName} ("Tenant") proposes to lease the premises described herein from ${model.landlordName} ("Landlord").`
              ),
            ],
          }),

          ...(model.sectionEnabled.parties
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.parties, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [
                    new TextRun(
                      `Landlord: ${model.landlordName}. Tenant: ${model.tenantName}. Premises: ${model.premisesAddress}, approximately ${model.squareFootage} square feet.`
                    ),
                  ],
                }),
              ]
            : []),

          ...(model.sectionEnabled.term
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.term, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [
                    new TextRun(
                      `The Lease Term shall be ${model.leaseTermYears} year(s), with a target Lease Commencement Date of ${model.commencementDate}.`
                    ),
                  ],
                }),
              ]
            : []),

          ...(model.sectionEnabled.rent
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.rent, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun(
                      `Base Monthly Rent: $${model.baseMonthlyRent.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
                    ),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [new TextRun(model.escalationText)],
                }),
              ]
            : []),

          ...(model.sectionEnabled.deposit
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.deposit, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [
                    new TextRun(
                      `Tenant shall deposit $${model.securityDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })} as a security deposit prior to lease commencement.`
                    ),
                  ],
                }),
              ]
            : []),

          ...(model.sectionEnabled.use
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.use, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [new TextRun(model.permittedUse)],
                }),
              ]
            : []),

          ...(model.sectionEnabled.ti
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.ti, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun(
                      `Landlord shall provide a tenant improvement allowance of $${model.tiAllowance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`
                    ),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [new TextRun(model.tiScopeText)],
                }),
              ]
            : []),

          ...(model.sectionEnabled.renewal
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.renewal, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [new TextRun(model.renewalText)],
                }),
              ]
            : []),

          ...(model.sectionEnabled.commission
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.commission, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 200 },
                  children: [
                    new TextRun({ text: "Commission Notice: ", bold: true }),
                    new TextRun(
                      `It is hereby mutually acknowledged and agreed that the ${model.commissionPayerLabel} shall hold exclusive responsibility for satisfying the agent commission fee of ${model.commissionSizeLabel} directly to the designated Brokerage Representative.`
                    ),
                  ],
                }),
              ]
            : []),

          ...(model.sectionEnabled.conditions
            ? [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: model.headings.conditions, bold: true })],
                }),
                ...model.conditions.map((c) => bulletParagraph(c)),
              ]
            : []),

          ...(model.sectionEnabled.nonBinding
            ? [
                new Paragraph({
                  spacing: { before: 200, after: 300 },
                  children: [new TextRun({ text: model.headings.nonBinding, bold: true })],
                }),
                new Paragraph({
                  spacing: { after: 400 },
                  children: [
                    new TextRun(
                      "This document outlines intent for framework architecture only and does not create enforceable leasing mandates. Legal bindings manifest exclusively inside a finalized, formal Lease Agreement executed later by explicit signatures."
                    ),
                  ],
                }),
              ]
            : []),

          ...(model.sectionEnabled.agency
            ? [
                new Paragraph({
                  spacing: { before: 200, after: 300 },
                  children: [new TextRun({ text: model.headings.agency, bold: true })],
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

          new Paragraph({ spacing: { before: 400 }, text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0 },
              bottom: { style: BorderStyle.NONE, size: 0 },
              left: { style: BorderStyle.NONE, size: 0 },
              right: { style: BorderStyle.NONE, size: 0 },
              insideHorizontal: { style: BorderStyle.NONE, size: 0 },
              insideVertical: { style: BorderStyle.NONE, size: 0 },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0 },
                      bottom: { style: BorderStyle.NONE, size: 0 },
                      left: { style: BorderStyle.NONE, size: 0 },
                      right: { style: BorderStyle.NONE, size: 0 },
                    },
                    children: [
                      new Paragraph({ text: "Accepted and Agreed:", spacing: { after: 300 } }),
                      ...model.signatureBlocks.flatMap((s) => [
                        new Paragraph({ text: "___________________________" }),
                        new Paragraph({ children: [new TextRun({ text: s.name, bold: true })] }),
                        new Paragraph({ text: s.title, spacing: { after: 300 } }),
                      ]),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0 },
                      bottom: { style: BorderStyle.NONE, size: 0 },
                      left: { style: BorderStyle.NONE, size: 0 },
                      right: { style: BorderStyle.NONE, size: 0 },
                    },
                    children: [
                      new Paragraph({ text: "Sincerely,", spacing: { after: 400 } }),
                      new Paragraph({ text: "___________________________" }),
                      new Paragraph({ children: [new TextRun({ text: model.tenantName, bold: true })] }),
                      new Paragraph({ text: "Tenant Authorized Representative" }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function buildResidentialLeaseDocx(model) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [new TextRun({ text: model.documentTitle.toUpperCase(), bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({ text: "(Standard Form of Lease — New Brunswick, Form 6)", italics: true, size: 20 })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: "Date: ", bold: true }), new TextRun(model.date)],
          }),

          ...(model.sectionEnabled.parties
            ? [
                new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: model.headings.parties, bold: true })] }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun({ text: "Landlord: ", bold: true }),
                    new TextRun(`${model.landlordName}, ${model.landlordAddress}, ${model.landlordPhone}, ${model.landlordEmail}`),
                  ],
                }),
                ...(model.landlordHasAgent
                  ? [new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Landlord's Agent: ", bold: true }), new TextRun(model.landlordAgentName)] })]
                  : []),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun({ text: "Tenant(s): ", bold: true }), new TextRun(model.tenantNamesText)],
                }),
                ...(model.tenantWantsEmergencyContacts && model.emergencyContacts.length > 0
                  ? [
                      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Emergency Contacts: ", bold: true })] }),
                      ...model.emergencyContacts.map((c) => new Paragraph({ text: `${c.name} — ${c.phone}`, spacing: { after: 60 } })),
                    ]
                  : []),
              ]
            : []),

          ...(model.sectionEnabled.premises
            ? [
                new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: model.headings.premises, bold: true })] }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [new TextRun(`Address: ${model.premisesAddressText}. Type of premises: ${model.premisesTypeText}.`)],
                }),
              ]
            : []),

          ...(model.sectionEnabled.tenancy
            ? [
                new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: model.headings.tenancy, bold: true })] }),
                new Paragraph({ spacing: { after: 100 }, children: [new TextRun(model.tenancyText)] }),
              ]
            : []),

          ...(model.sectionEnabled.rent
            ? [
                new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: model.headings.rent, bold: true })] }),
                new Paragraph({ spacing: { after: 100 }, children: [new TextRun(model.rentText)] }),
                ...(model.rentIncreaseText ? [new Paragraph({ spacing: { after: 100 }, children: [new TextRun(model.rentIncreaseText)] })] : []),
                new Paragraph({ spacing: { after: 100 }, children: [new TextRun(model.lateFeeText)] }),
                new Paragraph({ spacing: { after: 100 }, children: [new TextRun(model.servicesText)] }),
                new Paragraph({ spacing: { after: 100 }, children: [new TextRun(model.furnishingsText)] }),
              ]
            : []),

          ...(model.sectionEnabled.deposit
            ? [
                new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: model.headings.deposit, bold: true })] }),
                new Paragraph({ spacing: { after: 100 }, children: [new TextRun(model.securityDepositText)] }),
              ]
            : []),

          ...(model.sectionEnabled.assignment
            ? [
                new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: model.headings.assignment, bold: true })] }),
                new Paragraph({ spacing: { after: 200 }, children: [new TextRun(model.assignmentText)] }),
              ]
            : []),

          ...(model.conditions.length > 0
            ? [
                new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "ADDITIONAL NOTES", bold: true })] }),
                ...model.conditions.map((c) => bulletParagraph(c)),
              ]
            : []),

          ...(model.sectionEnabled.signatures
            ? [
                new Paragraph({
                  spacing: { before: 300, after: 200 },
                  children: [
                    new TextRun(
                      "The Landlord and Tenant have read this lease including Attachment A, provided separately as required by The Residential Tenancies Act. This lease is binding on and is for the benefit of the heirs, executors and administrators, successors and assigns of the Landlord and the Tenant."
                    ),
                  ],
                }),
                new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: model.headings.signatures, bold: true })] }),
                new Paragraph({ text: "Signature of Landlord: ___________________________  Date: ___________", spacing: { after: 200 } }),
                ...model.signatureBlocks.flatMap((s) =>
                  [new Paragraph({ text: `Signature of ${s.title} (${s.name}): ___________________________  Date: ___________`, spacing: { after: 200 } })]
                ),
              ]
            : []),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
