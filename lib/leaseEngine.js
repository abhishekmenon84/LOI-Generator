// Shared, framework-agnostic logic for turning lease form input into a
// fully resolved Commercial Lease LOI content "model" (plain data). Mirrors
// lib/loiEngine.js's structure exactly, but for a structurally different
// document type — lease terms instead of purchase price/allocation.

import { resolveSectionHeadings } from "./sectionHeadings";

// See lib/loiEngine.js's LOI_SECTION_DEFS for the shared convention this
// follows (ordered, fixed keys; number prefix always computed, never
// stored).
export const LEASE_SECTION_DEFS = [
  { key: "parties", defaultTitle: "PARTIES & PREMISES" },
  { key: "term", defaultTitle: "LEASE TERM & COMMENCEMENT" },
  { key: "rent", defaultTitle: "BASE RENT & ESCALATIONS" },
  { key: "deposit", defaultTitle: "SECURITY DEPOSIT" },
  { key: "use", defaultTitle: "PERMITTED USE" },
  { key: "ti", defaultTitle: "TENANT IMPROVEMENTS / BUILD-OUT ALLOWANCE" },
  { key: "renewal", defaultTitle: "RENEWAL OPTION(S)" },
  { key: "commission", defaultTitle: "BROKERAGE COMMISSION" },
  { key: "conditions", defaultTitle: "CONDITIONS PRECEDENT" },
  { key: "nonBinding", defaultTitle: "NON-BINDING NATURE" },
  { key: "agency", defaultTitle: "AGENCY DISCLOSURE" },
];

export const DEFAULT_LEASE_DATA = {
  currentDate: "",
  // Editable top-level document title -- previously fixed as "Letter of
  // Intent to Lease" with no way to change it (see components/LeasePreview.jsx's
  // former hardcoded header).
  documentTitle: "Letter of Intent to Lease",
  // Per-section { title?, enabled? } overrides -- see LEASE_SECTION_DEFS
  // above and lib/sectionHeadings.js's resolveSectionHeadings. Empty {}
  // (the default) renders identically to this document type's behavior
  // before this feature existed.
  sectionOverrides: {},
  landlordName: "",
  tenantName: "",
  premisesAddress: "",
  squareFootage: "",
  leaseTermYears: "",
  commencementDate: "",
  baseMonthlyRent: 0,
  annualEscalationPct: "3",
  securityDeposit: 0,
  permittedUse: "",
  tiAllowance: 0,
  tiScopeText: "",
  renewalOptionCount: "0",
  renewalOptionYears: "",
  renewalRentBasis: "",
  commPayer: "Landlord",
  commType: "%",
  commValue: "5",
  landlordRepText: "",
  tenantRepText: "",
  dualAgencyText: "",
  edgeInspection: true,
  edgeZoning: true,
  edgeFinancials: true,
  customClauses: [],
};

export function buildLeaseModel(data) {
  const landlordName = data.landlordName || "";
  const tenantName = data.tenantName || "";
  const premisesAddress = data.premisesAddress || "";
  const squareFootage = data.squareFootage || "";
  const leaseTermYears = data.leaseTermYears || "";
  const commencementDate = data.commencementDate || "";
  const baseMonthlyRent = parseFloat(data.baseMonthlyRent) || 0;
  const escalationPct = data.annualEscalationPct || "0";
  const securityDeposit = parseFloat(data.securityDeposit) || 0;
  const permittedUse = data.permittedUse || "";
  const tiAllowance = parseFloat(data.tiAllowance) || 0;
  const tiScopeText = data.tiScopeText || "";
  const renewalOptionCount = parseInt(data.renewalOptionCount, 10) || 0;
  const renewalOptionYears = data.renewalOptionYears || "";
  const renewalRentBasis = data.renewalRentBasis || "";

  const payer = data.commPayer || "Landlord";
  const commType = data.commType || "%";
  const commSize = commType === "$" ? `$${data.commValue}` : `${data.commValue}%`;

  const conditions = [];
  if (data.edgeInspection) {
    conditions.push("Tenant's satisfactory inspection of the premises.");
  }
  if (data.edgeZoning) {
    conditions.push("Verification of zoning and permitted use compliance.");
  }
  if (data.edgeFinancials) {
    conditions.push("Landlord's review of Tenant's financial statements.");
  }
  conditions.push(
    `<strong>Target Lease Commencement Date:</strong> The parties shall make all reasonable commercial efforts to execute a definitive Lease Agreement and commence the lease term on or before <strong>${commencementDate}</strong>.`
  );
  (data.customClauses || []).forEach((c) => {
    if (c && c.trim() !== "") conditions.push(c);
  });

  const agencyDisclosures = [];
  if ((data.landlordRepText || "").trim() !== "") {
    agencyDisclosures.push({ label: "Landlord's Representative", text: data.landlordRepText.trim() });
  }
  if ((data.tenantRepText || "").trim() !== "") {
    agencyDisclosures.push({ label: "Tenant's Representative", text: data.tenantRepText.trim() });
  }
  if ((data.dualAgencyText || "").trim() !== "") {
    agencyDisclosures.push({ label: "Dual Agency", text: data.dualAgencyText.trim() });
  }

  const renewalText =
    renewalOptionCount > 0
      ? `Tenant shall have ${renewalOptionCount} option(s) to renew this Lease for additional terms of ${renewalOptionYears} years each, at a rental rate based on ${renewalRentBasis || "terms to be mutually agreed"}, provided written notice is given no less than 180 days prior to expiration.`
      : "No renewal options are included in this proposed transaction.";

  const { headings, enabled } = resolveSectionHeadings(LEASE_SECTION_DEFS, data.sectionOverrides);
  enabled.agency = enabled.agency && agencyDisclosures.length > 0;

  return {
    date: data.currentDate || "",
    documentTitle: (data.documentTitle || "").trim() || "Letter of Intent to Lease",
    landlordName,
    tenantName,
    premisesAddress,
    squareFootage,
    leaseTermYears,
    commencementDate,
    baseMonthlyRent,
    escalationPct,
    escalationText: `Commencing on the Lease Commencement Date, Base Rent shall increase by ${escalationPct}% annually throughout the Lease Term.`,
    securityDeposit,
    permittedUse,
    tiAllowance,
    tiScopeText,
    renewalText,
    commissionPayerLabel: `${payer} Principal Party`,
    commissionSizeLabel: commSize,
    conditions,
    agencyDisclosures,
    signatureBlocks: [{ name: landlordName, title: "Landlord" }],
    headings,
    sectionEnabled: enabled,
  };
}
