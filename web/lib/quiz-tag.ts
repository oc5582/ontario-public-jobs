/**
 * Port of tag_jobs.py. Job type, area and level come from the title and location.
 * Keyword lists are a first pass, run on every quiz catalog refresh.
 */

const CATS: Record<string, string[]> = {
  office: ["admin", "clerk", "assistant", "receptionist", "customer", "client service", "client support", "client", "candidature", "student", "etudiant", "ressources humaines", "records", "scheduler", "secretar", "office\\b", "service representative", "data entry", "commis", "agent de", "information officer", "coordinator", "sales", "retail", "cashier", "ambassador"],
  it: ["developer", "software", "data", "database", "cyber", "network", "cloud", "devops", "technology", "technical support", "it\\b", "information technology", "information security", "digital", "gis", "systems", "application", "product owner", "product manager", "scrum", "architect", "ai\\b", "machine learning", "analytics", "business intelligence", "service desk", "solution", "web", "programmer", "sap\\b", "salesforce", "appian", "scada", "automation", "telecom"],
  finance: ["financ", "account", "audit", "tax", "budget", "payroll", "investment", "portfolio", "risk", "actuar", "treasury", "financial controller", "comptroller", "credit", "econom", "procurement", "purchas", "underwrit", "capital", "asset", "pension", "valuation", "private", "real estate", "fund", "banking", "trading", "payment", "equities", "infrastructure investment", "deal", "transaction", "lending", "loan", "revenue", "billing", "cost", "estimat", "pricing", "insurance", "mortgage", "buyer", "supply chain", "commercial", "contract", "client relationship", "ventes", "portefeuille", "risque", "product control", "commerce", "ecommerce"],
  policy: ["policy", "planner", "planning", "program", "research", "strateg", "governance", "government affairs", "stakeholder", "initiative", "partnership", "change", "transformation", "performance", "quality", "improvement", "statistic", "evaluat", "intergovernmental", "regulat", "registrar", "member experience", "workforce"],
  people: ["human resources", "hr\\b", "recruit", "talent acquisition", "talent management", "labour", "employee", "learning", "training", "legal", "lawyer", "counsel", "solicitor", "paralegal", "law ", "prosecutor", "communications", "media", "marketing", "writer", "editor", "producer", "journalist", "reporter", "host", "brand", "content", "privacy", "compliance", "access to information", "freedom of information", "translat", "engagement", "disability management", "health and safety", "occupational", "people", "culture", "diversity", "inclusion", "parliamentary", "tribunal", "adjudicat", "investigat", "public affairs", "social media", "design"],
  eng: ["engineer", "engineering", "technologist", "inspector", "construction", "design", "environment", "surveyor", "building", "architect", "planner", "transportation", "traffic", "water", "infrastructure", "energy", "electrical", "mechanical", "civil", "scientist", "geo", "forestry", "conservation", "climate", "drafting", "cad\\b", "capital project", "power", "nuclear", "protection", "transmission", "distribution", "asset management", "roads", "parks", "urban", "heritage", "zoning", "development"],
  community: ["nurse", "nursing", "health", "social", "counsell", "community", "recreation", "instructor", "lifeguard", "camp", "child", "youth", "librar", "museum", "curator", "conservator", "educat", "teacher", "tutor", "coach", "aquatic", "fitness", "program leader", "leader", "support worker", "case", "housing", "outreach", "early", "preschool", "art\\b", "arts", "cultur", "guide", "visitor", "event", "volunteer", "dietit", "physio", "psycholog", "paramedic", "firefight", "by-law", "bylaw", "enforcement", "police", "constable", "correction", "parole", "cook", "food", "animal", "zoo", "theatre", "performing", "gallery", "collection", "exhibit", "public health", "epidemiolog", "clinical", "medical", "tenant", "shelter", "dance", "skating", "swim", "sport", "crossing guard", "pharmac", "veterinar", "dietary", "trainer", "patrol", "science", "usher", "ticket", "bartender", "court", "indigenous", "french language", "chronic disease", "squash", "school"],
  trades: ["mechanic", "electrician", "plumber", "labourer", "carpenter", "technician", "operator", "driver", "maintenance", "trades", "millwright", "custodian", "cleaner", "gardener", "arborist", "equipment", "welder", "painter", "hvac", "carrier", "mail", "parcel", "postal", "facteur", "transit", "bus\\b", "rail", "track", "signal", "crew", "worker", "attendant", "warehouse", "stores", "fleet", "security guard", "security officer", "dispatch", "handler", "groundskeep", "horticult", "apprentice", "journeyperson", "helper", "installer", "repair", "lineperson", "lineman", "utility", "machinist", "facility maintenance", "facility operat", "logistics", "material", "plant", "station", "rel.ve", "livraison", "fitter", "landscap", "despatch", "machine", "timekeep", "general service", "control centre", "flight", "district supervisor"],
};

const WEAK = ["advisor", "adviser", "consultant", "project", "analyst", "analyste", "specialist", "officer", "business", "manager", "director", "lead", "associate", "representative", "practitioner", "organizer", "product", "gestionnaire", "conseiller", "student", "etudiant", "new grad", "intern", "nouveaux dipl", "scholarship", "candidature", "avocat", "coordinator"];

const REG: [string, string[]][] = [
  ["toronto", ["toronto", "north york", "etobicoke", "scarborough", "york st", "queen st", "metro hall", "dundas", "university ave", "sheppard", "wilson ave", "east york", "downsview", "front st", "bay st", "yonge"]],
  ["halton", ["oakville", "burlington", "milton", "halton", "bronte", "georgetown"]],
  ["peel", ["mississauga", "brampton", "caledon", "peel"]],
  ["york", ["markham", "richmond hill", "vaughan", "newmarket", "aurora", "king city", "east gwillimbury", "queensville", "sharon", "stouffville", "georgina", "york region"]],
  ["durham", ["ajax", "pickering", "whitby", "oshawa", "clarington", "bowmanville", "courtice", "scugog", "port perry", "uxbridge", "durham", "brock"]],
  ["hamilton", ["hamilton"]],
];

const EMPREG: Record<string, string> = {
  "Town of Oakville": "halton",
  "City of Burlington": "halton",
  "Town of Milton": "halton",
  "Regional Municipality of Halton": "halton",
  "City of Mississauga": "peel",
  "City of Brampton": "peel",
  "City of Markham": "york",
  "City of Richmond Hill": "york",
  "Town of Aurora": "york",
  "Town of East Gwillimbury": "york",
  "Town of Ajax": "durham",
  "Town of Whitby": "durham",
  "City of Pickering": "durham",
  "Municipality of Clarington": "durham",
  "Township of Scugog": "durham",
  "Township of Uxbridge": "durham",
  "City of Toronto": "toronto",
  "Toronto Transit Commission": "toronto",
  "Toronto Hydro Corporation": "toronto",
  "Toronto Community Housing Corporation": "toronto",
  "Toronto Parking Authority": "toronto",
  "Toronto Zoo (Board of Management)": "toronto",
  CreateTO: "toronto",
  "Royal Ontario Museum": "toronto",
  "Art Gallery of Ontario": "toronto",
  Metrolinx: "toronto",
  "Exhibition Place (Board of Governors) / Canadian National Exhibition Association": "toronto",
};

function has(text: string, words: string[]): boolean {
  return words.some((word) => new RegExp(`(?<![a-z])${word}`).test(text));
}

export function jobTypesForTitle(title: string): string[] {
  const text = ` ${title.toLowerCase()} `;
  const cats = Object.keys(CATS).filter((key) => has(text, CATS[key]));
  if (!cats.length && has(text, WEAK)) return ["policy"];
  return cats;
}

export function levelForTitle(title: string): "mgr" | "entry" | "senior" | "mid" {
  const text = ` ${title.toLowerCase()} `;
  if (has(text, ["manager", "director", "supervisor", "head ", "chief", "vice", "president", "commissioner", "superintendent", "deputy", "mgr\\b", "gestionnaire"])) {
    return "mgr";
  }
  if (has(text, ["student", "intern", "co-op", "coop", "summer", "junior", "trainee", "apprentice", "entry", "graduate", "casual", "part-time", "part time", "clerk", "assistant", "helper", "attendant", "instructor", "lifeguard", "leader", "on call", "on-call", "scholarship", "\\b1\\b", " i "])) {
    return "entry";
  }
  if (has(text, ["senior", "sr\\.", "sr\\b", "lead", "principal", "expert"])) return "senior";
  return "mid";
}

export function areasFor(location: string, employer: string): string[] {
  const loc = location.toLowerCase();
  const regs = REG.filter(([, words]) => words.some((word) => loc.includes(word))).map(([key]) => key);
  if (!regs.length && EMPREG[employer]) return [EMPREG[employer]];
  if (!regs.length) return ["other"];
  return regs;
}

/**
 * Yearly dollars for the quiz. salary_annual_* is already yearly when the importer
 * multiplied hourly or weekly pay. A raw hourly or weekly number left in that column
 * (under the usual posted-rate ceiling) is converted here: hour × 1,950, week × 52.
 */
export function annualAmount(value: number | null | undefined, unit: string | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  const key = (unit || "").trim().toLowerCase();
  if (key === "hour" || key === "hourly") return value < 1000 ? Math.round(value * 1950) : Math.round(value);
  if (key === "week" || key === "weekly") return value < 20000 ? Math.round(value * 52) : Math.round(value);
  if (key === "day" || key === "daily") return value < 2000 ? Math.round(value * 260) : Math.round(value);
  if (key === "month" || key === "monthly") return value < 20000 ? Math.round(value * 12) : Math.round(value);
  if (key === "biweek" || key === "biweekly" || key === "bi-weekly") {
    return value < 10000 ? Math.round(value * 26) : Math.round(value);
  }
  return Math.round(value);
}

/** Period flag the job card uses. year and blank draw no extra note. */
export function payPeriod(unit: string | null | undefined): "" | "hour" | "week" | "year" {
  const key = (unit || "").trim().toLowerCase();
  if (key === "hour" || key === "hourly") return "hour";
  if (key === "week" || key === "weekly") return "week";
  if (key === "year" || key === "yearly" || key === "annual") return "year";
  return "";
}
