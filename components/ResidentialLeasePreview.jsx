"use client";

import EditableSpan from "./EditableSpan";
import { mapCustomClauseConditions } from "../lib/customClauseMapping";

function Html({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// See components/LOIPreview.jsx's header comment for the editable/computed
// split rule. Almost every field in lib/residentialLeaseEngine.js's model
// is a composed sentence joining several raw inputs at once (rentText,
// tenancyText, premisesAddressText, etc.) with no single field an edit
// could write back to -- documentTitle, date, and custom clauses are the
// only genuinely 1:1 raw fields this document type's model exposes, so
// those are the only ones made editable here.
export default function ResidentialLeasePreview({ model, data, onEdit, readOnly }) {
  const editable = !!data && !!onEdit && !readOnly;

  function set(patch) {
    onEdit({ ...data, ...patch });
  }

  function addCustomClause() {
    set({ customClauses: [...(data.customClauses || []), "New clause -- click to edit."] });
  }
  function setCustomClause(index, value) {
    const customClauses = data.customClauses.slice();
    customClauses[index] = value;
    set({ customClauses });
  }
  function removeCustomClause(index) {
    const customClauses = data.customClauses.slice();
    customClauses.splice(index, 1);
    set({ customClauses });
  }

  const { fixedCount, clauseIndices } = editable
    ? mapCustomClauseConditions(model.conditions.length, data.customClauses)
    : { fixedCount: model.conditions.length, clauseIndices: [] };

  return (
    <div className="preview-panel">
      <div className="document-paper">
        <div id="loi-content">
          <div className="preview-header">
            {editable ? (
              <EditableSpan value={data.documentTitle} onCommit={(v) => set({ documentTitle: v })} placeholder={model.documentTitle} />
            ) : (
              model.documentTitle
            )}
          </div>
          <p style={{ textAlign: "center", fontStyle: "italic", marginTop: -10 }}>
            (Standard Form of Lease — New Brunswick, Form 6)
          </p>

          <p>
            <strong>Date:</strong>{" "}
            {editable ? (
              <EditableSpan className="highlight-blank" value={data.currentDate} onCommit={(v) => set({ currentDate: v })} />
            ) : (
              <span className="highlight-blank">{model.date}</span>
            )}
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
                {model.conditions.map((c, i) => {
                  const clauseIdx = i >= fixedCount ? clauseIndices[i - fixedCount] : null;
                  return (
                    <li key={i} className={clauseIdx != null ? "editable-clause-row" : undefined}>
                      {clauseIdx != null ? (
                        <>
                          <EditableSpan value={data.customClauses[clauseIdx]} onCommit={(v) => setCustomClause(clauseIdx, v)} />
                          <button type="button" className="editable-remove-btn" onClick={() => removeCustomClause(clauseIdx)} title="Remove clause">
                            ×
                          </button>
                        </>
                      ) : (
                        <Html html={c} />
                      )}
                    </li>
                  );
                })}
              </ul>
              {editable && (
                <button type="button" className="editable-add-btn" onClick={addCustomClause}>
                  + Add clause
                </button>
              )}
            </>
          )}
          {editable && model.conditions.length === 0 && (
            <button type="button" className="editable-add-btn" onClick={addCustomClause}>
              + Add note
            </button>
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
