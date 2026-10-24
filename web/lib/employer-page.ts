import { BRAND } from "./site";

/**
 * Short names already used for job titles. A title uses the short name first
 * when the full "{name} jobs | PublicJobs.ca" title is over 60 characters,
 * plus the names called out for search (TTC, LCBO, OLG, CBC, FSRA, City of Ajax).
 * Metrolinx is handled on its own so GO Transit is in the title and H1.
 */
const SHORT_NAMES: Record<string, string> = {
  "Alcohol and Gaming Commission of Ontario (AGCO)": "AGCO",
  "Art Gallery of Ontario": "AGO",
  "Business Development Bank of Canada (BDC)": "BDC",
  "Canada Development Investment Corporation (CDEV)": "CDEV",
  "Canada Infrastructure Bank": "CIB",
  "Canada Mortgage and Housing Corporation (CMHC)": "CMHC",
  "Canada Pension Plan Investment Board (CPPIB)": "CPPIB",
  "Canada Post Corporation": "Canada Post",
  "Canadian Broadcasting Corporation (CBC / Radio-Canada)": "CBC",
  "Chartered Professional Accountants of Ontario (CPA Ontario)": "CPA Ontario",
  "Exhibition Place (Board of Governors) / Canadian National Exhibition Association": "Exhibition Place",
  "Export Development Canada (EDC)": "EDC",
  "Farm Credit Canada": "FCC",
  "Financial Services Regulatory Authority of Ontario (FSRA)": "FSRA",
  "Home Construction Regulatory Authority (HCRA)": "HCRA",
  "Hydro One Limited": "Hydro One",
  "Independent Electricity System Operator (IESO)": "IESO",
  "Infrastructure Ontario": "IO",
  "Investment Management Corporation of Ontario (IMCO)": "IMCO",
  "Law Society of Ontario": "LSO",
  "Liquor Control Board of Ontario (LCBO)": "LCBO",
  "Metropolitan Toronto Convention Centre Corporation": "MTCC",
  "Ontario Cannabis Retail Corporation (Ontario Cannabis Store)": "OCS",
  "Ontario Centre of Innovation": "OCI",
  "Ontario Educational Communications Authority (TVO)": "TVO",
  "Ontario Energy Board": "OEB",
  "Ontario French-Language Educational Communications Authority (TFO)": "TFO",
  "Ontario Lottery and Gaming Corporation (OLG)": "OLG",
  "Ontario Power Generation Inc.": "OPG",
  "Ontario Securities Commission": "OSC",
  "Public Health Ontario (Ontario Agency for Health Protection and Promotion)": "PHO",
  "Regional Municipality of Halton": "Halton Region",
  "Royal Ontario Museum": "ROM",
  "Technical Standards and Safety Authority (TSSA)": "TSSA",
  "Toronto Atmospheric Fund": "TAF",
  "Toronto Community Housing Corporation": "TCHC",
  "Toronto Hydro Corporation": "Toronto Hydro",
  "Toronto Parking Authority": "TPA",
  "Toronto Police Service": "TPS",
  "Toronto Transit Commission": "TTC",
  "Toronto Zoo (Board of Management)": "Toronto Zoo",
  "Toronto and Region Conservation Authority": "TRCA",
  "Town of Ajax": "City of Ajax",
  "Workplace Safety and Insurance Appeals Tribunal": "WSIAT",
  "Workplace Safety and Insurance Board": "WSIB",
};

const FORCED_SHORT = new Set([
  "Toronto Transit Commission",
  "Town of Ajax",
  "Liquor Control Board of Ontario (LCBO)",
  "Ontario Lottery and Gaming Corporation (OLG)",
  "Canadian Broadcasting Corporation (CBC / Radio-Canada)",
  "Financial Services Regulatory Authority of Ontario (FSRA)",
]);

const BRAND_SUFFIX = ` | ${BRAND}`;

export type EmployerHeading = {
  h1: string;
  title: string;
  alertName: string;
  /** Extra first sentence. Empty for every employer except Metrolinx. */
  lead: string;
};

function plainTitle(name: string): string {
  return `${name} jobs${BRAND_SUFFIX}`;
}

/** Official name with a trailing or embedded short-name parenthesis removed. */
function officialName(name: string, short: string): string {
  if (name === short || name.startsWith(`${short} `) || name.startsWith(`${short}(`)) return "";
  const exact = ` (${short})`;
  if (name.endsWith(exact)) return name.slice(0, -exact.length);
  const embedded = name.indexOf(` (${short}`);
  if (embedded > 0) return name.slice(0, embedded);
  return name;
}

export function employerHeading(name: string): EmployerHeading {
  if (name === "Metrolinx") {
    const h1 = "Metrolinx and GO Transit jobs";
    return {
      h1,
      title: `${h1}${BRAND_SUFFIX}`,
      alertName: "Metrolinx and GO Transit",
      lead: "Metrolinx runs GO Transit, UP Express and PRESTO.",
    };
  }
  const short = SHORT_NAMES[name] || "";
  const useShort = Boolean(short) && (FORCED_SHORT.has(name) || plainTitle(name).length > 60);
  if (!useShort) {
    const h1 = `${name} jobs`;
    return { h1, title: `${h1}${BRAND_SUFFIX}`, alertName: name, lead: "" };
  }
  const official = officialName(name, short);
  const h1 = official ? `${short} jobs (${official})` : `${short} jobs`;
  const withBrand = `${h1}${BRAND_SUFFIX}`;
  const title = withBrand.length <= 60 ? withBrand : `${short} jobs${BRAND_SUFFIX}`;
  return { h1, title, alertName: short, lead: "" };
}
