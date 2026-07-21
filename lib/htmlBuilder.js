export function buildLOIHtml(model) {
  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Letter of Intent</title>
    <style>
      body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.6; }
      .header { text-align: center; font-weight: bold; font-size: 14pt; text-transform: uppercase; margin-bottom: 30px; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      td { padding: 6px; vertical-align: top; border-bottom: 1px solid #ddd; }
      tr.total { border-top: 2px solid #000; border-bottom: 2px double #000; font-weight: bold; }
    </style>
    </head>
    <body>
      <div class="header">Letter of Intent to Purchase</div>

      <p><strong>Date:</strong> ${model.date}</p>
      <p>
        <strong>TO:</strong> ${model.sellerText}<br>
        <strong>RE:</strong> ${model.reSubject}
      </p>
      <p>Dear ${model.salutation},</p>

      <p>This Letter of Intent ("LOI") outlines the preliminary terms and conditions under which ${model.buyerName} ("Buyer") proposes to execute the purchase of designated strategic assets and property from the corporate and individual entities currently holding interest as detailed herein ("Sellers").</p>

      <p><strong>1. ASSETS TO BE ACQUIRED AND TRANSACTION SCOPE</strong><br>
      The transaction comprises the purchase of the following assets (collectively, the "Assets"):</p>
      <ul>
        ${model.inclusionPoints.map(p => `<li>${p.html}</li>`).join('\n')}
      </ul>

      <p><strong>2. PURCHASE PRICE AND ALLOCATION</strong><br>
      The proposed aggregate contract purchase value is <strong>$${model.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} (${model.grandTotalWords})</strong>, with financial allocation structures detailed explicitly below:</p>

      <table width="100%" style="table-layout: fixed; width: 100%;">
        <colgroup>
          <col width="70%" style="width: 70%;">
          <col width="30%" style="width: 30%;">
        </colgroup>
        <tbody>
          ${model.allocationRows.map(row => `
            <tr class="${row.total ? 'total' : ''}">
              <td width="70%" style="width: 70%; ${!row.total ? 'font-style: italic;' : ''}">${row.label}</td>
              <td width="30%" style="width: 30%;">$${row.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('\n')}
        </tbody>
      </table>

      <p><strong>3. BROKERAGE COMMISSION ARRANGEMENTS</strong></p>
      <div style="border: 1px solid #000; padding: 12px; margin-bottom: 15px;">
        <strong>Commission Notice:</strong> It is hereby mutually acknowledged and agreed that the <strong>${model.commissionPayerLabel}</strong> shall hold exclusive responsibility for satisfying the agent commission fee of <strong>${model.commissionSizeLabel}</strong> directly to the designated Brokerage Representative. The opposing principal party shall possess zero liability or performance obligations regarding this specific representative transaction element.
      </div>

      <p><strong>4. CONFIDENTIALITY</strong><br>
      Both Buyer and Sellers agree that all financial details, operational frameworks, and negotiation tracks tied to this potential asset acquisition remain strictly confidential and shall not be released to unapproved external parties without execution of written consent.</p>

      <p><strong>5. CONDITIONS PRECEDENT AND STRATEGIC PROTECTIONS</strong><br>
      Final commercial transaction execution and asset transitions remain contingent upon satisfactory satisfaction of the following structural checkpoints within 45 days of LOI signing:</p>
      <ul>
        ${model.conditions.map(c => `<li>${c}</li>`).join('\n')}
      </ul>

      <p><strong>6. NON-BINDING NATURE</strong><br>
      This document outlines intent for framework architecture only. Excepting the structural Confidentiality covenants, this LOI does not create enforceable closing mandates. Legal bindings manifest exclusively inside finalized, formal Purchase and Sale agreements executed later by explicit signatures.</p>

      ${model.agencyDisclosures.length > 0 ? `
      <p><strong>7. AGENCY DISCLOSURE</strong><br>
      ${model.agencyDisclosures.map(d => `<strong>${d.label}:</strong> ${d.text}`).join('<br>\n')}</p>
      ` : ''}

      <br>
      <table width="100%" border="0" style="table-layout: fixed; width: 100%; border: none;">
        <colgroup>
          <col width="50%" style="width: 50%;">
          <col width="50%" style="width: 50%;">
        </colgroup>
        <tbody>
          <tr>
            <td width="50%" style="width: 50%; border: none; vertical-align: top;">
              <p>Accepted and Agreed:</p><br>
              ${model.signatureBlocks.map(s => `
                <p>___________________________<br>
                <strong>${s.name}</strong><br>
                ${s.title}</p>
              `).join('\n')}
            </td>
            <td width="50%" style="width: 50%; border: none; vertical-align: top;">
              <p>Sincerely,</p><br>
              <p>___________________________<br>
              <strong>${model.buyerName}</strong><br>
              Buyer Authorized Representative</p>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
  return html;
}

export function buildLeaseHtml(model) {
  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Letter of Intent to Lease</title>
    <style>
      body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.6; }
      .header { text-align: center; font-weight: bold; font-size: 14pt; text-transform: uppercase; margin-bottom: 30px; }
    </style>
    </head>
    <body>
      <div class="header">Letter of Intent to Lease</div>

      <p><strong>Date:</strong> ${model.date}</p>

      <p>This Letter of Intent ("LOI") outlines the preliminary terms and conditions under which ${model.tenantName} ("Tenant") proposes to lease the premises described herein from ${model.landlordName} ("Landlord").</p>

      <p><strong>1. PARTIES &amp; PREMISES</strong><br>
      Landlord: ${model.landlordName}. Tenant: ${model.tenantName}. Premises: ${model.premisesAddress}, approximately ${model.squareFootage} square feet.</p>

      <p><strong>2. LEASE TERM &amp; COMMENCEMENT</strong><br>
      The Lease Term shall be ${model.leaseTermYears} year(s), with a target Lease Commencement Date of ${model.commencementDate}.</p>

      <p><strong>3. BASE RENT &amp; ESCALATIONS</strong><br>
      Base Monthly Rent: $${model.baseMonthlyRent.toLocaleString("en-US", { minimumFractionDigits: 2 })}.<br>
      ${model.escalationText}</p>

      <p><strong>4. SECURITY DEPOSIT</strong><br>
      Tenant shall deposit $${model.securityDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })} as a security deposit prior to lease commencement.</p>

      <p><strong>5. PERMITTED USE</strong><br>
      ${model.permittedUse}</p>

      <p><strong>6. TENANT IMPROVEMENTS / BUILD-OUT ALLOWANCE</strong><br>
      Landlord shall provide a tenant improvement allowance of $${model.tiAllowance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.<br>
      ${model.tiScopeText}</p>

      <p><strong>7. RENEWAL OPTION(S)</strong><br>
      ${model.renewalText}</p>

      <p><strong>8. BROKERAGE COMMISSION</strong></p>
      <div style="border: 1px solid #000; padding: 12px; margin-bottom: 15px;">
        <strong>Commission Notice:</strong> It is hereby mutually acknowledged and agreed that the <strong>${model.commissionPayerLabel}</strong> shall hold exclusive responsibility for satisfying the agent commission fee of <strong>${model.commissionSizeLabel}</strong> directly to the designated Brokerage Representative.
      </div>

      <p><strong>9. CONDITIONS PRECEDENT</strong></p>
      <ul>
        ${model.conditions.map(c => `<li>${c}</li>`).join('\n')}
      </ul>

      <p><strong>10. NON-BINDING NATURE</strong><br>
      This document outlines intent for framework architecture only and does not create enforceable leasing mandates. Legal bindings manifest exclusively inside a finalized, formal Lease Agreement executed later by explicit signatures.</p>

      ${model.agencyDisclosures.length > 0 ? `
      <p><strong>11. AGENCY DISCLOSURE</strong><br>
      ${model.agencyDisclosures.map(d => `<strong>${d.label}:</strong> ${d.text}`).join('<br>\n')}</p>
      ` : ''}

      <br>
      <table width="100%" border="0" style="table-layout: fixed; width: 100%; border: none;">
        <colgroup>
          <col width="50%" style="width: 50%;">
          <col width="50%" style="width: 50%;">
        </colgroup>
        <tbody>
          <tr>
            <td width="50%" style="width: 50%; border: none; vertical-align: top;">
              <p>Accepted and Agreed:</p><br>
              ${model.signatureBlocks.map(s => `
                <p>___________________________<br>
                <strong>${s.name}</strong><br>
                ${s.title}</p>
              `).join('\n')}
            </td>
            <td width="50%" style="width: 50%; border: none; vertical-align: top;">
              <p>Sincerely,</p><br>
              <p>___________________________<br>
              <strong>${model.tenantName}</strong><br>
              Tenant Authorized Representative</p>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
  return html;
}

export function buildResidentialLeaseHtml(model) {
  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Residential Lease</title>
    <style>
      body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.6; }
      .header { text-align: center; font-weight: bold; font-size: 14pt; text-transform: uppercase; margin-bottom: 6px; }
      .subheader { text-align: center; font-style: italic; margin-bottom: 24px; }
    </style>
    </head>
    <body>
      <div class="header">Residential Lease</div>
      <div class="subheader">(Standard Form of Lease — New Brunswick, Form 6)</div>

      <p><strong>Date:</strong> ${model.date}</p>

      <p><strong>SECTION 1 — PARTIES</strong><br>
      Landlord: ${model.landlordName}, ${model.landlordAddress}, ${model.landlordPhone}, ${model.landlordEmail}<br>
      ${model.landlordHasAgent ? `Landlord's Agent: ${model.landlordAgentName}<br>` : ""}
      Tenant(s): ${model.tenantNamesText}
      ${model.tenantWantsEmergencyContacts && model.emergencyContacts.length > 0 ? `<br>Emergency Contacts: ${model.emergencyContacts.map(c => `${c.name} — ${c.phone}`).join('; ')}` : ""}
      </p>

      <p><strong>SECTION 2 — PREMISES</strong><br>
      Address: ${model.premisesAddressText}. Type of premises: ${model.premisesTypeText}.</p>

      <p><strong>SECTION 3 — LENGTH OF TENANCY</strong><br>
      ${model.tenancyText}</p>

      <p><strong>SECTION 4 — RENT</strong><br>
      ${model.rentText}<br>
      ${model.rentIncreaseText ? `${model.rentIncreaseText}<br>` : ""}
      ${model.lateFeeText}<br>
      ${model.servicesText}<br>
      ${model.furnishingsText}</p>

      <p><strong>SECTION 5 — SECURITY DEPOSIT</strong><br>
      ${model.securityDepositText}</p>

      <p><strong>SECTION 6 — ASSIGNMENT</strong><br>
      ${model.assignmentText}</p>

      ${model.conditions.length > 0 ? `
      <p><strong>ADDITIONAL NOTES</strong></p>
      <ul>
        ${model.conditions.map(c => `<li>${c}</li>`).join('\\n')}
      </ul>
      ` : ''}

      <p>The Landlord and Tenant have read this lease including Attachment A, provided separately as required by
      The Residential Tenancies Act. This lease is binding on and is for the benefit of the heirs, executors and
      administrators, successors and assigns of the Landlord and the Tenant.</p>

      <p><strong>SECTION 7 — SIGNATURES</strong><br>
      Signature of Landlord: ___________________________  Date: ___________</p>
      ${model.signatureBlocks.map(s => `<p>Signature of ${s.title} (${s.name}): ___________________________  Date: ___________</p>`).join('\\n')}
    </body>
    </html>
  `;
  return html;
}
