"use client";

function Html({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ResidentialLeasePreview({ model }) {
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
          <div className="preview-header">Residential Lease</div>
          <p style={{ textAlign: "center", fontStyle: "italic", marginTop: -10 }}>
            (Standard Form of Lease — New Brunswick, Form 6)
          </p>

          <p>
            <strong>Date:</strong> <span className="highlight-blank">{model.date}</span>
          </p>

          <p>
            <strong>SECTION 1 — PARTIES</strong>
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

          <p>
            <strong>SECTION 2 — PREMISES</strong>
            <br />
            Address: <span className="highlight-blank">{model.premisesAddressText}</span>. Type of premises:{" "}
            <span className="highlight-blank">{model.premisesTypeText}</span>.
          </p>

          <p>
            <strong>SECTION 3 — LENGTH OF TENANCY</strong>
            <br />
            {model.tenancyText}
          </p>

          <p>
            <strong>SECTION 4 — RENT</strong>
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

          <p>
            <strong>SECTION 5 — SECURITY DEPOSIT</strong>
            <br />
            {model.securityDepositText}
          </p>

          <p>
            <strong>SECTION 6 — ASSIGNMENT</strong>
            <br />
            {model.assignmentText}
          </p>

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

          <p>
            The Landlord and Tenant have read this lease including Attachment A, provided separately as required by
            The Residential Tenancies Act. This lease is binding on and is for the benefit of the heirs, executors
            and administrators, successors and assigns of the Landlord and the Tenant.
          </p>

          <p>
            <strong>SECTION 7 — SIGNATURES</strong>
          </p>
          <p>
            Signature of Landlord: ___________________________ &nbsp;&nbsp;Date: ___________
          </p>
          {model.signatureBlocks.map((s, i) => (
            <p key={i}>
              Signature of {s.title} ({s.name}): ___________________________ &nbsp;&nbsp;Date: ___________
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
