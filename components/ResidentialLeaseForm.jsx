"use client";

import SectionCard from "./SectionCard";

const SERVICE_OPTIONS = [
  ["water", "Water"], ["propane", "Propane"], ["snowRemoval", "Snow removal"], ["roomCleaning", "Room cleaning"],
  ["heat", "Heat"], ["garbageCollection", "Garbage collection"], ["janitorial", "Janitorial"], ["electricity", "Electricity"],
  ["cableInternetHookup", "Cable and/or internet hook-up"], ["cableInternetServices", "Cable and/or internet services"],
  ["parking", "Parking for vehicle(s)"], ["hotWater", "Hot water"], ["naturalGas", "Natural gas"], ["sewage", "Sewage"],
];

const FURNISHING_OPTIONS = [
  ["refrigerator", "Refrigerator"], ["beds", "Bed(s)"], ["table", "Table"], ["stove", "Stove"],
  ["dresser", "Dresser"], ["chairs", "Chairs"], ["dishwasher", "Dishwasher"], ["nightTable", "Night table"],
  ["couch", "Couch"], ["washerDryer", "Washer and dryer"], ["lamps", "Lamp(s)"],
];

function calcProgress(data) {
  const checks = [
    !!data.currentDate,
    !!data.landlordFirstOrBusinessName,
    (data.tenants || []).some((t) => t.firstName || t.lastName),
    !!data.premisesStreet,
    !!data.premisesType,
    !!data.tenancyBeginDate,
    parseFloat(data.rentAmount) > 0,
    !!data.firstPaymentDate,
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

export default function ResidentialLeaseForm({ data, onChange, onExport, onClearDraft, exportState, readOnly }) {
  function set(patch) {
    onChange({ ...data, ...patch });
  }

  function setTenant(index, patch) {
    const tenants = data.tenants.slice();
    tenants[index] = { ...tenants[index], ...patch };
    set({ tenants });
  }

  function addTenant() {
    set({ tenants: [...(data.tenants || []), { firstName: "", lastName: "", phone: "", fax: "", email: "" }] });
  }

  function removeTenant(index) {
    const tenants = data.tenants.slice();
    tenants.splice(index, 1);
    set({ tenants: tenants.length > 0 ? tenants : [{ firstName: "", lastName: "", phone: "", fax: "", email: "" }] });
  }

  function setEmergencyContact(index, patch) {
    const emergencyContacts = data.emergencyContacts.slice();
    emergencyContacts[index] = { ...emergencyContacts[index], ...patch };
    set({ emergencyContacts });
  }

  function addEmergencyContact() {
    set({ emergencyContacts: [...(data.emergencyContacts || []), { name: "", phone: "" }] });
  }

  function removeEmergencyContact(index) {
    const emergencyContacts = data.emergencyContacts.slice();
    emergencyContacts.splice(index, 1);
    set({ emergencyContacts: emergencyContacts.length > 0 ? emergencyContacts : [{ name: "", phone: "" }] });
  }

  function toggleService(key) {
    const services = data.services || [];
    set({ services: services.includes(key) ? services.filter((s) => s !== key) : [...services, key] });
  }

  function toggleFurnishing(key) {
    const furnishings = data.furnishings || [];
    set({ furnishings: furnishings.includes(key) ? furnishings.filter((f) => f !== key) : [...furnishings, key] });
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
          <h1 className="form-panel-title">Residential Lease Workspace Engine</h1>
          <p className="form-panel-subtitle">
            New Brunswick standard form of lease (Sections 1-7). Fill in the fields below — the document preview
            updates live and saves automatically to your account.{" "}
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

      <SectionCard icon="📅" title="Date" accent="dates" stepNum="1">
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
      </SectionCard>

      <SectionCard icon="👤" title="Landlord" accent="owners" stepNum="2">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="landlordFirstOrBusinessName">First Name or Business Name</label>
            <input id="landlordFirstOrBusinessName" type="text" value={data.landlordFirstOrBusinessName} onChange={(e) => set({ landlordFirstOrBusinessName: e.target.value })} placeholder="e.g. Jane" />
          </div>
          <div className="form-group">
            <label htmlFor="landlordLastName">Last Name</label>
            <input id="landlordLastName" type="text" value={data.landlordLastName} onChange={(e) => set({ landlordLastName: e.target.value })} placeholder="e.g. Smith" />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="landlordAddress">Civic Address</label>
          <input id="landlordAddress" type="text" value={data.landlordAddress} onChange={(e) => set({ landlordAddress: e.target.value })} placeholder="123 Main St, Moncton" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="landlordPostalCode">Postal Code</label>
            <input id="landlordPostalCode" type="text" value={data.landlordPostalCode} onChange={(e) => set({ landlordPostalCode: e.target.value })} placeholder="E1A 1A1" />
          </div>
          <div className="form-group">
            <label htmlFor="landlordPhone">Phone Number</label>
            <input id="landlordPhone" type="text" value={data.landlordPhone} onChange={(e) => set({ landlordPhone: e.target.value })} placeholder="506-555-0100" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="landlordFax">Fax Number (optional)</label>
            <input id="landlordFax" type="text" value={data.landlordFax} onChange={(e) => set({ landlordFax: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="landlordEmail">Email Address</label>
            <input id="landlordEmail" type="email" value={data.landlordEmail} onChange={(e) => set({ landlordEmail: e.target.value })} />
          </div>
        </div>

        <div className="card-divider" />

        <div
          className="checkbox-group"
          onClick={() => set({ landlordHasAgent: !data.landlordHasAgent })}
          role="checkbox"
          aria-checked={data.landlordHasAgent}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ landlordHasAgent: !data.landlordHasAgent })}
        >
          <input type="checkbox" id="landlordHasAgent" checked={data.landlordHasAgent} onChange={(e) => set({ landlordHasAgent: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="landlordHasAgent">The Landlord employs an agent or representative</label>
        </div>
        {data.landlordHasAgent && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="landlordAgentFirstName">Agent First Name</label>
                <input id="landlordAgentFirstName" type="text" value={data.landlordAgentFirstName} onChange={(e) => set({ landlordAgentFirstName: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="landlordAgentLastName">Agent Last Name</label>
                <input id="landlordAgentLastName" type="text" value={data.landlordAgentLastName} onChange={(e) => set({ landlordAgentLastName: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="landlordAgentAddress">Agent Civic Address</label>
              <input id="landlordAgentAddress" type="text" value={data.landlordAgentAddress} onChange={(e) => set({ landlordAgentAddress: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="landlordAgentPhone">Agent Phone</label>
                <input id="landlordAgentPhone" type="text" value={data.landlordAgentPhone} onChange={(e) => set({ landlordAgentPhone: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="landlordAgentEmail">Agent Email</label>
                <input id="landlordAgentEmail" type="email" value={data.landlordAgentEmail} onChange={(e) => set({ landlordAgentEmail: e.target.value })} />
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard icon="👥" title="Tenants" accent="owners" stepNum="3">
        {(data.tenants || []).map((t, i) => (
          <div key={i} className="property-item">
            <div className="property-item-label">👤 Tenant #{i + 1}</div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor={`tenant-first-${i}`}>First Name</label>
                <input id={`tenant-first-${i}`} type="text" value={t.firstName} onChange={(e) => setTenant(i, { firstName: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor={`tenant-last-${i}`}>Last Name</label>
                <input id={`tenant-last-${i}`} type="text" value={t.lastName} onChange={(e) => setTenant(i, { lastName: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor={`tenant-phone-${i}`}>Phone</label>
                <input id={`tenant-phone-${i}`} type="text" value={t.phone} onChange={(e) => setTenant(i, { phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor={`tenant-email-${i}`}>Email</label>
                <input id={`tenant-email-${i}`} type="email" value={t.email} onChange={(e) => setTenant(i, { email: e.target.value })} />
              </div>
            </div>
            {data.tenants.length > 1 && (
              <button type="button" className="btn-remove-clause" onClick={() => removeTenant(i)} aria-label={`Remove tenant ${i + 1}`}>
                ✕ Remove Tenant
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn-add-clause" onClick={addTenant}>
          + Add Another Tenant
        </button>

        <div className="card-divider" />

        <div
          className="checkbox-group"
          onClick={() => set({ tenantWantsEmergencyContacts: !data.tenantWantsEmergencyContacts })}
          role="checkbox"
          aria-checked={data.tenantWantsEmergencyContacts}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ tenantWantsEmergencyContacts: !data.tenantWantsEmergencyContacts })}
        >
          <input type="checkbox" id="tenantWantsEmergencyContacts" checked={data.tenantWantsEmergencyContacts} onChange={(e) => set({ tenantWantsEmergencyContacts: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="tenantWantsEmergencyContacts">The Tenant wishes to provide emergency contact information</label>
        </div>
        {data.tenantWantsEmergencyContacts && (
          <>
            {(data.emergencyContacts || []).map((c, i) => (
              <div className="custom-clause-row" key={i}>
                <input type="text" value={c.name} onChange={(e) => setEmergencyContact(i, { name: e.target.value })} placeholder="Contact name" aria-label={`Emergency contact ${i + 1} name`} />
                <input type="text" value={c.phone} onChange={(e) => setEmergencyContact(i, { phone: e.target.value })} placeholder="Phone number" aria-label={`Emergency contact ${i + 1} phone`} />
                <button type="button" className="btn-remove-clause" onClick={() => removeEmergencyContact(i)} aria-label={`Remove emergency contact ${i + 1}`}>✕</button>
              </div>
            ))}
            <button type="button" className="btn-add-clause" onClick={addEmergencyContact}>+ Add Another Emergency Contact</button>
          </>
        )}
      </SectionCard>

      <SectionCard icon="🏠" title="Premises" accent="re" stepNum="4">
        <div className="form-group">
          <label htmlFor="premisesStreet">Street Number and Street Name</label>
          <input id="premisesStreet" type="text" value={data.premisesStreet} onChange={(e) => set({ premisesStreet: e.target.value })} placeholder="25 Elm St" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="premisesAptSiteRoom">Apt, Site or Room #</label>
            <input id="premisesAptSiteRoom" type="text" value={data.premisesAptSiteRoom} onChange={(e) => set({ premisesAptSiteRoom: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="premisesMunicipality">Municipality</label>
            <input id="premisesMunicipality" type="text" value={data.premisesMunicipality} onChange={(e) => set({ premisesMunicipality: e.target.value })} placeholder="Moncton" />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="premisesPostalCode">Postal Code</label>
          <input id="premisesPostalCode" type="text" value={data.premisesPostalCode} onChange={(e) => set({ premisesPostalCode: e.target.value })} placeholder="E1A 1A1" />
        </div>

        <div className="card-divider" />

        <p className="custom-clauses-header">Type of Premises</p>
        <div className="form-group">
          <select id="premisesType" value={data.premisesType} onChange={(e) => set({ premisesType: e.target.value })}>
            <option value="">Select type…</option>
            <option value="house_apartment">A house or apartment</option>
            <option value="condo_unit">A unit in a condominium property</option>
            <option value="boarding_room">A room in a boarding house or lodging house</option>
            <option value="mobile_home_site">A mobile home site</option>
            <option value="mobile_home">A mobile home</option>
            <option value="other">Other</option>
          </select>
        </div>
        {data.premisesType === "other" && (
          <div className="form-group">
            <label htmlFor="premisesTypeOther">Specify Other Type</label>
            <input id="premisesTypeOther" type="text" value={data.premisesTypeOther} onChange={(e) => set({ premisesTypeOther: e.target.value })} />
          </div>
        )}

        <div className="card-divider" />

        <div
          className="checkbox-group"
          onClick={() => set({ inspectionCompleted: !data.inspectionCompleted })}
          role="checkbox"
          aria-checked={data.inspectionCompleted}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ inspectionCompleted: !data.inspectionCompleted })}
        >
          <input type="checkbox" id="inspectionCompleted" checked={data.inspectionCompleted} onChange={(e) => set({ inspectionCompleted: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="inspectionCompleted">An inspection of the premises has been completed</label>
        </div>
        {data.inspectionCompleted && (
          <div className="form-group">
            <label htmlFor="inspectionDate">Inspection Date</label>
            <input id="inspectionDate" type="text" value={data.inspectionDate} onChange={(e) => set({ inspectionDate: e.target.value })} placeholder="e.g. July 15, 2026" />
          </div>
        )}

        <div
          className="checkbox-group"
          onClick={() => set({ repairsNeeded: !data.repairsNeeded })}
          role="checkbox"
          aria-checked={data.repairsNeeded}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ repairsNeeded: !data.repairsNeeded })}
        >
          <input type="checkbox" id="repairsNeeded" checked={data.repairsNeeded} onChange={(e) => set({ repairsNeeded: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="repairsNeeded">Repairs to be completed prior to or during the tenancy</label>
        </div>
        {data.repairsNeeded && (
          <div className="form-group">
            <label htmlFor="repairsNeededText">Describe Repairs</label>
            <input id="repairsNeededText" type="text" value={data.repairsNeededText} onChange={(e) => set({ repairsNeededText: e.target.value })} />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="emergencyRepairContact">For Emergency Repairs, Contact</label>
          <select id="emergencyRepairContact" value={data.emergencyRepairContact} onChange={(e) => set({ emergencyRepairContact: e.target.value })}>
            <option value="landlord">The Landlord</option>
            <option value="agent">The Landlord's Agent or Representative</option>
          </select>
        </div>

        <div className="card-divider" />

        <p className="custom-clauses-header">Additions (optional)</p>
        <div
          className="checkbox-group"
          onClick={() => set({ smokeFree: !data.smokeFree })}
          role="checkbox"
          aria-checked={data.smokeFree}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ smokeFree: !data.smokeFree })}
        >
          <input type="checkbox" id="smokeFree" checked={data.smokeFree} onChange={(e) => set({ smokeFree: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="smokeFree">The premises or a portion are smoke-free</label>
        </div>
        {data.smokeFree && (
          <div className="form-group">
            <input type="text" value={data.smokeFreeText} onChange={(e) => set({ smokeFreeText: e.target.value })} placeholder="Specify" />
          </div>
        )}
        <div
          className="checkbox-group"
          onClick={() => set({ petRestrictions: !data.petRestrictions })}
          role="checkbox"
          aria-checked={data.petRestrictions}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ petRestrictions: !data.petRestrictions })}
        >
          <input type="checkbox" id="petRestrictions" checked={data.petRestrictions} onChange={(e) => set({ petRestrictions: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="petRestrictions">Restrictions or prohibitions apply in relation to pets</label>
        </div>
        {data.petRestrictions && (
          <div className="form-group">
            <input type="text" value={data.petRestrictionsText} onChange={(e) => set({ petRestrictionsText: e.target.value })} placeholder="Specify" />
          </div>
        )}
        <div
          className="checkbox-group"
          onClick={() => set({ showDuringLastRentalPeriod: !data.showDuringLastRentalPeriod })}
          role="checkbox"
          aria-checked={data.showDuringLastRentalPeriod}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ showDuringLastRentalPeriod: !data.showDuringLastRentalPeriod })}
        >
          <input type="checkbox" id="showDuringLastRentalPeriod" checked={data.showDuringLastRentalPeriod} onChange={(e) => set({ showDuringLastRentalPeriod: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="showDuringLastRentalPeriod">Landlord may show premises to prospective tenants during the last rental period without notice</label>
        </div>
        <div
          className="checkbox-group"
          onClick={() => set({ condoByLaws: !data.condoByLaws })}
          role="checkbox"
          aria-checked={data.condoByLaws}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ condoByLaws: !data.condoByLaws })}
        >
          <input type="checkbox" id="condoByLaws" checked={data.condoByLaws} onChange={(e) => set({ condoByLaws: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="condoByLaws">Premises is a condominium unit; Tenant agrees to comply with by-laws and rules</label>
        </div>
        <div
          className="checkbox-group"
          onClick={() => set({ otherAdditions: !data.otherAdditions })}
          role="checkbox"
          aria-checked={data.otherAdditions}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ otherAdditions: !data.otherAdditions })}
        >
          <input type="checkbox" id="otherAdditions" checked={data.otherAdditions} onChange={(e) => set({ otherAdditions: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="otherAdditions">Other additions, including by-laws or rules</label>
        </div>
        {data.otherAdditions && (
          <div className="form-group">
            <input type="text" value={data.otherAdditionsText} onChange={(e) => set({ otherAdditionsText: e.target.value })} placeholder="Specify" />
          </div>
        )}
      </SectionCard>

      <SectionCard icon="📆" title="Length of Tenancy" accent="dates" stepNum="5">
        <div className="form-group">
          <label htmlFor="tenancyBeginDate">Tenancy Begin Date</label>
          <input id="tenancyBeginDate" type="text" value={data.tenancyBeginDate} onChange={(e) => set({ tenancyBeginDate: e.target.value })} placeholder="e.g. August 1, 2026" />
        </div>
        <div className="form-group">
          <label htmlFor="tenancyType">Tenancy Type</label>
          <select id="tenancyType" value={data.tenancyType} onChange={(e) => set({ tenancyType: e.target.value })}>
            <option value="fixed">Fixed term tenancy</option>
            <option value="periodic">Periodic tenancy</option>
          </select>
        </div>
        {data.tenancyType === "fixed" ? (
          <div className="form-group">
            <label htmlFor="fixedTermEndDate">Tenancy End Date</label>
            <input id="fixedTermEndDate" type="text" value={data.fixedTermEndDate} onChange={(e) => set({ fixedTermEndDate: e.target.value })} placeholder="e.g. July 31, 2027" />
          </div>
        ) : (
          <div className="form-group">
            <label htmlFor="periodicFrequency">Runs</label>
            <select id="periodicFrequency" value={data.periodicFrequency} onChange={(e) => set({ periodicFrequency: e.target.value })}>
              <option value="week">Week to week</option>
              <option value="month">Month to month</option>
              <option value="year">Year to year</option>
            </select>
          </div>
        )}
      </SectionCard>

      <SectionCard icon="💰" title="Rent" accent="biz" stepNum="6">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="rentAmount">Rent Amount ($)</label>
            <input id="rentAmount" type="number" value={data.rentAmount} onChange={(e) => set({ rentAmount: e.target.value })} min="0" />
          </div>
          <div className="form-group">
            <label htmlFor="rentFrequency">Per</label>
            <select id="rentFrequency" value={data.rentFrequency} onChange={(e) => set({ rentFrequency: e.target.value })}>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstPaymentDate">First Payment Due Date</label>
            <input id="firstPaymentDate" type="text" value={data.firstPaymentDate} onChange={(e) => set({ firstPaymentDate: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="paymentDayOfPeriod">Recurring Payment Day</label>
            <input id="paymentDayOfPeriod" type="text" value={data.paymentDayOfPeriod} onChange={(e) => set({ paymentDayOfPeriod: e.target.value })} placeholder="e.g. 1st of each month" />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="paymentTo">Payment Is to Be Made To</label>
          <select id="paymentTo" value={data.paymentTo} onChange={(e) => set({ paymentTo: e.target.value })}>
            <option value="landlord">The Landlord</option>
            <option value="agent">The Landlord's Agent or Representative</option>
          </select>
        </div>

        {data.tenancyType === "fixed" && (
          <>
            <div className="card-divider" />
            <div
              className="checkbox-group"
              onClick={() => set({ landlordMayIncreaseRent: !data.landlordMayIncreaseRent })}
              role="checkbox"
              aria-checked={data.landlordMayIncreaseRent}
              tabIndex={0}
              onKeyDown={(e) => e.key === ' ' && set({ landlordMayIncreaseRent: !data.landlordMayIncreaseRent })}
            >
              <input type="checkbox" id="landlordMayIncreaseRent" checked={data.landlordMayIncreaseRent} onChange={(e) => set({ landlordMayIncreaseRent: e.target.checked })} onClick={(e) => e.stopPropagation()} />
              <label htmlFor="landlordMayIncreaseRent">The Landlord may increase the rent during the fixed term</label>
            </div>
            {data.landlordMayIncreaseRent && (
              <div className="form-group">
                <label htmlFor="rentIncreaseParticulars">Particulars of Rent Increase</label>
                <input id="rentIncreaseParticulars" type="text" value={data.rentIncreaseParticulars} onChange={(e) => set({ rentIncreaseParticulars: e.target.value })} />
              </div>
            )}
          </>
        )}

        <div className="card-divider" />
        <div className="form-group">
          <label htmlFor="lateFeePolicy">Late Payment Fees (for dishonoured cheques)</label>
          <select id="lateFeePolicy" value={data.lateFeePolicy} onChange={(e) => set({ lateFeePolicy: e.target.value })}>
            <option value="not_entitled">Landlord is not entitled to charge a late payment fee</option>
            <option value="may_charge">Landlord may charge a late payment fee</option>
          </select>
        </div>

        <div className="card-divider" />
        <p className="custom-clauses-header">Services Included in Rent</p>
        <div
          className="checkbox-group"
          onClick={() => set({ servicesNone: !data.servicesNone })}
          role="checkbox"
          aria-checked={data.servicesNone}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ servicesNone: !data.servicesNone })}
        >
          <input type="checkbox" id="servicesNone" checked={data.servicesNone} onChange={(e) => set({ servicesNone: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="servicesNone">No services</label>
        </div>
        {!data.servicesNone && (
          <>
            {SERVICE_OPTIONS.map(([key, label]) => (
              <div
                key={key}
                className="checkbox-group"
                onClick={() => toggleService(key)}
                role="checkbox"
                aria-checked={(data.services || []).includes(key)}
                tabIndex={0}
                onKeyDown={(e) => e.key === ' ' && toggleService(key)}
              >
                <input type="checkbox" checked={(data.services || []).includes(key)} onChange={() => toggleService(key)} onClick={(e) => e.stopPropagation()} />
                <label>{label}</label>
              </div>
            ))}
            <div className="form-group">
              <label htmlFor="servicesOtherText">Other Services</label>
              <input id="servicesOtherText" type="text" value={data.servicesOtherText} onChange={(e) => set({ servicesOtherText: e.target.value })} />
            </div>
          </>
        )}

        <div className="card-divider" />
        <p className="custom-clauses-header">Furnishings Included</p>
        <div
          className="checkbox-group"
          onClick={() => set({ furnishingsNone: !data.furnishingsNone })}
          role="checkbox"
          aria-checked={data.furnishingsNone}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ furnishingsNone: !data.furnishingsNone })}
        >
          <input type="checkbox" id="furnishingsNone" checked={data.furnishingsNone} onChange={(e) => set({ furnishingsNone: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="furnishingsNone">No furnishings</label>
        </div>
        {!data.furnishingsNone && (
          <>
            {FURNISHING_OPTIONS.map(([key, label]) => (
              <div
                key={key}
                className="checkbox-group"
                onClick={() => toggleFurnishing(key)}
                role="checkbox"
                aria-checked={(data.furnishings || []).includes(key)}
                tabIndex={0}
                onKeyDown={(e) => e.key === ' ' && toggleFurnishing(key)}
              >
                <input type="checkbox" checked={(data.furnishings || []).includes(key)} onChange={() => toggleFurnishing(key)} onClick={(e) => e.stopPropagation()} />
                <label>{label}</label>
              </div>
            ))}
            <div className="form-group">
              <label htmlFor="furnishingsOtherText">Other Furnishings</label>
              <input id="furnishingsOtherText" type="text" value={data.furnishingsOtherText} onChange={(e) => set({ furnishingsOtherText: e.target.value })} />
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard icon="🔒" title="Security Deposit" accent="risk" stepNum="7">
        <div
          className="checkbox-group"
          onClick={() => set({ securityDepositRequired: !data.securityDepositRequired })}
          role="checkbox"
          aria-checked={data.securityDepositRequired}
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && set({ securityDepositRequired: !data.securityDepositRequired })}
        >
          <input type="checkbox" id="securityDepositRequired" checked={data.securityDepositRequired} onChange={(e) => set({ securityDepositRequired: e.target.checked })} onClick={(e) => e.stopPropagation()} />
          <label htmlFor="securityDepositRequired">A security deposit is required</label>
        </div>
        {data.securityDepositRequired && (
          <div className="form-group">
            <label htmlFor="securityDepositAmount">Security Deposit Amount ($)</label>
            <input id="securityDepositAmount" type="number" value={data.securityDepositAmount} onChange={(e) => set({ securityDepositAmount: e.target.value })} min="0" />
          </div>
        )}
      </SectionCard>

      <SectionCard icon="🔁" title="Assignment" accent="owners" stepNum="8">
        <div className="form-group">
          <label htmlFor="assignmentOption">Assignment Terms (optional)</label>
          <select id="assignmentOption" value={data.assignmentOption} onChange={(e) => set({ assignmentOption: e.target.value })}>
            <option value="">No selection (governed by the Act)</option>
            <option value="A">A — Tenant may assign freely</option>
            <option value="B">B — Tenant may assign with Landlord's consent</option>
            <option value="C">C — Tenant may not assign</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard icon="🛡️" title="Additional Notes" accent="risk" stepNum="9">
        <p className="custom-clauses-header">Additional Custom Clauses</p>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          Any additional terms agreed to by the Landlord and Tenant that do not alter any right or duty under The
          Residential Tenancies Act.
        </p>
        {(data.customClauses || []).map((c, i) => (
          <div className="custom-clause-row" key={i}>
            <input
              type="text"
              value={c}
              onChange={(e) => setCustomClause(i, e.target.value)}
              placeholder="Enter additional term…"
              aria-label={`Custom clause ${i + 1}`}
            />
            <button type="button" className="btn-remove-clause" onClick={() => removeCustomClause(i)} aria-label={`Remove custom clause ${i + 1}`}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-add-clause" onClick={addCustomClause}>
          + Add Custom Clause
        </button>
      </SectionCard>

      </fieldset>

      <div className="legal-disclaimer" role="note" style={{ marginTop: 20 }}>
        <strong>⚠️ Legal Notice:</strong> This tool generates Sections 1-7 of the New Brunswick standard form of
        Residential Lease (Form 6) under The Residential Tenancies Act. Attachment A (fixed statutory text) is
        provided separately as required by law and is not editable. This is not a substitute for legal advice.
        Consult a qualified attorney or the Residential Tenancies Tribunal before executing binding agreements.
      </div>
    </div>
  );
}
