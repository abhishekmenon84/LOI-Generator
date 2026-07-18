"use client";

function Html({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function LOIPreview({ model }) {
  return (
    <div className="preview-panel">
      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="preview-toolbar" aria-label="Preview panel">
        <div className="preview-toolbar-badge">
          <span className="preview-toolbar-live-dot" aria-hidden="true" />
          Live Preview
        </div>
        <span className="preview-toolbar-label">Updates in real-time as you type</span>
        <span className="preview-toolbar-icon" aria-hidden="true">📄</span>
      </div>

      {/* ── Document Paper ────────────────────────────────── */}
      <div className="document-paper">
        <div id="loi-content">
          <div className="preview-header">Letter of Intent to Purchase</div>

          <p>
            <strong>Date:</strong> <span className="highlight-blank">{model.date}</span>
          </p>
          <p>
            <strong>TO:</strong> <span className="highlight-blank">{model.sellerText}</span>
            <br />
            <strong>RE:</strong> <span className="highlight-blank">{model.reSubject}</span>
          </p>
          <p>Dear <span className="highlight-blank">{model.salutation}</span>,</p>

          <p>
            This Letter of Intent (&quot;LOI&quot;) outlines the preliminary terms and conditions under which{" "}
            <span className="highlight-blank">{model.buyerName}</span> (&quot;Buyer&quot;) proposes to execute the
            purchase of designated strategic assets and property from the corporate and individual entities currently
            holding interest as detailed herein (&quot;Sellers&quot;).
          </p>

          <p>
            <strong>1. ASSETS TO BE ACQUIRED AND TRANSACTION SCOPE</strong>
            <br />
            The transaction comprises the purchase of the following assets (collectively, the &quot;Assets&quot;):
          </p>
          <ul style={{ paddingLeft: 20 }}>
            {model.inclusionPoints.map((p, i) => (
              <li key={i} style={p.flag ? { color: "#c0392b", listStyleType: "square" } : undefined}>
                <Html html={p.html} />
              </li>
            ))}
          </ul>

          <p>
            <strong>2. PURCHASE PRICE AND ALLOCATION</strong>
            <br />
            The proposed aggregate contract purchase value is{" "}
            <strong>
              $
              <span className="highlight-blank">
                {model.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{" "}
              (<span className="highlight-blank">{model.grandTotalWords}</span>)
            </strong>
            , with financial allocation structures detailed explicitly below:
          </p>

          <table className="preview-table">
            <tbody>
              {model.allocationRows.map((row, i) => (
                <tr key={i} className={row.total ? "total" : undefined}>
                  <td style={row.total ? undefined : { fontStyle: "italic" }}>{row.label}</td>
                  <td>${row.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p><strong>3. BROKERAGE COMMISSION ARRANGEMENTS</strong></p>
          <div style={{ border: "1px solid #aaa", padding: 12, marginBottom: 15, background: "rgba(0,0,0,0.02)" }}>
            <strong>Commission Notice:</strong> It is hereby mutually acknowledged and agreed that the{" "}
            <strong>{model.commissionPayerLabel}</strong> shall hold exclusive responsibility for satisfying the agent
            commission fee of <strong>{model.commissionSizeLabel}</strong> directly to the designated Brokerage
            Representative. The opposing principal party shall possess zero liability or performance obligations
            regarding this specific representative transaction element.
          </div>

          <p>
            <strong>4. CONFIDENTIALITY</strong>
            <br />
            Both Buyer and Sellers agree that all financial details, operational frameworks, and negotiation tracks tied
            to this potential asset acquisition remain strictly confidential and shall not be released to unapproved
            external parties without execution of written consent.
          </p>

          <p>
            <strong>5. CONDITIONS PRECEDENT AND STRATEGIC PROTECTIONS</strong>
            <br />
            Final commercial transaction execution and asset transitions remain contingent upon satisfactory
            satisfaction of the following structural checkpoints within 45 days of LOI signing:
          </p>
          <ul style={{ paddingLeft: 20 }}>
            {model.conditions.map((c, i) => (
              <li key={i}>
                <Html html={c} />
              </li>
            ))}
          </ul>

          <p>
            <strong>6. NON-BINDING NATURE</strong>
            <br />
            This document outlines intent for framework architecture only. Excepting the structural Confidentiality
            covenants, this LOI does not create enforceable closing mandates. Legal bindings manifest exclusively inside
            finalized, formal Purchase and Sale agreements executed later by explicit signatures.
          </p>

          {model.agencyDisclosures.length > 0 && (
            <p>
              <strong>7. AGENCY DISCLOSURE</strong>
              <br />
              {model.agencyDisclosures.map((d, i) => (
                <span key={i}>
                  <strong>{d.label}:</strong> {d.text}
                  {i < model.agencyDisclosures.length - 1 && <br />}
                </span>
              ))}
            </p>
          )}

          <br />
          <table style={{ width: "100%", border: "none" }}>
            <tbody>
              <tr>
                <td style={{ width: "50%", border: "none", verticalAlign: "top" }}>
                  <p>Accepted and Agreed:</p>
                  <br />
                  {model.signatureBlocks.map((s, i) => (
                    <p key={i}>
                      ___________________________
                      <br />
                      <strong>{s.name}</strong>
                      <br />
                      {s.title}
                    </p>
                  ))}
                </td>
                <td style={{ width: "50%", border: "none", verticalAlign: "top" }}>
                  <p>Sincerely,</p>
                  <br />
                  <p>
                    ___________________________
                    <br />
                    <strong>{model.buyerName}</strong>
                    <br />
                    Buyer Authorized Representative
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
