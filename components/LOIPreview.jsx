"use client";

import EditableSpan from "./EditableSpan";
import { mapCustomClauseConditions } from "../lib/customClauseMapping";

function Html({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// `data`/`onEdit`/`readOnly` are optional -- omitting them (as the
// docx/pdf export code paths never pass them) renders exactly the old
// read-only preview. When present, spans backed by a single raw form
// field (documentTitle, date, buyerName, property rows, custom clauses)
// become click-to-edit; computed/derived text (grand total, its word-form
// spelling, the reSubject/salutation/signature-block sentences built from
// several fields at once) stays display-only -- there is no single field
// an edit to those could unambiguously write back to.
export default function LOIPreview({ model, data, onEdit, readOnly }) {
  const editable = !!data && !!onEdit && !readOnly;

  function set(patch) {
    onEdit({ ...data, ...patch });
  }

  function setProperty(index, patch) {
    const properties = data.properties.slice();
    properties[index] = { ...properties[index], ...patch };
    set({ properties });
  }

  function removeProperty(index) {
    const properties = data.properties.slice();
    properties.splice(index, 1);
    set({ properties });
  }

  function addProperty() {
    set({ properties: [...(data.properties || []), { address: "", value: 0 }] });
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
      {/* ── Document Paper ────────────────────────────────── */}
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
            <strong>Date:</strong>{" "}
            {editable ? (
              <EditableSpan className="highlight-blank" value={data.currentDate} onCommit={(v) => set({ currentDate: v })} />
            ) : (
              <span className="highlight-blank">{model.date}</span>
            )}
          </p>
          <p>
            <strong>TO:</strong> <span className="highlight-blank">{model.sellerText}</span>
            <br />
            <strong>RE:</strong> <span className="highlight-blank">{model.reSubject}</span>
          </p>
          <p>Dear <span className="highlight-blank">{model.salutation}</span>,</p>

          <p>
            This Letter of Intent (&quot;LOI&quot;) outlines the preliminary terms and conditions under which{" "}
            {editable ? (
              <EditableSpan className="highlight-blank" value={data.buyerName} onCommit={(v) => set({ buyerName: v })} />
            ) : (
              <span className="highlight-blank">{model.buyerName}</span>
            )}{" "}
            (&quot;Buyer&quot;) proposes to execute the purchase of designated strategic assets and property from the
            corporate and individual entities currently holding interest as detailed herein (&quot;Sellers&quot;).
          </p>

          {model.sectionEnabled.assets && (
            <>
              <p>
                <strong>{model.headings.assets}</strong>
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
            </>
          )}

          {model.sectionEnabled.price && (
            <>
              <p>
                <strong>{model.headings.price}</strong>
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
                      {editable && row.source === "property" ? (
                        <>
                          <td style={{ fontStyle: "italic" }}>
                            <EditableSpan
                              value={data.properties[row.index]?.address || ""}
                              onCommit={(v) => setProperty(row.index, { address: v })}
                              placeholder="Property address"
                            />
                          </td>
                          <td>
                            $
                            <EditableSpan
                              value={String(data.properties[row.index]?.value ?? "")}
                              onCommit={(v) => setProperty(row.index, { value: v })}
                              placeholder="0.00"
                            />
                            <button type="button" className="editable-remove-btn" onClick={() => removeProperty(row.index)} title="Remove property">
                              ×
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={row.total ? undefined : { fontStyle: "italic" }}>{row.label}</td>
                          <td>${row.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {editable && model.sectionEnabled.price && data.includeRealEstate && (
                <button type="button" className="editable-add-btn" onClick={addProperty}>
                  + Add property
                </button>
              )}
            </>
          )}

          {model.sectionEnabled.commission && (
            <>
              <p><strong>{model.headings.commission}</strong></p>
              <div style={{ border: "1px solid #aaa", padding: 12, marginBottom: 15, background: "rgba(0,0,0,0.02)" }}>
                <strong>Commission Notice:</strong> It is hereby mutually acknowledged and agreed that the{" "}
                <strong>{model.commissionPayerLabel}</strong> shall hold exclusive responsibility for satisfying the agent
                commission fee of <strong>{model.commissionSizeLabel}</strong> directly to the designated Brokerage
                Representative. The opposing principal party shall possess zero liability or performance obligations
                regarding this specific representative transaction element.
              </div>
            </>
          )}

          {model.sectionEnabled.confidentiality && (
            <p>
              <strong>{model.headings.confidentiality}</strong>
              <br />
              Both Buyer and Sellers agree that all financial details, operational frameworks, and negotiation tracks tied
              to this potential asset acquisition remain strictly confidential and shall not be released to unapproved
              external parties without execution of written consent.
            </p>
          )}

          {model.sectionEnabled.conditions && (
            <>
              <p>
                <strong>{model.headings.conditions}</strong>
                <br />
                Final commercial transaction execution and asset transitions remain contingent upon satisfactory
                satisfaction of the following structural checkpoints within 45 days of LOI signing:
              </p>
              <ul style={{ paddingLeft: 20 }}>
                {model.conditions.map((c, i) => {
                  const clauseIdx = i >= fixedCount ? clauseIndices[i - fixedCount] : null;
                  return (
                    <li key={i} className={clauseIdx != null ? "editable-clause-row" : undefined}>
                      {clauseIdx != null ? (
                        <>
                          <EditableSpan
                            value={data.customClauses[clauseIdx]}
                            onCommit={(v) => setCustomClause(clauseIdx, v)}
                          />
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
              This document outlines intent for framework architecture only. Excepting the structural Confidentiality
              covenants, this LOI does not create enforceable closing mandates. Legal bindings manifest exclusively inside
              finalized, formal Purchase and Sale agreements executed later by explicit signatures.
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
