// Shared, framework-agnostic logic for turning form input into a fully
// resolved Letter of Intent "model" (plain data). This same module is used
// by the browser preview, the .docx export route, and the PDF export route
// so all three outputs are always in sync.

export function numberToWords(amount) {
  if (!amount || amount === 0) return "Zero Dollars";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertLessThanOneThousand(num) {
    let str = "";
    if (num >= 100) {
      str += ones[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + " ";
      num %= 10;
    }
    if (num > 0) {
      str += ones[num] + " ";
    }
    return str;
  }

  const parts = amount.toString().split(".");
  let mainNumber = parseInt(parts[0], 10);
  const decimals = parts[1] ? parts[1].substring(0, 2) : "";
  let result = "";

  if (mainNumber >= 1000000) {
    result += convertLessThanOneThousand(Math.floor(mainNumber / 1000000)) + "Million ";
    mainNumber %= 1000000;
  }
  if (mainNumber >= 1000) {
    result += convertLessThanOneThousand(Math.floor(mainNumber / 1000)) + "Thousand ";
    mainNumber %= 1000;
  }
  if (mainNumber > 0) {
    result += convertLessThanOneThousand(mainNumber);
  }
  result = result.trim() + " Dollars";

  if (decimals && parseInt(decimals, 10) > 0) {
    const centNum = parseInt(decimals.length === 1 ? decimals + "0" : decimals, 10);
    const centStr = centNum >= 20 ? `${tens[Math.floor(centNum / 10)]} ${ones[centNum % 10]}` : ones[centNum];
    result += ` and ${centStr.trim()} Cents`;
  }
  return result.replace(/\s+/g, " ");
}

export const DEFAULT_FORM_DATA = {
  currentDate: "",
  closingDate: "",
  includeRealEstate: true,
  includeBusinessOps: true,
  jointOwnership: true,
  sellerNames: "",
  businessSellerName: "",
  propertySellerName: "",
  buyerName: "",
  commercialType: "",
  properties: [
    { address: "", value: 0 },
    { address: "", value: 0 },
  ],
  businessValue: 0,
  contentsValue: 0,
  commPayer: "Buyer",
  commType: "%",
  commValue: "2.5",
  edgeInspection: true,
  edgeLicense: true,
  edgeEnvironmental: true,
  edgeTransition: true,
  buyerRepText: "",
  sellerRepText: "",
  dualAgencyText: "",
  customClauses: [],
};

// Builds the fully resolved LOI content model from raw form data.
// This is pure and has no DOM/React/Node dependency so it can run
// in the browser (for live preview) and on the server (for exports).
export function buildLOIModel(data) {
  const hasRE = !!data.includeRealEstate;
  const hasOps = !!data.includeBusinessOps;
  const joint = !!data.jointOwnership;
  const bizType = data.commercialType || "Business";
  const properties = hasRE ? data.properties || [] : [];

  let reSubject = "Proposed Acquisition of Assets";
  if (hasRE && hasOps) {
    reSubject = `Proposed Acquisition of ${bizType} Business and Associated Real Estate Assets`;
  } else if (hasRE) {
    reSubject = "Proposed Acquisition of Real Estate Assets Only";
  } else if (hasOps) {
    reSubject = `Proposed Acquisition of ${bizType} Business Only (Real Estate Property Not Included)`;
  }

  let sellerText = "";
  let salutation = "";
  let signatureBlocks = [];
  if (joint) {
    sellerText = data.sellerNames || "";
    salutation = sellerText.split(" and ")[0] || sellerText;
    signatureBlocks = [{ name: sellerText, title: "Sellers / Owners" }];
  } else {
    const bizOwner = data.businessSellerName || "";
    const propOwner = data.propertySellerName || "";
    if (hasRE && hasOps) {
      sellerText = `${bizOwner} (Business Operations) and ${propOwner} (Real Estate Holder)`;
      salutation = [bizOwner, propOwner].filter(Boolean).join(" and ");
      signatureBlocks = [
        { name: bizOwner, title: "Business Seller" },
        { name: propOwner, title: "Real Estate Seller" },
      ];
    } else if (hasRE) {
      sellerText = propOwner;
      salutation = propOwner;
      signatureBlocks = [{ name: propOwner, title: "Real Estate Seller" }];
    } else {
      sellerText = bizOwner;
      salutation = bizOwner;
      signatureBlocks = [{ name: bizOwner, title: "Business Seller" }];
    }
  }

  const inclusionPoints = [];
  if (hasRE) {
    inclusionPoints.push({
      flag: false,
      html: `<strong>Real Property Assets:</strong> Fee simple interest in ${properties.length} real estate property allocations, including all buildings, site infrastructure, and permanent land improvement fixtures.`,
    });
  } else if (hasOps) {
    inclusionPoints.push({
      flag: true,
      html: `<strong>BUSINESS ONLY - REAL ESTATE PROPERTY NOT INCLUDED:</strong> This transaction is strictly limited to the business operations, strategic inventory, corporate licenses, goodwill, and operational contents. The corresponding real estate facilities are not included in the transfer, and the transaction is subject to the lease negotiation terms detailed in Section 5.`,
    });
  }
  if (hasOps) {
    inclusionPoints.push({
      flag: false,
      html: `<strong>Corporate Business Operations:</strong> All software, customer contracts, active client files, furniture, chattels, fixtures, and corporate goodwill.`,
    });
  }

  const allocationRows = [];
  let grandTotal = 0;
  if (hasRE) {
    properties.forEach((p) => {
      const val = parseFloat(p.value) || 0;
      grandTotal += val;
      allocationRows.push({ label: p.address || "Property", value: val });
    });
  }
  if (hasOps) {
    const bVal = parseFloat(data.businessValue) || 0;
    const cVal = parseFloat(data.contentsValue) || 0;
    grandTotal += bVal + cVal;
    if (bVal > 0) allocationRows.push({ label: `Strategic ${bizType} Business Operation Value`, value: bVal });
    if (cVal > 0) allocationRows.push({ label: "Active Interior Assets, Contents, and Fixtures", value: cVal });
  }
  allocationRows.push({ label: "AGGREGATE COMMITTED TRANSACTION TOTAL", value: grandTotal, total: true });

  const payer = data.commPayer || "Buyer";
  const commType = data.commType || "%";
  const commSize = commType === "$" ? `$${data.commValue}` : `${data.commValue}%`;

  const conditions = [];
  if (data.edgeInspection) {
    conditions.push("Satisfactory structural inspection of all facilities and financial due diligence reviews.");
  }
  conditions.push("Buyer securing institutional financial underwriting commitments.");
  conditions.push(
    `<strong>Target Transaction Closing Date:</strong> The parties shall make all reasonable commercial efforts to execute definitive Purchase and Sale agreements and close the transaction on or before <strong>${data.closingDate || ""}</strong>.`
  );
  if (!hasRE && hasOps) {
    conditions.push(
      `<strong>Commercial Lease Assignment or Negotiation:</strong> Due to this transaction being a business purchase only with the property excluded, closing is strictly contingent upon the successful formal transfer, assignment, or negotiation of an acceptable commercial lease agreement with the Landlord of the operating properties on terms satisfactory to the Buyer.`
    );
  }
  if (data.edgeLicense) {
    conditions.push(
      `<strong>Licensing Clearance:</strong> Full regulatory reassignment of all applicable operating licenses to the Buyer prior to closing.`
    );
  }
  if (data.edgeEnvironmental) {
    conditions.push(
      `<strong>Environmental Screening:</strong> Satisfactory clearing of an Environmental Phase I audit on the premises.`
    );
  }
  if (data.edgeTransition) {
    conditions.push(
      `<strong>Seller Transition Training:</strong> Agreement by Sellers to remain active post-closing for up to 30 uncompensated days to assist with staff and client retention.`
    );
  }
  (data.customClauses || []).forEach((c) => {
    if (c && c.trim() !== "") conditions.push(c);
  });

  const agencyDisclosures = [];
  if ((data.buyerRepText || "").trim() !== "") {
    agencyDisclosures.push({ label: "Buyer's Representative", text: data.buyerRepText.trim() });
  }
  if ((data.sellerRepText || "").trim() !== "") {
    agencyDisclosures.push({ label: "Seller's Representative", text: data.sellerRepText.trim() });
  }
  if ((data.dualAgencyText || "").trim() !== "") {
    agencyDisclosures.push({ label: "Dual Agency", text: data.dualAgencyText.trim() });
  }

  return {
    date: data.currentDate || "",
    closingDate: data.closingDate || "",
    buyerName: data.buyerName || "",
    reSubject,
    sellerText,
    salutation,
    signatureBlocks,
    inclusionPoints,
    allocationRows,
    grandTotal,
    grandTotalWords: numberToWords(grandTotal),
    commissionPayerLabel: `${payer} Principal Party`,
    commissionSizeLabel: commSize,
    conditions,
    agencyDisclosures,
  };
}
