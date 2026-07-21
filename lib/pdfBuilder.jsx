import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// Pure JS PDF rendering (no headless browser / Chromium binary needed),
// which makes this safe to run in Vercel's serverless functions.

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Times-Roman", lineHeight: 1.5 },
  header: { textAlign: "center", fontFamily: "Times-Bold", fontSize: 14, marginBottom: 20 },
  bold: { fontFamily: "Times-Bold" },
  para: { marginBottom: 10 },
  sectionTitle: { fontFamily: "Times-Bold", marginTop: 6, marginBottom: 6 },
  bullet: { flexDirection: "row", marginBottom: 6, paddingRight: 4 },
  bulletDot: { width: 12 },
  bulletText: { flex: 1 },
  table: { marginTop: 8, marginBottom: 8, borderTop: "1pt solid #ccc" },
  row: { flexDirection: "row", borderBottom: "1pt solid #ccc", paddingVertical: 4 },
  totalRow: { flexDirection: "row", borderTop: "2pt solid #000", paddingVertical: 4 },
  cellLabel: { flex: 3 },
  cellValue: { flex: 1, textAlign: "right" },
  sigBlock: { marginTop: 10, marginBottom: 14 },
});

// Renders a string that may contain <strong>...</strong> into styled Text runs.
function RichText({ html, style }) {
  const parts = [];
  const regex = /<strong>(.*?)<\/strong>/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) parts.push(<Text key={key++}>{html.slice(lastIndex, match.index)}</Text>);
    parts.push(
      <Text key={key++} style={styles.bold}>
        {match[1]}
      </Text>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < html.length) parts.push(<Text key={key++}>{html.slice(lastIndex)}</Text>);
  return <Text style={style}>{parts}</Text>;
}

function LOIPdfDocument({ model }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>LETTER OF INTENT TO PURCHASE</Text>

        <Text style={styles.para}>
          <Text style={styles.bold}>Date: </Text>
          {model.date}
        </Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>TO: </Text>
          {model.sellerText}
          {"\n"}
          <Text style={styles.bold}>RE: </Text>
          {model.reSubject}
        </Text>
        <Text style={styles.para}>Dear {model.salutation},</Text>
        <Text style={styles.para}>
          This Letter of Intent (&quot;LOI&quot;) outlines the preliminary terms and conditions under which{" "}
          {model.buyerName} (&quot;Buyer&quot;) proposes to execute the purchase of designated strategic assets and
          property from the corporate and individual entities currently holding interest as detailed herein
          (&quot;Sellers&quot;).
        </Text>

        <Text style={styles.sectionTitle}>1. ASSETS TO BE ACQUIRED AND TRANSACTION SCOPE</Text>
        <Text style={styles.para}>
          The transaction comprises the purchase of the following assets (collectively, the &quot;Assets&quot;):
        </Text>
        {model.inclusionPoints.map((p, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletDot}>•</Text>
            <RichText html={p.html} style={styles.bulletText} />
          </View>
        ))}

        <Text style={styles.sectionTitle}>2. PURCHASE PRICE AND ALLOCATION</Text>
        <Text style={styles.para}>
          The proposed aggregate contract purchase value is $
          {model.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({model.grandTotalWords}), with
          financial allocation structures detailed explicitly below:
        </Text>
        <View style={styles.table}>
          {model.allocationRows.map((row, i) => (
            <View style={row.total ? styles.totalRow : styles.row} key={i}>
              <Text style={[styles.cellLabel, row.total ? styles.bold : null]}>{row.label}</Text>
              <Text style={[styles.cellValue, row.total ? styles.bold : null]}>
                ${row.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>3. BROKERAGE COMMISSION ARRANGEMENTS</Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Commission Notice: </Text>
          It is hereby mutually acknowledged and agreed that the {model.commissionPayerLabel} shall hold exclusive
          responsibility for satisfying the agent commission fee of {model.commissionSizeLabel} directly to the
          designated Brokerage Representative. The opposing principal party shall possess zero liability or
          performance obligations regarding this specific representative transaction element.
        </Text>

        <Text style={styles.sectionTitle}>4. CONFIDENTIALITY</Text>
        <Text style={styles.para}>
          Both Buyer and Sellers agree that all financial details, operational frameworks, and negotiation tracks
          tied to this potential asset acquisition remain strictly confidential and shall not be released to
          unapproved external parties without execution of written consent.
        </Text>

        <Text style={styles.sectionTitle}>5. CONDITIONS PRECEDENT AND STRATEGIC PROTECTIONS</Text>
        <Text style={styles.para}>
          Final commercial transaction execution and asset transitions remain contingent upon satisfactory
          satisfaction of the following structural checkpoints within 45 days of LOI signing:
        </Text>
        {model.conditions.map((c, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletDot}>•</Text>
            <RichText html={c} style={styles.bulletText} />
          </View>
        ))}

        <Text style={styles.sectionTitle}>6. NON-BINDING NATURE</Text>
        <Text style={styles.para}>
          This document outlines intent for framework architecture only. Excepting the Confidentiality covenants
          above, this LOI does not create enforceable closing mandates. Legal bindings manifest exclusively inside
          finalized, formal Purchase and Sale agreements executed later by explicit signatures.
        </Text>

        {model.agencyDisclosures.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>7. AGENCY DISCLOSURE</Text>
            {model.agencyDisclosures.map((d, i) => (
              <Text key={i} style={styles.para}>
                <Text style={styles.bold}>{d.label}: </Text>
                {d.text}
              </Text>
            ))}
          </>
        )}

        <View style={styles.sigBlock}>
          <Text>Accepted and Agreed:</Text>
          {model.signatureBlocks.map((s, i) => (
            <View key={i} style={{ marginTop: 20 }}>
              <Text>___________________________</Text>
              <Text style={styles.bold}>{s.name}</Text>
              <Text>{s.title}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sigBlock}>
          <Text>Sincerely,</Text>
          <Text style={{ marginTop: 24 }}>___________________________</Text>
          <Text style={styles.bold}>{model.buyerName}</Text>
          <Text>Buyer Authorized Representative</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildLOIPdf(model) {
  return renderToBuffer(<LOIPdfDocument model={model} />);
}

function LeasePdfDocument({ model }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>LETTER OF INTENT TO LEASE</Text>

        <Text style={styles.para}>
          <Text style={styles.bold}>Date: </Text>
          {model.date}
        </Text>
        <Text style={styles.para}>
          This Letter of Intent (&quot;LOI&quot;) outlines the preliminary terms and conditions under which{" "}
          {model.tenantName} (&quot;Tenant&quot;) proposes to lease the premises described herein from{" "}
          {model.landlordName} (&quot;Landlord&quot;).
        </Text>

        <Text style={styles.sectionTitle}>1. PARTIES & PREMISES</Text>
        <Text style={styles.para}>
          Landlord: {model.landlordName}. Tenant: {model.tenantName}. Premises: {model.premisesAddress},
          approximately {model.squareFootage} square feet.
        </Text>

        <Text style={styles.sectionTitle}>2. LEASE TERM & COMMENCEMENT</Text>
        <Text style={styles.para}>
          The Lease Term shall be {model.leaseTermYears} year(s), with a target Lease Commencement Date of{" "}
          {model.commencementDate}.
        </Text>

        <Text style={styles.sectionTitle}>3. BASE RENT & ESCALATIONS</Text>
        <Text style={styles.para}>
          Base Monthly Rent: ${model.baseMonthlyRent.toLocaleString("en-US", { minimumFractionDigits: 2 })}.
        </Text>
        <Text style={styles.para}>{model.escalationText}</Text>

        <Text style={styles.sectionTitle}>4. SECURITY DEPOSIT</Text>
        <Text style={styles.para}>
          Tenant shall deposit ${model.securityDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })} as a
          security deposit prior to lease commencement.
        </Text>

        <Text style={styles.sectionTitle}>5. PERMITTED USE</Text>
        <Text style={styles.para}>{model.permittedUse}</Text>

        <Text style={styles.sectionTitle}>6. TENANT IMPROVEMENTS / BUILD-OUT ALLOWANCE</Text>
        <Text style={styles.para}>
          Landlord shall provide a tenant improvement allowance of $
          {model.tiAllowance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.
        </Text>
        <Text style={styles.para}>{model.tiScopeText}</Text>

        <Text style={styles.sectionTitle}>7. RENEWAL OPTION(S)</Text>
        <Text style={styles.para}>{model.renewalText}</Text>

        <Text style={styles.sectionTitle}>8. BROKERAGE COMMISSION</Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Commission Notice: </Text>
          It is hereby mutually acknowledged and agreed that the {model.commissionPayerLabel} shall hold exclusive
          responsibility for satisfying the agent commission fee of {model.commissionSizeLabel} directly to the
          designated Brokerage Representative.
        </Text>

        <Text style={styles.sectionTitle}>9. CONDITIONS PRECEDENT</Text>
        {model.conditions.map((c, i) => (
          <View style={styles.bullet} key={i}>
            <Text style={styles.bulletDot}>•</Text>
            <RichText html={c} style={styles.bulletText} />
          </View>
        ))}

        <Text style={styles.sectionTitle}>10. NON-BINDING NATURE</Text>
        <Text style={styles.para}>
          This document outlines intent for framework architecture only and does not create enforceable leasing
          mandates. Legal bindings manifest exclusively inside a finalized, formal Lease Agreement executed later
          by explicit signatures.
        </Text>

        {model.agencyDisclosures.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>11. AGENCY DISCLOSURE</Text>
            {model.agencyDisclosures.map((d, i) => (
              <Text key={i} style={styles.para}>
                <Text style={styles.bold}>{d.label}: </Text>
                {d.text}
              </Text>
            ))}
          </>
        )}

        <View style={styles.sigBlock}>
          <Text>Accepted and Agreed:</Text>
          {model.signatureBlocks.map((s, i) => (
            <View key={i} style={{ marginTop: 20 }}>
              <Text>___________________________</Text>
              <Text style={styles.bold}>{s.name}</Text>
              <Text>{s.title}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sigBlock}>
          <Text>Sincerely,</Text>
          <Text style={{ marginTop: 24 }}>___________________________</Text>
          <Text style={styles.bold}>{model.tenantName}</Text>
          <Text>Tenant Authorized Representative</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function buildLeasePdf(model) {
  return renderToBuffer(<LeasePdfDocument model={model} />);
}

function ResidentialLeasePdfDocument({ model }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>RESIDENTIAL LEASE</Text>
        <Text style={{ textAlign: "center", marginBottom: 16, fontStyle: "italic" }}>
          (Standard Form of Lease — New Brunswick, Form 6)
        </Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Date: </Text>
          {model.date}
        </Text>

        <Text style={styles.sectionTitle}>SECTION 1 — PARTIES</Text>
        <Text style={styles.para}>
          <Text style={styles.bold}>Landlord: </Text>
          {model.landlordName}, {model.landlordAddress}, {model.landlordPhone}, {model.landlordEmail}
        </Text>
        {model.landlordHasAgent && (
          <Text style={styles.para}>
            <Text style={styles.bold}>Landlord&apos;s Agent: </Text>
            {model.landlordAgentName}
          </Text>
        )}
        <Text style={styles.para}>
          <Text style={styles.bold}>Tenant(s): </Text>
          {model.tenantNamesText}
        </Text>
        {model.tenantWantsEmergencyContacts && model.emergencyContacts.length > 0 && (
          <Text style={styles.para}>
            <Text style={styles.bold}>Emergency Contacts: </Text>
            {model.emergencyContacts.map((c) => `${c.name} — ${c.phone}`).join("; ")}
          </Text>
        )}

        <Text style={styles.sectionTitle}>SECTION 2 — PREMISES</Text>
        <Text style={styles.para}>
          Address: {model.premisesAddressText}. Type of premises: {model.premisesTypeText}.
        </Text>

        <Text style={styles.sectionTitle}>SECTION 3 — LENGTH OF TENANCY</Text>
        <Text style={styles.para}>{model.tenancyText}</Text>

        <Text style={styles.sectionTitle}>SECTION 4 — RENT</Text>
        <Text style={styles.para}>{model.rentText}</Text>
        {model.rentIncreaseText ? <Text style={styles.para}>{model.rentIncreaseText}</Text> : null}
        <Text style={styles.para}>{model.lateFeeText}</Text>
        <Text style={styles.para}>{model.servicesText}</Text>
        <Text style={styles.para}>{model.furnishingsText}</Text>

        <Text style={styles.sectionTitle}>SECTION 5 — SECURITY DEPOSIT</Text>
        <Text style={styles.para}>{model.securityDepositText}</Text>

        <Text style={styles.sectionTitle}>SECTION 6 — ASSIGNMENT</Text>
        <Text style={styles.para}>{model.assignmentText}</Text>

        {model.conditions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ADDITIONAL NOTES</Text>
            {model.conditions.map((c, i) => (
              <View style={styles.bullet} key={i}>
                <Text style={styles.bulletDot}>•</Text>
                <RichText html={c} style={styles.bulletText} />
              </View>
            ))}
          </>
        )}

        <Text style={styles.para}>
          The Landlord and Tenant have read this lease including Attachment A, provided separately as required by
          The Residential Tenancies Act. This lease is binding on and is for the benefit of the heirs, executors
          and administrators, successors and assigns of the Landlord and the Tenant.
        </Text>

        <Text style={styles.sectionTitle}>SECTION 7 — SIGNATURES</Text>
        <View style={styles.sigBlock}>
          <Text>Signature of Landlord: ___________________________  Date: ___________</Text>
        </View>
        {model.signatureBlocks.map((s, i) => (
          <View style={styles.sigBlock} key={i}>
            <Text>
              Signature of {s.title} ({s.name}): ___________________________  Date: ___________
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function buildResidentialLeasePdf(model) {
  return renderToBuffer(<ResidentialLeasePdfDocument model={model} />);
}
