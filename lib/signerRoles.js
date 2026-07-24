// Predefined professional signer roles, filtered per document type to match
// that document's actual signing parties. "other" is always allowed on every
// document type, paired with a required free-text label (roleOtherLabel).

export const ROLE_LABELS = {
  buyer: "Buyer",
  seller: "Seller",
  landlord: "Landlord",
  tenant: "Tenant",
  listing_agent: "Listing Agent",
  buyers_agent: "Buyer's / Tenant's Agent",
  loan_officer: "Loan Officer",
  transaction_admin: "Transaction Coordinator/Admin",
  attorney: "Attorney",
  title_escrow_officer: "Title/Escrow Officer",
  witness: "Witness",
  other: "Other",
};

export const ROLES_BY_DOCUMENT_TYPE = {
  purchase_loi: ["buyer", "seller", "listing_agent", "buyers_agent", "loan_officer", "transaction_admin", "attorney", "title_escrow_officer", "other"],
  commercial_lease_loi: ["landlord", "listing_agent", "buyers_agent", "transaction_admin", "attorney", "other"],
  residential_lease: ["landlord", "tenant", "buyers_agent", "transaction_admin", "attorney", "witness", "other"],
};

export function isValidRole(documentType, role, roleOtherLabel) {
  const allowed = ROLES_BY_DOCUMENT_TYPE[documentType];
  if (!allowed) return false;
  if (role === "other") return typeof roleOtherLabel === "string" && roleOtherLabel.trim().length > 0;
  return allowed.includes(role);
}

export function getRoleLabel(role, roleOtherLabel) {
  if (role === "other") return roleOtherLabel || "Other";
  return ROLE_LABELS[role] || role;
}

// Returns a { name } prefill for the roles that can be auto-populated from
// the document's own model, or null if the role has no natural source.
// Buyer (Purchase LOI) pre-fills from model.buyerName directly — Purchase
// LOI's signatureBlocks array only ever contains seller-side entries, there
// is no buyer signature block to pull from. Seller (Purchase LOI), Landlord
// (Commercial Lease), and Tenant (Residential Lease, first entry only, since
// it's a variable-length list) pre-fill from the document's signatureBlocks.
export function getPrefillFor(documentType, model, role) {
  if (documentType === "purchase_loi") {
    if (role === "buyer") return { name: model.buyerName || "" };
    if (role === "seller") {
      const block = (model.signatureBlocks || [])[0];
      return block ? { name: block.name || "" } : null;
    }
  }
  if (documentType === "commercial_lease_loi" && role === "landlord") {
    const block = (model.signatureBlocks || [])[0];
    return block ? { name: block.name || "" } : null;
  }
  if (documentType === "residential_lease") {
    if (role === "landlord") return { name: model.landlordName || "" };
    if (role === "tenant") {
      const block = (model.signatureBlocks || [])[0];
      return block ? { name: block.name || "" } : null;
    }
  }
  return null;
}
