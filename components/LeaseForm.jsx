"use client";

import SectionCard from "./SectionCard";

function calcProgress(data) {
  const checks = [
    !!data.currentDate,
    !!data.landlordName,
    !!data.tenantName,
    !!data.premisesAddress,
    !!data.leaseTermYears,
    !!data.commencementDate,
    parseFloat(data.baseMonthlyRent) > 0,
    !!data.permittedUse,
    !!data.commValue,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function WordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="9 15 12 18 15 15"/>
      <line x1="12" y1="12" x2="12" y2="18"/>
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
      <line x1="9" y1="18" x2="12" y2="18"/>
    </svg>
  );
}

function GDocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

export default function LeaseForm({ data, onChange, onExport, onClearDraft, exportState, readOnly }) {
  function set(patch) {
    onChange({ ...data, ...patch });
  }

  function addCustomClause() {
    set({ customClauses: [...(data.customClauses || []), ""] });
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

  const progress = calcProgress(data);
  const isLoading = exportState.loading;

  return (
    <div className="form-panel">
      <div className="form-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="form-panel-title">Lease LOI Workspace Engine</h1>
          <p className="form-panel-subtitle">
            Fill in the fields below — the document preview updates live and saves
            automatically to your account.{" "}
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Reset this deal to a blank form? This can't be undone.")) {
                  onClearDraft();
                }
              }}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-light)', fontSize: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset this deal
            </button>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-action btn-word"
            style={{ padding: '8px 12px', fontSize: '0.75rem' }}
            disabled={isLoading}
            onClick={() => onExport("docx")}
            title="Export Word"
          >
            {isLoading && exportState.format === "docx" ? <div className="spinner" /> : <><WordIcon /> Word</>}
          </button>
          <button
            className="btn-action btn-pdf"
            style={{ padding: '8px 12px', fontSize: '0.75rem' }}
            disabled={isLoading}
            onClick={() => onExport("pdf")}
            title="Export PDF"
          >
            {isLoading && exportState.format === "pdf" ? <div className="spinner" /> : <><PdfIcon /> PDF</>}
          </button>
          <button
            className="btn-action"
            style={{ padding: '8px 12px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', color: '#fff' }}
            disabled={isLoading}
            onClick={() => onExport("gdoc")}
            title="Export Google Doc"
          >
            {isLoading && exportState.format === "gdoc" ? <div className="spinner" /> : <><GDocIcon /> GDoc</>}
          </button>
        </div>
      </div>

      {exportState.error && (
        <div className="status-banner status-error" style={{ marginBottom: 15 }} role="alert">
          ⚠️ {exportState.error}
        </div>
      )}
      {exportState.success && (
        <div className="status-banner status-success" style={{ marginBottom: 15 }} role="status">
          ✅ {exportState.success}
        </div>
      )}

      {readOnly && (
        <div className="status-banner" style={{ marginBottom: 15, background: "var(--accent-subtle)", border: "1px solid var(--accent)" }} role="status">
          👁️ You have view-only access to this document.
        </div>
      )}

      <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0 }}>

      <div className="progress-wrap" role="status" aria-label={`Form completion: ${progress}%`}>
        <div className="progress-label">
          <span>Form Completion</span>
          <span className="progress-label-pct">{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <SectionCard icon="📅" title="Date & Parties" accent="dates" stepNum="1">
        <div className="form-group">
          <label htmlFor="currentDate">Document Date</label>
          <input
            id="currentDate"
            type="text"
            value={data.currentDate}
            onChange={(e) => set({ currentDate: e.target.value })}
            placeholder="e.g. July 21, 2026"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="landlordName">Landlord Name / Entity</label>
            <input
              id="landlordName"
              type="text"
              value={data.landlordName}
              onChange={(e) => set({ landlordName: e.target.value })}
              placeholder="e.g. Acme Properties LLC"
            />
          </div>
          <div className="form-group">
            <label htmlFor="tenantName">Tenant Name / Entity</label>
            <input
              id="tenantName"
              type="text"
              value={data.tenantName}
              onChange={(e) => set({ tenantName: e.target.value })}
              placeholder="e.g. Retail Co Inc."
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon="🏢" title="Premises" accent="type" stepNum="2">
        <div className="form-group">
          <label htmlFor="premisesAddress">Premises Address</label>
          <input
            id="premisesAddress"
            type="text"
            value={data.premisesAddress}
            onChange={(e) => set({ premisesAddress: e.target.value })}
            placeholder="456 Commerce St, Suite 100"
          />
        </div>
        <div className="form-group">
          <label htmlFor="squareFootage">Approximate Square Footage</label>
          <input
            id="squareFootage"
            type="text"
            value={data.squareFootage}
            onChange={(e) => set({ squareFootage: e.target.value })}
            placeholder="e.g. 2,500"
          />
        </div>
      </SectionCard>

      <SectionCard icon="📆" title="Lease Term & Commencement" accent="owners" stepNum="3">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="leaseTermYears">Lease Term (Years)</label>
            <input
              id="leaseTermYears"
              type="text"
              value={data.leaseTermYears}
              onChange={(e) => set({ leaseTermYears: e.target.value })}
              placeholder="e.g. 5"
            />
          </div>
          <div className="form-group">
            <label htmlFor="commencementDate">Target Commencement Date</label>
            <input
              id="commencementDate"
              type="text"
              value={data.commencementDate}
              onChange={(e) => set({ commencementDate: e.target.value })}
              placeholder="e.g. September 1, 2026"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon="💰" title="Base Rent & Escalations" accent="biz" stepNum="4">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="baseMonthlyRent">Base Monthly Rent ($)</label>
            <input
              id="baseMonthlyRent"
              type="number"
              value={data.baseMonthlyRent}
              onChange={(e) => set({ baseMonthlyRent: e.target.value })}
              placeholder="0"
              min="0"
            />
          </div>
          <div className="form-group">
            <label htmlFor="annualEscalationPct">Annual Escalation (%)</label>
            <input
              id="annualEscalationPct"
              type="text"
              value={data.annualEscalationPct}
              onChange={(e) => set({ annualEscalationPct: e.target.value })}
              placeholder="e.g. 3"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon="🔒" title="Security Deposit" accent="re" stepNum="5">
        <div className="form-group">
          <label htmlFor="securityDeposit">Security Deposit ($)</label>
          <input
            id="securityDeposit"
            type="number"
            value={data.securityDeposit}
            onChange={(e) => set({ securityDeposit: e.target.value })}
            placeholder="0"
            min="0"
          />
        </div>
      </SectionCard>

      <SectionCard icon="🏪" title="Permitted Use" accent="type" stepNum="6">
        <div className="form-group">
          <label htmlFor="permittedUse">Permitted Use Description</label>
          <input
            id="permittedUse"
            type="text"
            value={data.permittedUse}
            onChange={(e) => set({ permittedUse: e.target.value })}
            placeholder="e.g. General retail sales"
          />
        </div>
      </SectionCard>

      <SectionCard icon="🛠️" title="Tenant Improvements / Build-Out Allowance" accent="biz" stepNum="7">
        <div className="form-group">
          <label htmlFor="tiAllowance">TI Allowance ($)</label>
          <input
            id="tiAllowance"
            type="number"
            value={data.tiAllowance}
            onChange={(e) => set({ tiAllowance: e.target.value })}
            placeholder="0"
            min="0"
          />
        </div>
        <div className="form-group">
          <label htmlFor="tiScopeText">Scope of Work (optional)</label>
          <input
            id="tiScopeText"
            type="text"
            value={data.tiScopeText}
            onChange={(e) => set({ tiScopeText: e.target.value })}
            placeholder="e.g. Flooring, lighting, and fixture installation"
          />
        </div>
      </SectionCard>

      <SectionCard icon="🔁" title="Renewal Option(s)" accent="owners" stepNum="8">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="renewalOptionCount">Number of Options</label>
            <input
              id="renewalOptionCount"
              type="text"
              value={data.renewalOptionCount}
              onChange={(e) => set({ renewalOptionCount: e.target.value.replace(/[^0-9]/g, "") })}
              placeholder="e.g. 2"
            />
          </div>
          <div className="form-group">
            <label htmlFor="renewalOptionYears">Years per Option</label>
            <input
              id="renewalOptionYears"
              type="text"
              value={data.renewalOptionYears}
              onChange={(e) => set({ renewalOptionYears: e.target.value })}
              placeholder="e.g. 5"
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="renewalRentBasis">Renewal Rent Basis</label>
          <input
            id="renewalRentBasis"
            type="text"
            value={data.renewalRentBasis}
            onChange={(e) => set({ renewalRentBasis: e.target.value })}
            placeholder="e.g. Fair Market Value"
          />
        </div>
      </SectionCard>

      <SectionCard icon="🤝" title="Brokerage Commission" accent="owners" stepNum="9">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="commPayer">Commission Obligation Party</label>
            <select
              id="commPayer"
              value={data.commPayer}
              onChange={(e) => set({ commPayer: e.target.value })}
            >
              <option value="Landlord">Landlord</option>
              <option value="Tenant">Tenant</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="commType">Commission Structure Unit</label>
            <select
              id="commType"
              value={data.commType}
              onChange={(e) => set({ commType: e.target.value })}
            >
              <option value="$">Fixed Amount ($)</option>
              <option value="%">Percentage (%)</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="commValue">Commission Settlement Pricing Size</label>
          <input
            id="commValue"
            type="text"
            value={data.commValue}
            onChange={(e) => set({ commValue: e.target.value })}
            placeholder={data.commType === "%" ? "e.g. 5" : "e.g. 15000"}
          />
        </div>

        <div className="card-divider" />

        <p className="custom-clauses-header">Agency / Representation Disclosure (optional)</p>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          Fill in any that apply — each one adds an Agency Disclosure section to the exported document.
        </p>

        <div className="form-group">
          <label htmlFor="landlordRepText">Landlord&apos;s Representative</label>
          <input
            id="landlordRepText"
            type="text"
            value={data.landlordRepText}
            onChange={(e) => set({ landlordRepText: e.target.value })}
            placeholder="e.g. Jane Doe, ABC Realty, represents the Landlord exclusively"
          />
        </div>
        <div className="form-group">
          <label htmlFor="tenantRepText">Tenant&apos;s Representative</label>
          <input
            id="tenantRepText"
            type="text"
            value={data.tenantRepText}
            onChange={(e) => set({ tenantRepText: e.target.value })}
            placeholder="e.g. John Roe, XYZ Brokerage, represents the Tenant exclusively"
          />
        </div>
        <div className="form-group">
          <label htmlFor="dualAgencyText">Dual Agency</label>
          <input
            id="dualAgencyText"
            type="text"
            value={data.dualAgencyText}
            onChange={(e) => set({ dualAgencyText: e.target.value })}
            placeholder="e.g. Both parties consent to dual agency representation by ABC Realty"
          />
        </div>
      </SectionCard>

      <SectionCard icon="🛡️" title="Conditions Precedent" accent="risk" stepNum="10">
        <div
          className="checkbox-group"
          onClick={() => set({ edgeInspection: !data.edgeInspection })}
          role="checkbox"
          aria-checked={data.edgeInspection}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ edgeInspection: !data.edgeInspection })}
        >
          <input
            type="checkbox"
            id="edgeInspection"
            checked={data.edgeInspection}
            onChange={(e) => set({ edgeInspection: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="edgeInspection">Tenant&apos;s Satisfactory Inspection of the Premises</label>
        </div>
        <div
          className="checkbox-group"
          onClick={() => set({ edgeZoning: !data.edgeZoning })}
          role="checkbox"
          aria-checked={data.edgeZoning}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ edgeZoning: !data.edgeZoning })}
        >
          <input
            type="checkbox"
            id="edgeZoning"
            checked={data.edgeZoning}
            onChange={(e) => set({ edgeZoning: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="edgeZoning">Verification of Zoning / Permitted Use Compliance</label>
        </div>
        <div
          className="checkbox-group"
          onClick={() => set({ edgeFinancials: !data.edgeFinancials })}
          role="checkbox"
          aria-checked={data.edgeFinancials}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ edgeFinancials: !data.edgeFinancials })}
        >
          <input
            type="checkbox"
            id="edgeFinancials"
            checked={data.edgeFinancials}
            onChange={(e) => set({ edgeFinancials: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="edgeFinancials">Landlord&apos;s Review of Tenant&apos;s Financial Statements</label>
        </div>

        <div className="card-divider" />

        <p className="custom-clauses-header">Additional Custom Conditions</p>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          e.g. Guarantor Requirements, Existing Tenant Vacancy
        </p>

        {(data.customClauses || []).map((c, i) => (
          <div className="custom-clause-row" key={i}>
            <input
              type="text"
              value={c}
              onChange={(e) => setCustomClause(i, e.target.value)}
              placeholder="Enter custom condition or clause…"
              aria-label={`Custom clause ${i + 1}`}
            />
            <button
              type="button"
              className="btn-remove-clause"
              onClick={() => removeCustomClause(i)}
              aria-label={`Remove custom clause ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-add-clause" onClick={addCustomClause}>
          + Add Custom Condition Clause
        </button>
      </SectionCard>

      </fieldset>

      <div className="legal-disclaimer" role="note" style={{ marginTop: 20 }}>
        <strong>⚠️ Legal Notice:</strong> This tool generates non-binding letters of intent, not final legal contracts.
        This document is clearly labeled as non-binding (Section 10). This is not a substitute for legal advice
        and does not constitute legal services. Consult a qualified attorney before executing binding agreements.
      </div>
    </div>
  );
}
