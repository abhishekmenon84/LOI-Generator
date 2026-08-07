"use client";

import EditableSpan from "./EditableSpan";
import { mapCustomClauseConditions } from "../lib/customClauseMapping";

function Html({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// See components/LOIPreview.jsx's header comment for the editable/computed
// split rule this follows -- `data`/`onEdit`/`readOnly` optional, computed
// text (escalationText/renewalText/commission labels/agencyDisclosures)
// stays display-only since it's built from more than one field.
export default function LeasePreview({ model, data, onEdit, readOnly }) {
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

  function Field({ field, className }) {
    return editable ? (
      <EditableSpan className={className} value={data[field]} onCommit={(v) => set({ [field]: v })} />
    ) : (
      <span className={className}>{model[field]}</span>
    );
  }

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

          <p>
            <strong>Date:</strong> <Field field="currentDate" className="highlight-blank" />
          </p>

          <p>
            This Letter of Intent (&quot;LOI&quot;) outlines the preliminary terms and conditions under which{" "}
            <Field field="tenantName" className="highlight-blank" /> (&quot;Tenant&quot;) proposes to lease the
            premises described herein from <Field field="landlordName" className="highlight-blank" />{" "}
            (&quot;Landlord&quot;).
          </p>

          {model.sectionEnabled.parties && (
            <p>
              <strong>{model.headings.parties}</strong>
              <br />
              Landlord: <Field field="landlordName" className="highlight-blank" />. Tenant:{" "}
              <Field field="tenantName" className="highlight-blank" />. Premises:{" "}
              <Field field="premisesAddress" className="highlight-blank" />, approximately{" "}
              <Field field="squareFootage" className="highlight-blank" /> square feet.
            </p>
          )}

          {model.sectionEnabled.term && (
            <p>
              <strong>{model.headings.term}</strong>
              <br />
              The Lease Term shall be <Field field="leaseTermYears" className="highlight-blank" /> year(s), with a
              target Lease Commencement Date of <Field field="commencementDate" className="highlight-blank" />.
            </p>
          )}

          {model.sectionEnabled.rent && (
            <p>
              <strong>{model.headings.rent}</strong>
              <br />
              Base Monthly Rent: $
              {editable ? (
                <EditableSpan className="highlight-blank" value={String(data.baseMonthlyRent ?? "")} onCommit={(v) => set({ baseMonthlyRent: v })} />
              ) : (
                <span className="highlight-blank">
                  {model.baseMonthlyRent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              )}
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
              {editable ? (
                <EditableSpan className="highlight-blank" value={String(data.securityDeposit ?? "")} onCommit={(v) => set({ securityDeposit: v })} />
              ) : (
                <span className="highlight-blank">
                  {model.securityDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              )}{" "}
              as a security deposit prior to lease commencement.
            </p>
          )}

          {model.sectionEnabled.use && (
            <p>
              <strong>{model.headings.use}</strong>
              <br />
              <Field field="permittedUse" className="highlight-blank" />
            </p>
          )}

          {model.sectionEnabled.ti && (
            <p>
              <strong>{model.headings.ti}</strong>
              <br />
              Landlord shall provide a tenant improvement allowance of $
              {editable ? (
                <EditableSpan className="highlight-blank" value={String(data.tiAllowance ?? "")} onCommit={(v) => set({ tiAllowance: v })} />
              ) : (
                <span className="highlight-blank">
                  {model.tiAllowance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              )}
              .
              <br />
              {editable ? (
                <EditableSpan value={data.tiScopeText} onCommit={(v) => set({ tiScopeText: v })} placeholder="Tenant improvement scope" />
              ) : (
                model.tiScopeText
              )}
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
