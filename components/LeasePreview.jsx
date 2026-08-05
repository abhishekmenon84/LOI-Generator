"use client";

function Html({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function LeasePreview({ model }) {
  return (
    <div className="preview-panel">
      <div className="document-paper">
        <div id="loi-content">
          <div className="preview-header">{model.documentTitle}</div>

          <p>
            <strong>Date:</strong> <span className="highlight-blank">{model.date}</span>
          </p>

          <p>
            This Letter of Intent (&quot;LOI&quot;) outlines the preliminary terms and conditions under which{" "}
            <span className="highlight-blank">{model.tenantName}</span> (&quot;Tenant&quot;) proposes to lease the
            premises described herein from <span className="highlight-blank">{model.landlordName}</span>{" "}
            (&quot;Landlord&quot;).
          </p>

          {model.sectionEnabled.parties && (
            <p>
              <strong>{model.headings.parties}</strong>
              <br />
              Landlord: <span className="highlight-blank">{model.landlordName}</span>. Tenant:{" "}
              <span className="highlight-blank">{model.tenantName}</span>. Premises:{" "}
              <span className="highlight-blank">{model.premisesAddress}</span>, approximately{" "}
              <span className="highlight-blank">{model.squareFootage}</span> square feet.
            </p>
          )}

          {model.sectionEnabled.term && (
            <p>
              <strong>{model.headings.term}</strong>
              <br />
              The Lease Term shall be <span className="highlight-blank">{model.leaseTermYears}</span> year(s), with a
              target Lease Commencement Date of <span className="highlight-blank">{model.commencementDate}</span>.
            </p>
          )}

          {model.sectionEnabled.rent && (
            <p>
              <strong>{model.headings.rent}</strong>
              <br />
              Base Monthly Rent: $
              <span className="highlight-blank">
                {model.baseMonthlyRent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              .
              <br />
              {model.escalationText}
            </p>
          )}

          {model.sectionEnabled.deposit && (
            <p>
              <strong>{model.headings.deposit}</strong>
              <br />
              Tenant shall deposit $
              <span className="highlight-blank">
                {model.securityDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>{" "}
              as a security deposit prior to lease commencement.
            </p>
          )}

          {model.sectionEnabled.use && (
            <p>
              <strong>{model.headings.use}</strong>
              <br />
              <span className="highlight-blank">{model.permittedUse}</span>
            </p>
          )}

          {model.sectionEnabled.ti && (
            <p>
              <strong>{model.headings.ti}</strong>
              <br />
              Landlord shall provide a tenant improvement allowance of $
              <span className="highlight-blank">
                {model.tiAllowance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              .
              <br />
              {model.tiScopeText}
            </p>
          )}

          {model.sectionEnabled.renewal && (
            <p>
              <strong>{model.headings.renewal}</strong>
              <br />
              {model.renewalText}
            </p>
          )}

          {model.sectionEnabled.commission && (
            <>
              <p><strong>{model.headings.commission}</strong></p>
              <div style={{ border: "1px solid #aaa", padding: 12, marginBottom: 15, background: "rgba(0,0,0,0.02)" }}>
                <strong>Commission Notice:</strong> It is hereby mutually acknowledged and agreed that the{" "}
                <strong>{model.commissionPayerLabel}</strong> shall hold exclusive responsibility for satisfying the agent
                commission fee of <strong>{model.commissionSizeLabel}</strong> directly to the designated Brokerage
                Representative.
              </div>
            </>
          )}

          {model.sectionEnabled.conditions && (
            <>
              <p>
                <strong>{model.headings.conditions}</strong>
              </p>
              <ul style={{ paddingLeft: 20 }}>
                {model.conditions.map((c, i) => (
                  <li key={i}>
                    <Html html={c} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {model.sectionEnabled.nonBinding && (
            <p>
              <strong>{model.headings.nonBinding}</strong>
              <br />
              This document outlines intent for framework architecture only and does not create enforceable leasing
              mandates. Legal bindings manifest exclusively inside a finalized, formal Lease Agreement executed later
              by explicit signatures.
            </p>
          )}

          {model.sectionEnabled.agency && (
            <p>
              <strong>{model.headings.agency}</strong>
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
