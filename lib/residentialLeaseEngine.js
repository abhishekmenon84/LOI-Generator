// Shared, framework-agnostic logic for turning residential lease form input
// into a fully resolved "model" (plain data) covering Sections 1-7 of the
// New Brunswick Residential Tenancies Act standard form of lease (Form 6).
// Attachment A (Parts 1-9) is fixed statutory text and is never generated
// here — it is bundled as a static PDF asset at export time (see
// app/api/export/residential-lease/*).

export const DEFAULT_RESIDENTIAL_LEASE_DATA = {
  currentDate: "",

  // Section 1 — Parties
  landlordFirstOrBusinessName: "",
  landlordLastName: "",
  landlordAddress: "",
  landlordProvince: "New Brunswick",
  landlordPostalCode: "",
  landlordPhone: "",
  landlordFax: "",
  landlordEmail: "",
  landlordHasAgent: false,
  landlordAgentFirstName: "",
  landlordAgentLastName: "",
  landlordAgentAddress: "",
  landlordAgentProvince: "New Brunswick",
  landlordAgentPostalCode: "",
  landlordAgentPhone: "",
  landlordAgentFax: "",
  landlordAgentEmail: "",

  tenants: [{ firstName: "", lastName: "", phone: "", fax: "", email: "" }],

  tenantWantsEmergencyContacts: false,
  emergencyContacts: [{ name: "", phone: "" }],

  // Section 2 — Premises
  premisesStreet: "",
  premisesAptSiteRoom: "",
  premisesMunicipality: "",
  premisesProvince: "New Brunswick",
  premisesPostalCode: "",
  premisesType: "", // "house_apartment" | "condo_unit" | "boarding_room" | "mobile_home_site" | "mobile_home" | "other"
  premisesTypeOther: "",

  inspectionCompleted: false,
  inspectionDate: "",
  repairsNeeded: false,
  repairsNeededText: "",
  emergencyRepairContact: "landlord", // "landlord" | "agent"

  smokeFree: false,
  smokeFreeText: "",
  petRestrictions: false,
  petRestrictionsText: "",
  showDuringLastRentalPeriod: false,
  condoByLaws: false,
  otherAdditions: false,
  otherAdditionsText: "",

  // Section 3 — Length of Tenancy
  tenancyBeginDate: "",
  tenancyType: "fixed", // "fixed" | "periodic"
  fixedTermEndDate: "",
  periodicFrequency: "month", // "week" | "month" | "year"

  // Section 4 — Rent
  rentAmount: 0,
  rentFrequency: "month", // "week" | "month"
  firstPaymentDate: "",
  paymentDayOfPeriod: "",
  paymentTo: "landlord", // "landlord" | "agent"
  landlordMayIncreaseRent: false,
  rentIncreaseParticulars: "",
  lateFeePolicy: "not_entitled", // "not_entitled" | "may_charge"

  servicesNone: false,
  services: [], // array of selected service keys, e.g. ["water", "heat"]
  servicesOtherText: "",
  furnishingsNone: false,
  furnishings: [], // array of selected furnishing keys
  furnishingsOtherText: "",

  // Section 5 — Security Deposit
  securityDepositRequired: false,
  securityDepositAmount: 0,

  // Section 6 — Assignment
  assignmentOption: "", // "" | "A" | "B" | "C"

  customClauses: [],
};

const SERVICE_LABELS = {
  water: "Water",
  propane: "Propane",
  snowRemoval: "Snow removal",
  roomCleaning: "Room cleaning",
  heat: "Heat",
  garbageCollection: "Garbage collection",
  janitorial: "Janitorial",
  electricity: "Electricity",
  cableInternetHookup: "Cable and/or internet hook-up",
  cableInternetServices: "Cable and/or internet services",
  parking: "Parking for vehicle(s)",
  hotWater: "Hot water",
  naturalGas: "Natural gas",
  sewage: "Sewage",
};

const FURNISHING_LABELS = {
  refrigerator: "Refrigerator",
  beds: "Bed(s)",
  table: "Table",
  stove: "Stove",
  dresser: "Dresser",
  chairs: "Chairs",
  dishwasher: "Dishwasher",
  nightTable: "Night table",
  couch: "Couch",
  washerDryer: "Washer and dryer",
  lamps: "Lamp(s)",
};

export function buildResidentialLeaseModel(data) {
  const landlordName = [data.landlordFirstOrBusinessName, data.landlordLastName].filter(Boolean).join(" ");
  const tenants = (data.tenants || []).filter((t) => (t.firstName || t.lastName || "").trim() !== "");
  const tenantNames = tenants.map((t) => [t.firstName, t.lastName].filter(Boolean).join(" ")).filter(Boolean);
  const tenantNamesText = tenantNames.length > 0 ? tenantNames.join(", ") : "";

  const premisesAddressParts = [
    data.premisesStreet,
    data.premisesAptSiteRoom ? `Unit ${data.premisesAptSiteRoom}` : "",
    data.premisesMunicipality,
    data.premisesProvince,
    data.premisesPostalCode,
  ].filter(Boolean);
  const premisesAddressText = premisesAddressParts.join(", ");

  const premisesTypeLabels = {
    house_apartment: "a house or apartment",
    condo_unit: "a unit in a condominium property",
    boarding_room: "a room in a boarding house or lodging house",
    mobile_home_site: "a mobile home site",
    mobile_home: "a mobile home",
    other: data.premisesTypeOther || "other premises",
  };
  const premisesTypeText = premisesTypeLabels[data.premisesType] || "";

  const tenancyText =
    data.tenancyType === "fixed"
      ? `This is a fixed term tenancy beginning ${data.tenancyBeginDate || ""} and ending ${data.fixedTermEndDate || ""}.`
      : `This is a periodic tenancy beginning ${data.tenancyBeginDate || ""}, running from ${data.periodicFrequency || "month"} to ${data.periodicFrequency || "month"}.`;

  const rentAmount = parseFloat(data.rentAmount) || 0;
  const rentText = `Rent of $${rentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} per ${data.rentFrequency || "month"}, first payment due ${data.firstPaymentDate || ""}, payable to the ${data.paymentTo === "agent" ? "Landlord's agent or representative" : "Landlord"}.`;

  const rentIncreaseText =
    data.tenancyType === "fixed"
      ? data.landlordMayIncreaseRent
        ? `The Landlord may increase the rent.${data.rentIncreaseParticulars ? ` Particulars: ${data.rentIncreaseParticulars}` : ""}`
        : "The Landlord may not increase the rent during the fixed term."
      : "";

  const lateFeeText =
    data.lateFeePolicy === "may_charge"
      ? "The Landlord may charge a late payment fee for a dishonoured cheque or negotiable instrument, in the amount of any NSF charges paid by the Landlord."
      : "The Landlord is not entitled to charge a late payment fee.";

  const servicesText = data.servicesNone
    ? "No services are included in the rent."
    : (data.services || []).length > 0
      ? `Services included in rent: ${(data.services || []).map((s) => SERVICE_LABELS[s] || s).join(", ")}${data.servicesOtherText ? `, ${data.servicesOtherText}` : ""}.`
      : "No services selected.";

  const furnishingsText = data.furnishingsNone
    ? "No furnishings are included."
    : (data.furnishings || []).length > 0
      ? `Furnishings included: ${(data.furnishings || []).map((f) => FURNISHING_LABELS[f] || f).join(", ")}${data.furnishingsOtherText ? `, ${data.furnishingsOtherText}` : ""}.`
      : "No furnishings selected.";

  const securityDepositText = data.securityDepositRequired
    ? `A security deposit of $${(parseFloat(data.securityDepositAmount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} is required.`
    : "A security deposit is not required.";

  const assignmentLabels = {
    A: "The Tenant may assign all of the Tenant's rights under this lease.",
    B: "The Tenant may only assign all of the Tenant's rights under this lease with the consent of the Landlord.",
    C: "The Tenant may not assign any of the Tenant's rights under this lease.",
  };
  const assignmentText = assignmentLabels[data.assignmentOption] || "No assignment option was selected; the Tenant's rights are governed by The Residential Tenancies Act.";

  const conditions = [];
  if (data.repairsNeeded && data.repairsNeededText) {
    conditions.push(`<strong>Repairs to be completed:</strong> ${data.repairsNeededText}`);
  }
  (data.customClauses || []).forEach((c) => {
    if (c && c.trim() !== "") conditions.push(c);
  });

  const signatureBlocks = tenants.length > 0
    ? tenants.map((t, i) => ({ name: [t.firstName, t.lastName].filter(Boolean).join(" "), title: `Tenant #${i + 1}` }))
    : [{ name: "", title: "Tenant" }];

  return {
    date: data.currentDate || "",
    landlordName,
    landlordAddress: data.landlordAddress || "",
    landlordPhone: data.landlordPhone || "",
    landlordEmail: data.landlordEmail || "",
    landlordHasAgent: !!data.landlordHasAgent,
    landlordAgentName: [data.landlordAgentFirstName, data.landlordAgentLastName].filter(Boolean).join(" "),
    tenantNamesText,
    tenants,
    tenantWantsEmergencyContacts: !!data.tenantWantsEmergencyContacts,
    emergencyContacts: (data.emergencyContacts || []).filter((c) => (c.name || "").trim() !== ""),
    premisesAddressText,
    premisesTypeText,
    tenancyText,
    rentText,
    rentIncreaseText,
    lateFeeText,
    servicesText,
    furnishingsText,
    securityDepositText,
    assignmentText,
    conditions,
    signatureBlocks,
  };
}
