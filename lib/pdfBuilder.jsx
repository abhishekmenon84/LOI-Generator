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

        <View style={styles.sigBlock}>
          <Text>Sincerely,</Text>
          <Text style={{ marginTop: 24 }}>___________________________</Text>
          <Text style={styles.bold}>{model.buyerName}</Text>
          <Text>Buyer Authorized Representative</Text>
        </View>

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
      </Page>
    </Document>
  );
}

export async function buildLOIPdf(model) {
  return renderToBuffer(<LOIPdfDocument model={model} />);
}
