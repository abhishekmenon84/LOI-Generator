// Canadian provinces and territories, two-letter codes. Used by the
// signup province selector and anywhere else a Canada-wide (not just New
// Brunswick) org/user location needs to be recorded or displayed.
export const CA_PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

export function isValidProvinceCode(code) {
  return CA_PROVINCES.some((p) => p.code === code);
}

export function provinceName(code) {
  return CA_PROVINCES.find((p) => p.code === code)?.name || code;
}

// Only New Brunswick has a real, statutory Residential Lease (Form 6)
// implemented (see lib/residentialLeaseEngine.js). Every other province
// shows a "not yet available" message rather than generating unverified
// generic content presented as an official form.
export const RESIDENTIAL_LEASE_SUPPORTED_PROVINCES = new Set(["NB"]);
