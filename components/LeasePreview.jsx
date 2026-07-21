"use client";

function Html({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function LeasePreview({ model }) {
  return (
    <div className="preview-panel">
      <div className="preview-toolbar" aria-label="Preview panel">
        <div className="preview-toolbar-badge">
          <span className="preview-toolbar-live-dot" aria-hidden="true" />
          Live Preview
        </div>
        <span className="preview-toolbar-label">Updates in real-time as you type</span>
        <span className="preview-toolbar-icon" aria-hidden="true">📄</span>
      </div>

      <div className="document-paper">
        <div id="loi-content">
          <div className="preview-header">Letter of Intent to Lease</div>

          <p>
            <strong>Date:</strong> <span className="highlight-blank">{model.date}</span>
          </p>

          <p>
            This Letter of Intent (&quot;LOI&quot;) outlines the preliminary terms and conditions under which{" "}
            <span className="highlight-blank">{model.tenantName}</span> (&quot;Tenant&quot;) proposes to lease the
            premises described herein from <span className="highlight-blank">{model.landlordName}</span>{" "}
            (&quot;Landlord&quot;).
          </p>

          <p>
            <strong>1. PARTIES &amp; PREMISES</strong>
            <br />
            Landlord: <span className="highlight-blank">{model.landlordName}</span>. Tenant:{" "}
            <span className="highlight-blank">{model.tenantName}</span>. Premises:{" "}
            <span className="highlight-blank">{model.premisesAddress}</span>, approximately{" "}
            <span className="highlight-blank">{model.squareFootage}</span> square feet.
          </p>

          <p>
            <strong>2. LEASE TERM &amp; COMMENCEMENT</strong>
            <br />
            The Lease Term shall be <span className="highlight-blank">{model.leaseTermYears}</span> year(s), with a
            target Lease Commencement Date of <span className="highlight-blank">{model.commencementDate}</span>.
          </p>

          <p>
            <strong>3. BASE RENT &amp; ESCALATIONS</strong>
            <br />
            Base Monthly Rent: $
            <span className="highlight-blank">
              {model.baseMonthlyRent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            .
            <br />
            {model.escalationText}
          </p>

          <p>
            <strong>4. SECURITY DEPOSIT</strong>
            <br />
            Tenant shall deposit $
            <span className="highlight-blank">
              {model.securityDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>{" "}
            as a security deposit prior to lease commencement.
          </p>

          <p>
            <strong>5. PERMITTED USE</strong>
            <br />
            <span className="highlight-blank">{model.permittedUse}</span>
          </p>

          <p>
            <strong>6. TENANT IMPROVEMENTS / BUILD-OUT ALLOWANCE</strong>
            <br />
            Landlord shall provide a tenant improvement allowance of $
            <span className="highlight-blank">
              {model.tiAllowance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            .
            <br />
            {model.tiScopeText}
          </p>

          <p>
            <strong>7. RENEWAL OPTION(S)</strong>
            <br />
            {model.renewalText}
          </p>

          <p><strong>8. BROKERAGE COMMISSION</strong></p>
          <div style={{ border: "1px solid #aaa", padding: 12, marginBottom: 15, background: "rgba(0,0,0,0.02)" }}>
            <strong>Commission Notice:</strong> It is hereby mutually acknowledged and agreed that the{" "}
            <strong>{model.commissionPayerLabel}</strong> shall hold exclusive responsibility for satisfying the agent
            commission fee of <strong>{model.commissionSizeLabel}</strong> directly to the designated Brokerage
            Representative.
          </div>

          <p>
            <strong>9. CONDITIONS PRECEDENT</strong>
          </p>
          <ul style={{ paddingLeft: 20 }}>
            {model.conditions.map((c, i) => (
              <li key={i}>
                <Html html={c} />
              </li>
            ))}
          </ul>

          <p>
            <strong>10. NON-BINDING NATURE</strong>
            <br />
            This document outlines intent for framework architecture only and does not create enforceable leasing
            mandates. Legal bindings manifest exclusively inside a finalized, formal Lease Agreement executed later
            by explicit signatures.
          </p>

          {model.agencyDisclosures.length > 0 && (
            <p>
              <strong>11. AGENCY DISCLOSURE</strong>
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
                    <strong>{model.tenantName}</strong>
                    <br />
                    Tenant Authorized Representative
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
