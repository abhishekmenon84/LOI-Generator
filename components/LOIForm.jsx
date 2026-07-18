"use client";

import SectionCard from "./SectionCard";

const BASE_PROPERTY_VALUES = [350000, 250000, 150000, 100000];

/* ── Progress calculation ────────────────────────────────── */
function calcProgress(data) {
  const checks = [
    !!data.currentDate,
    !!data.closingDate,
    data.includeRealEstate || data.includeBusinessOps,
    data.jointOwnership
      ? !!data.sellerNames
      : !!(data.businessSellerName || data.propertySellerName),
    !!data.buyerName,
    !!data.commercialType,
    !data.includeRealEstate || data.properties.some((p) => p.address && parseFloat(p.value) > 0),
    !data.includeBusinessOps || parseFloat(data.businessValue) > 0,
    !!data.commValue,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

/* ── Word icon SVG ───────────────────────────────────────── */
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

/* ── PDF icon SVG ────────────────────────────────────────── */
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

/* ── GDoc icon SVG ───────────────────────────────────────── */
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

/* ── Main form component ─────────────────────────────────── */
export default function LOIForm({ data, onChange, onExport, onClearDraft, exportState }) {
  function set(patch) {
    onChange({ ...data, ...patch });
  }

  function setProperty(index, patch) {
    const properties = data.properties.slice();
    properties[index] = { ...properties[index], ...patch };
    set({ properties });
  }

  function setPropCount(count) {
    const properties = data.properties.slice();
    while (properties.length < count) {
      const i = properties.length;
      properties.push({
        address: `Property Location Unique Address Line ${i + 1}`,
        value: BASE_PROPERTY_VALUES[i] || 100000,
      });
    }
    set({ properties: properties.slice(0, count) });
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
      {/* ── Header & Top Export Buttons ──────────────────── */}
      <div className="form-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="form-panel-title">LOI Workspace Engine</h1>
          <p className="form-panel-subtitle">
            Fill in the fields below — the document preview updates live. Your progress is
            saved automatically and restored if you refresh.{" "}
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear your saved draft and start over? This can't be undone.")) {
                  onClearDraft();
                }
              }}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-light)', fontSize: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear draft
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

      {/* ── Progress bar ─────────────────────────────────── */}
      <div className="progress-wrap" role="status" aria-label={`Form completion: ${progress}%`}>
        <div className="progress-label">
          <span>Form Completion</span>
          <span className="progress-label-pct">{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ── §1 Transaction Dates ─────────────────────────── */}
      <SectionCard icon="📅" title="Transaction Dates" accent="dates" stepNum="1">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="currentDate">Document Date</label>
            <input
              id="currentDate"
              type="text"
              value={data.currentDate}
              onChange={(e) => set({ currentDate: e.target.value })}
              placeholder="e.g. July 17, 2026"
            />
          </div>
          <div className="form-group">
            <label htmlFor="closingDate">Target Closing Date</label>
            <input
              id="closingDate"
              type="text"
              value={data.closingDate}
              onChange={(e) => set({ closingDate: e.target.value })}
              placeholder="e.g. September 30, 2026"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── §2 Transaction Type / Assets ─────────────────── */}
      <SectionCard icon="🏗️" title="Transaction Type / Assets" accent="type" stepNum="2">
        <div
          className="checkbox-group"
          onClick={() => set({ includeRealEstate: !data.includeRealEstate })}
          role="checkbox"
          aria-checked={data.includeRealEstate}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ includeRealEstate: !data.includeRealEstate })}
        >
          <input
            type="checkbox"
            id="includeRealEstate"
            checked={data.includeRealEstate}
            onChange={(e) => set({ includeRealEstate: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="includeRealEstate">Include Real Estate Properties</label>
        </div>
        <div
          className="checkbox-group"
          onClick={() => set({ includeBusinessOps: !data.includeBusinessOps })}
          role="checkbox"
          aria-checked={data.includeBusinessOps}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ includeBusinessOps: !data.includeBusinessOps })}
        >
          <input
            type="checkbox"
            id="includeBusinessOps"
            checked={data.includeBusinessOps}
            onChange={(e) => set({ includeBusinessOps: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="includeBusinessOps">Include Business Operations / Contents</label>
        </div>
      </SectionCard>

      {/* ── §3 Ownership Entities ─────────────────────────── */}
      <SectionCard icon="👥" title="Ownership Entities Structure" accent="owners" stepNum="3">
        <div
          className="checkbox-group"
          onClick={() => set({ jointOwnership: !data.jointOwnership })}
          role="checkbox"
          aria-checked={data.jointOwnership}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ jointOwnership: !data.jointOwnership })}
        >
          <input
            type="checkbox"
            id="jointOwnership"
            checked={data.jointOwnership}
            onChange={(e) => set({ jointOwnership: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="jointOwnership">Business &amp; Real Estate have identical owners</label>
        </div>

        {data.jointOwnership ? (
          <div className="form-group">
            <label htmlFor="sellerNames">Seller Name(s) (Joint Owners)</label>
            <input
              id="sellerNames"
              type="text"
              value={data.sellerNames}
              onChange={(e) => set({ sellerNames: e.target.value })}
              placeholder="e.g. John Smith and Jane Smith"
            />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="businessSellerName">Business Operating Owner Name(s)</label>
              <input
                id="businessSellerName"
                type="text"
                value={data.businessSellerName}
                onChange={(e) => set({ businessSellerName: e.target.value })}
                placeholder="e.g. Acme Operations Inc."
              />
            </div>
            <div className="form-group">
              <label htmlFor="propertySellerName">Real Estate Holding / Property Owner Name(s)</label>
              <input
                id="propertySellerName"
                type="text"
                value={data.propertySellerName}
                onChange={(e) => set({ propertySellerName: e.target.value })}
                placeholder="e.g. Acme Holdings LLC"
              />
            </div>
          </>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="buyerName">Buyer Name / Entity</label>
            <input
              id="buyerName"
              type="text"
              value={data.buyerName}
              onChange={(e) => set({ buyerName: e.target.value })}
              placeholder="e.g. Buyer Capital LLC"
            />
          </div>
          <div className="form-group">
            <label htmlFor="commercialType">Type of Commercial Business</label>
            <input
              id="commercialType"
              type="text"
              value={data.commercialType}
              onChange={(e) => set({ commercialType: e.target.value })}
              placeholder="e.g. Car Wash, Restaurant"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── §4 Real Estate Configuration ─────────────────── */}
      {data.includeRealEstate && (
        <SectionCard icon="🏠" title="Real Estate Configuration" accent="re" stepNum="4">
          <div className="form-group">
            <label htmlFor="propCount">Number of Properties Included</label>
            <input
              id="propCount"
              type="text"
              value={data.properties.length || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                setPropCount(val === "" ? 0 : parseInt(val, 10));
              }}
              placeholder="e.g. 1"
              pattern="[0-9]*"
            />
          </div>

          {data.properties.map((p, i) => (
            <div key={i} className="property-item">
              <div className="property-item-label">
                🏡 Property #{i + 1}
              </div>
              <div className="form-group">
                <label htmlFor={`prop-addr-${i}`}>Identification / Address</label>
                <input
                  id={`prop-addr-${i}`}
                  type="text"
                  value={p.address}
                  onChange={(e) => setProperty(i, { address: e.target.value })}
                  placeholder="123 Main Street, City, State"
                />
              </div>
              <div className="form-group">
                <label htmlFor={`prop-val-${i}`}>Appraisal Value ($)</label>
                <input
                  id={`prop-val-${i}`}
                  type="number"
                  value={p.value}
                  onChange={(e) => setProperty(i, { value: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* ── §5 Business Operations ───────────────────────── */}
      {data.includeBusinessOps && (
        <SectionCard icon="💼" title="Business Operations & Assets Split" accent="biz" stepNum="5">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="businessValue">Strategic Business Valuation ($)</label>
              <input
                id="businessValue"
                type="number"
                value={data.businessValue}
                onChange={(e) => set({ businessValue: e.target.value })}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="contentsValue">Contents, Fixtures &amp; Equipment ($)</label>
              <input
                id="contentsValue"
                type="number"
                value={data.contentsValue}
                onChange={(e) => set({ contentsValue: e.target.value })}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── §5/6 Brokerage ───────────────────────────────── */}
      <SectionCard icon="🤝" title="Brokerage Settlement Rules" accent="owners" stepNum={data.includeBusinessOps ? "6" : "5"}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="commPayer">Commission Obligation Party</label>
            <select
              id="commPayer"
              value={data.commPayer}
              onChange={(e) => set({ commPayer: e.target.value })}
            >
              <option value="Buyer">Buyer</option>
              <option value="Seller">Seller</option>
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
            placeholder={data.commType === "%" ? "e.g. 2.5" : "e.g. 15000"}
          />
        </div>

        <div className="card-divider" />

        <p className="custom-clauses-header">Agency / Representation Disclosure (optional)</p>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          Fill in any that apply — each one adds an Agency Disclosure section to the exported document.
        </p>

        <div className="form-group">
          <label htmlFor="buyerRepText">Buyer&apos;s Representative</label>
          <input
            id="buyerRepText"
            type="text"
            value={data.buyerRepText}
            onChange={(e) => set({ buyerRepText: e.target.value })}
            placeholder="e.g. Jane Doe, ABC Realty, represents the Buyer exclusively"
          />
        </div>
        <div className="form-group">
          <label htmlFor="sellerRepText">Seller&apos;s Representative</label>
          <input
            id="sellerRepText"
            type="text"
            value={data.sellerRepText}
            onChange={(e) => set({ sellerRepText: e.target.value })}
            placeholder="e.g. John Roe, XYZ Brokerage, represents the Seller exclusively"
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

      {/* ── §Last Risk Protection Clauses ────────────────── */}
      <SectionCard icon="🛡️" title="Transaction Risk Protection Clauses" accent="risk" stepNum="§">
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
          <label htmlFor="edgeInspection">Contingency on Structural Inspection &amp; Financial Due Diligence</label>
        </div>
        <div
          className="checkbox-group"
          onClick={() => set({ edgeLicense: !data.edgeLicense })}
          role="checkbox"
          aria-checked={data.edgeLicense}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ edgeLicense: !data.edgeLicense })}
        >
          <input
            type="checkbox"
            id="edgeLicense"
            checked={data.edgeLicense}
            onChange={(e) => set({ edgeLicense: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="edgeLicense">Contingency on Transfer of Operational Licenses</label>
        </div>
        <div
          className="checkbox-group"
          onClick={() => set({ edgeEnvironmental: !data.edgeEnvironmental })}
          role="checkbox"
          aria-checked={data.edgeEnvironmental}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ edgeEnvironmental: !data.edgeEnvironmental })}
        >
          <input
            type="checkbox"
            id="edgeEnvironmental"
            checked={data.edgeEnvironmental}
            onChange={(e) => set({ edgeEnvironmental: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="edgeEnvironmental">Contingency on Environmental Phase I / Inspection Clearing</label>
        </div>
        <div
          className="checkbox-group"
          onClick={() => set({ edgeTransition: !data.edgeTransition })}
          role="checkbox"
          aria-checked={data.edgeTransition}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ edgeTransition: !data.edgeTransition })}
        >
          <input
            type="checkbox"
            id="edgeTransition"
            checked={data.edgeTransition}
            onChange={(e) => set({ edgeTransition: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor="edgeTransition">Require Seller Transition / Training Period (Uncompensated)</label>
        </div>

        <div className="card-divider" />

        <p className="custom-clauses-header">Additional Custom Conditions</p>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          e.g. Loan Payoffs, Lien Clearances, Lease Assignments
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

        <div className="legal-disclaimer" role="note" style={{ marginTop: 20 }}>
          <strong>⚠️ Legal Notice:</strong> This tool generates non-binding letters of intent, not final legal contracts.
          This document is clearly labeled as non-binding (Section 6). This is not a substitute for legal advice
          and does not constitute legal services. Consult a qualified attorney before executing binding agreements.
        </div>
    </div>
  );
}
