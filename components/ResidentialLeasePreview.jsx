"use client";

function Html({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ResidentialLeasePreview({ model }) {
  return (
    <div className="preview-panel">
      <div className="document-paper">
        <div id="loi-content">
          <div className="preview-header">{model.documentTitle}</div>
          <p style={{ textAlign: "center", fontStyle: "italic", marginTop: -10 }}>
            (Standard Form of Lease — New Brunswick, Form 6)
          </p>

          <p>
            <strong>Date:</strong> <span className="highlight-blank">{model.date}</span>
          </p>

          {model.sectionEnabled.parties && (
            <p>
              <strong>{model.headings.parties}</strong>
              <br />
              Landlord: <span className="highlight-blank">{model.landlordName}</span>,{" "}
              <span className="highlight-blank">{model.landlordAddress}</span>,{" "}
              <span className="highlight-blank">{model.landlordPhone}</span>,{" "}
              <span className="highlight-blank">{model.landlordEmail}</span>
              {model.landlordHasAgent && (
                <>
                  <br />
                  Landlord&apos;s Agent: <span className="highlight-blank">{model.landlordAgentName}</span>
                </>
              )}
              <br />
              Tenant(s): <span className="highlight-blank">{model.tenantNamesText}</span>
              {model.tenantWantsEmergencyContacts && model.emergencyContacts.length > 0 && (
                <>
                  <br />
                  Emergency Contacts:{" "}
                  {model.emergencyContacts.map((c, i) => (
                    <span key={i}>
                      {c.name} — {c.phone}
                      {i < model.emergencyContacts.length - 1 ? "; " : ""}
                    </span>
                  ))}
                </>
              )}
            </p>
          )}

          {model.sectionEnabled.premises && (
            <p>
              <strong>{model.headings.premises}</strong>
              <br />
              Address: <span className="highlight-blank">{model.premisesAddressText}</span>. Type of premises:{" "}
              <span className="highlight-blank">{model.premisesTypeText}</span>.
            </p>
          )}

          {model.sectionEnabled.tenancy && (
            <p>
              <strong>{model.headings.tenancy}</strong>
              <br />
              {model.tenancyText}
            </p>
          )}

          {model.sectionEnabled.rent && (
            <p>
              <strong>{model.headings.rent}</strong>
              <br />
              {model.rentText}
              {model.rentIncreaseText && (
                <>
                  <br />
                  {model.rentIncreaseText}
                </>
              )}
              <br />
              {model.lateFeeText}
              <br />
              {model.servicesText}
              <br />
              {model.furnishingsText}
            </p>
          )}

          {model.sectionEnabled.deposit && (
            <p>
              <strong>{model.headings.deposit}</strong>
              <br />
              {model.securityDepositText}
            </p>
          )}

          {model.sectionEnabled.assignment && (
            <p>
              <strong>{model.headings.assignment}</strong>
              <br />
              {model.assignmentText}
            </p>
          )}

          {model.conditions.length > 0 && (
            <>
              <p>
                <strong>ADDITIONAL NOTES</strong>
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

          {model.sectionEnabled.signatures && (
            <>
              <p>
                The Landlord and Tenant have read this lease including Attachment A, provided separately as required by
                The Residential Tenancies Act. This lease is binding on and is for the benefit of the heirs, executors
                and administrators, successors and assigns of the Landlord and the Tenant.
              </p>

              <p>
                <strong>{model.headings.signatures}</strong>
              </p>
              <p>
                Signature of Landlord: ___________________________ &nbsp;&nbsp;Date: ___________
              </p>
              {model.signatureBlocks.map((s, i) => (
                <p key={i}>
                  Signature of {s.title} ({s.name}): ___________________________ &nbsp;&nbsp;Date: ___________
                </p>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
