import { isoDate, text } from "./text";

export const SEARCH_ALIASES: Record<string, string> = {
  "Art Gallery of Ontario": "AGO",
  "Exhibition Place (Board of Governors) / Canadian National Exhibition Association": "CNE",
  "Farm Credit Canada": "FCC",
  "Law Society of Ontario": "LSO",
  "Metropolitan Toronto Convention Centre Corporation": "MTCC",
  "Ontario Centre of Innovation": "OCI",
  "Ontario Energy Board": "OEB",
  "Ontario Power Generation Inc.": "OPG",
  "Ontario Securities Commission": "OSC",
  "Public Health Ontario (Ontario Agency for Health Protection and Promotion)": "PHO",
  "Royal Ontario Museum": "ROM",
  "Toronto Atmospheric Fund": "TAF",
  "Toronto and Region Conservation Authority": "TRCA",
  "Toronto Community Housing Corporation": "TCHC",
  "Toronto Parking Authority": "TPA",
  "Toronto Police Service": "TPS",
  "Regional Municipality of Halton": "Halton Region",
  "Toronto Transit Commission": "TTC",
  "Workplace Safety and Insurance Appeals Tribunal": "WSIAT",
  "Workplace Safety and Insurance Board": "WSIB",
};

export const SHORT_EMPLOYERS: Record<string, string> = {
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
  "Royal Ontario Museum": "ROM",
  "Technical Standards and Safety Authority (TSSA)": "TSSA",
  "Toronto Atmospheric Fund": "TAF",
  "Toronto Community Housing Corporation": "TCHC",
  "Toronto Hydro Corporation": "Toronto Hydro",
  "Toronto Parking Authority": "TPA",
  "Toronto Transit Commission": "TTC",
  "Toronto Zoo (Board of Management)": "Toronto Zoo",
  "Toronto and Region Conservation Authority": "TRCA",
  "Workplace Safety and Insurance Appeals Tribunal": "WSIAT",
  "Workplace Safety and Insurance Board": "WSIB",
};

/** Official homepages used as hiringOrganization.sameAs when we know them. */
export const EMPLOYER_WEBSITES: Record<string, string> = {
  "City of Toronto": "https://www.toronto.ca/",
  "Toronto Transit Commission": "https://www.ttc.ca/",
  "City of Brampton": "https://www.brampton.ca/",
  "City of Mississauga": "https://www.mississauga.ca/",
  "City of Markham": "https://www.markham.ca/",
  "City of Burlington": "https://www.burlington.ca/",
  "City of Richmond Hill": "https://www.richmondhill.ca/",
  "Town of Oakville": "https://www.oakville.ca/",
  "Town of Milton": "https://www.milton.ca/",
  "Town of Ajax": "https://www.ajax.ca/",
  "Town of Whitby": "https://www.whitby.ca/",
  "Town of Aurora": "https://www.aurora.ca/",
  "Town of Halton Hills": "https://www.haltonhills.ca/",
  "Town of East Gwillimbury": "https://www.eastgwillimbury.ca/",
  "Metrolinx": "https://www.metrolinx.com/",
  "Toronto Hydro Corporation": "https://www.torontohydro.com/",
  "Hydro One Limited": "https://www.hydroone.com/",
  "Ontario Power Generation Inc.": "https://www.opg.com/",
  "Liquor Control Board of Ontario (LCBO)": "https://www.lcbo.com/",
  "Ontario Lottery and Gaming Corporation (OLG)": "https://www.olg.ca/",
  "Royal Ontario Museum": "https://www.rom.on.ca/",
  "Toronto Police Service": "https://www.torontopolice.on.ca/",
  "Canada Post Corporation": "https://www.canadapost-postescanada.ca/",
  "Business Development Bank of Canada (BDC)": "https://www.bdc.ca/",
  "Export Development Canada (EDC)": "https://www.edc.ca/",
  "Farm Credit Canada": "https://www.fcc-fac.ca/",
  "Canada Mortgage and Housing Corporation (CMHC)": "https://www.cmhc-schl.gc.ca/",
  "Canadian Broadcasting Corporation (CBC / Radio-Canada)": "https://cbc.radio-canada.ca/",
  "Workplace Safety and Insurance Board": "https://www.wsib.ca/",
  "Toronto Community Housing Corporation": "https://www.torontohousing.ca/",
  "Toronto Zoo (Board of Management)": "https://www.torontozoo.com/",
  "Art Gallery of Ontario": "https://ago.ca/",
  "Infrastructure Ontario": "https://www.infrastructureontario.ca/",
  "Ontario Securities Commission": "https://www.osc.ca/",
  "Independent Electricity System Operator (IESO)": "https://www.ieso.ca/",
  "Toronto and Region Conservation Authority": "https://trca.ca/",
  "Regional Municipality of Halton": "https://www.halton.ca/",
  "Bank of Canada": "https://www.bankofcanada.ca/",
  "Canada Infrastructure Bank": "https://cib-bic.ca/",
  "Telefilm Canada": "https://telefilm.ca/",
  "Ontario Health": "https://www.ontariohealth.ca/",
  "CreateTO": "https://createto.ca/",
};

const CITIES: [string, string][] = [
  ["whitchurch-stouffville", "Whitchurch-Stouffville"],
  ["east gwillimbury", "East Gwillimbury"],
  ["greater toronto", "Toronto"],
  ["downtown toronto", "Toronto"],
  ["north york", "North York"],
  ["richmond hill", "Richmond Hill"],
  ["richmondhill", "Richmond Hill"],
  ["king township", "King"],
  ["king city", "King City"],
  ["port perry", "Port Perry"],
  ["sault ste. marie", "Sault Ste. Marie"],
  ["grand sudbury", "Grand Sudbury"],
  ["halton hills", "Halton Hills"],
  ["scarborough", "Scarborough"],
  ["mississauga", "Mississauga"],
  ["newmarket", "Newmarket"],
  ["stouffville", "Whitchurch-Stouffville"],
  ["bowmanville", "Bowmanville"],
  ["georgetown", "Georgetown"],
  ["etobicoke", "Etobicoke"],
  ["burlington", "Burlington"],
  ["pickering", "Pickering"],
  ["kitchener", "Kitchener"],
  ["hamilton", "Hamilton"],
  ["brampton", "Brampton"],
  ["caledon", "Caledon"],
  ["clarington", "Clarington"],
  ["oakville", "Oakville"],
  ["markham", "Markham"],
  ["vaughan", "Vaughan"],
  ["whitby", "Whitby"],
  ["oshawa", "Oshawa"],
  ["milton", "Milton"],
  ["aurora", "Aurora"],
  ["uxbridge", "Uxbridge"],
  ["scugog", "Scugog"],
  ["rexdale", "Rexdale"],
  ["toronto", "Toronto"],
  ["toront", "Toronto"],
  ["ottawa", "Ottawa"],
  ["ajax", "Ajax"],
  ["montreal", "Montreal"],
  ["montréal", "Montréal"],
  ["calgary", "Calgary"],
  ["regina", "Regina"],
  ["halton", "Halton"],
  ["durham", "Durham"],
  ["peel region", "Peel Region"],
];

const CATEGORY_RULES: [string, RegExp][] = [
  ["Public safety", /\b(fire|police|constable|enforcement|paramedic|security guard|inspector)\b/i],
  ["Transit", /\b(transit|subway|streetcar|bus operator|rail)\b/i],
  ["Information technology", /\b(software|developer|programmer|cyber|data scientist|database|it |systems analyst|full stack)\b/i],
  ["Engineering and trades", /\b(engineer|technician|mechanic|electrician|carpenter|plumber|welder|millwright|technologist)\b/i],
  ["Finance and administration", /\b(financ|account|payroll|audit|procurement|clerk|budget)\b/i],
  ["Health", /\b(health|nurse|clinic|medical|physician|dental)\b/i],
  ["Communications", /\b(communicat|market|media|journalist|editor|design)\b/i],
  ["Human resources", /\b(human resource|recruit|talent acquisition|\bhr\b)/i],
  ["Parks and recreation", /\b(recreation|lifeguard|aquatics|swim|parks|arena|skate)\b/i],
];

export const JOB_TYPE_OPTIONS = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "intern", label: "Intern" },
  { value: "casual", label: "Casual / on call" },
] as const;

export const CATEGORY_OPTIONS = [
  "Public safety",
  "Transit",
  "Information technology",
  "Engineering and trades",
  "Finance and administration",
  "Health",
  "Communications",
  "Human resources",
  "Parks and recreation",
  "Other",
];

export function primaryCity(location: string): string {
  const lower = text(location).toLowerCase();
  if (!lower) return "";
  for (const [needle, label] of CITIES) {
    const re = new RegExp(`(^|[^a-zà-ÿ])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zà-ÿ]|$)`, "i");
    if (re.test(lower)) return label;
  }
  if (/^(gta|greater toronto(?: area)?|greater toronto and hamilton area|gtha)$/i.test(lower.trim())) {
    return "Toronto";
  }
  return "";
}

export function categoryFor(title: string, department: string): string {
  const blob = `${title} ${department}`;
  for (const [label, re] of CATEGORY_RULES) {
    if (re.test(blob)) return label;
  }
  return "Other";
}

export function jobTypeCodes(raw: string): string[] {
  const value = text(raw).toLowerCase();
  if (!value) return [];
  const found: string[] = [];
  const add = (token: string) => {
    if (!found.includes(token)) found.push(token);
  };
  if (/\bfull[\s-]?time\b/.test(value)) add("full-time");
  if (/\bpart[\s-]?time\b/.test(value)) add("part-time");
  if (/\bcontracts?\b|\bcontractor\b/.test(value)) add("contract");
  if (/\btemporary\b|\bfixed[\s-]?term\b|\bseasonal\b/.test(value)) add("temporary");
  if (/\bintern(?:ship)?\b|\bco-?ops?\b/.test(value)) add("intern");
  if (/\bcasual\b|\bon[\s-]?call\b|\brelief\b/.test(value)) add("casual");
  return found;
}

const SALARY_RE = /(?:CA\$|CAD|\$)\s*(\d[\d,]*(?:\.\d+)?)|(?<![\d.,])(\d{1,3}(?:,\d{3})+(?:\.\d+)?)(?!\d)|(?<![\d.,])(\d{5,}(?:\.\d+)?)(?!\d)/gi;

export function annualSalary(raw: string): { min: number | null; max: number | null } {
  const cleaned = text(raw);
  if (!cleaned) return { min: null, max: null };
  if (/bi-?\s*weekly|semi-?\s*monthly|per\s+(?:week|month|day)|monthly|weekly|daily/i.test(cleaned)) {
    return { min: null, max: null };
  }
  const amounts: number[] = [];
  for (const match of cleaned.matchAll(SALARY_RE)) {
    const token = match[1] || match[2] || match[3];
    if (!token) continue;
    const value = Number(token.replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) amounts.push(value);
  }
  if (!amounts.length || amounts.length > 2) return { min: null, max: null };
  const hourly = /\b(?:per\s+hour|hourly|\/\s*(?:hour|hr))\b/i.test(cleaned);
  const yearly = /\b(?:per\s+(?:annum|year)|annually|annual|yearly|\/\s*(?:year|yr))\b/i.test(cleaned);
  let unit: "HOUR" | "YEAR" | "" = yearly ? "YEAR" : hourly ? "HOUR" : "";
  if (!unit && Math.min(...amounts) >= 20000) unit = "YEAR";
  if (!unit) return { min: null, max: null };
  const annual = amounts.map((amount) => (unit === "HOUR" ? amount * 2080 : amount));
  if (unit === "HOUR" && Math.max(...amounts) > 500) return { min: null, max: null };
  if (unit === "YEAR" && Math.min(...amounts) < 10000) return { min: null, max: null };
  return { min: Math.min(...annual), max: Math.max(...annual) };
}

export function isExcluded(job: { employer?: string; title?: string }): boolean {
  return (
    text(job.employer) === "Liquor Control Board of Ontario (LCBO)" &&
    text(job.title).toLowerCase().includes("holiday customer service")
  );
}

export function isClosed(closing: string | null, today: string): boolean {
  if (!closing) return false;
  return closing < today;
}

export function postedIso(value: string): string | null {
  return isoDate(value) || null;
}
