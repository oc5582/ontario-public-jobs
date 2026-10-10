import type { JobRecord } from "./jobs";
import { paragraphs, text } from "./text";

const PLACE_ADDRESS: Record<string, [string, string, string]> = {
  toronto: ["Toronto", "ON", "CA"],
  toront: ["Toronto", "ON", "CA"],
  "downtown toronto": ["Toronto", "ON", "CA"],
  "toronto west": ["Toronto", "ON", "CA"],
  "north york": ["North York", "ON", "CA"],
  scarborough: ["Scarborough", "ON", "CA"],
  etobicoke: ["Etobicoke", "ON", "CA"],
  rexdale: ["Rexdale", "ON", "CA"],
  mississauga: ["Mississauga", "ON", "CA"],
  brampton: ["Brampton", "ON", "CA"],
  caledon: ["Caledon", "ON", "CA"],
  aurora: ["Aurora", "ON", "CA"],
  "east gwillimbury": ["East Gwillimbury", "ON", "CA"],
  queensville: ["Queensville", "ON", "CA"],
  sharon: ["Sharon", "ON", "CA"],
  "king township": ["King", "ON", "CA"],
  "king city": ["King City", "ON", "CA"],
  stouffville: ["Whitchurch-Stouffville", "ON", "CA"],
  uxbridge: ["Uxbridge", "ON", "CA"],
  "port perry": ["Port Perry", "ON", "CA"],
  scugog: ["Scugog", "ON", "CA"],
  clarington: ["Clarington", "ON", "CA"],
  bowmanville: ["Bowmanville", "ON", "CA"],
  "halton hills": ["Halton Hills", "ON", "CA"],
  richmondhill: ["Richmond Hill", "ON", "CA"],
  vaughan: ["Vaughan", "ON", "CA"],
  markham: ["Markham", "ON", "CA"],
  "richmond hill": ["Richmond Hill", "ON", "CA"],
  oakville: ["Oakville", "ON", "CA"],
  burlington: ["Burlington", "ON", "CA"],
  milton: ["Milton", "ON", "CA"],
  pickering: ["Pickering", "ON", "CA"],
  ajax: ["Ajax", "ON", "CA"],
  whitby: ["Whitby", "ON", "CA"],
  oshawa: ["Oshawa", "ON", "CA"],
  newmarket: ["Newmarket", "ON", "CA"],
  "whitchurch-stouffville": ["Whitchurch-Stouffville", "ON", "CA"],
  georgetown: ["Georgetown", "ON", "CA"],
  halton: ["Halton", "ON", "CA"],
  durham: ["Durham", "ON", "CA"],
  "peel region": ["Peel Region", "ON", "CA"],
  hamilton: ["Hamilton", "ON", "CA"],
  kitchener: ["Kitchener", "ON", "CA"],
  ottawa: ["Ottawa", "ON", "CA"],
  "sault ste. marie": ["Sault Ste. Marie", "ON", "CA"],
  "grand sudbury": ["Grand Sudbury", "ON", "CA"],
  montreal: ["Montreal", "QC", "CA"],
  montréal: ["Montréal", "QC", "CA"],
  regina: ["Regina", "SK", "CA"],
  calgary: ["Calgary", "AB", "CA"],
  "new york": ["New York", "NY", "US"],
};

const PLACE_RE = new RegExp(
  `\\b(?:${Object.keys(PLACE_ADDRESS)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "gi",
);

const SCHEMA_TYPES: [RegExp, string][] = [
  [/\bfull[\s-]?time\b/i, "FULL_TIME"],
  [/\bpart[\s-]?time\b/i, "PART_TIME"],
  [/\bcontracts?\b|\bcontractor\b/i, "CONTRACTOR"],
  [/\btemporary\b|\bfixed[\s-]?term\b|\bseasonal\b/i, "TEMPORARY"],
  [/\bintern(?:ship)?\b|\bco-?ops?\b/i, "INTERN"],
  [/\bvolunteer\b/i, "VOLUNTEER"],
  [/\bper[\s-]?diem\b/i, "PER_DIEM"],
];

function employmentTypes(raw: string): string[] {
  const value = text(raw).toLowerCase();
  if (!value) return [];
  const found: string[] = [];
  for (const [re, token] of SCHEMA_TYPES) {
    if (re.test(value) && !found.includes(token)) found.push(token);
  }
  return found;
}

function descriptionHtml(description: string): string {
  const parts = paragraphs(description);
  if (!parts.length) return "";
  return parts
    .map((part) => `<p>${part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

type Place = { "@type": "Place"; address: Record<string, string> };

function postalAddress(locality: string, region: string, country: string): Place {
  const address: Record<string, string> = { "@type": "PostalAddress" };
  if (locality) address.addressLocality = locality;
  if (region) address.addressRegion = region;
  if (country) address.addressCountry = country;
  return { "@type": "Place", address };
}

function jobLocations(raw: string): Place[] {
  const cleaned = text(raw).replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const part of cleaned.split(/\s*;\s*/)) {
    const found: Place[] = [];
    const localSeen = new Set<string>();
    for (const match of part.matchAll(PLACE_RE)) {
      const hit = PLACE_ADDRESS[match[0].toLowerCase()];
      if (!hit || localSeen.has(hit[0])) continue;
      localSeen.add(hit[0]);
      found.push(postalAddress(hit[0], hit[1], hit[2]));
    }
    const use = found.length
      ? found
      : /^(?:gta|greater toronto(?:\s+area)?|greater toronto and hamilton area|gtha)$/i.test(part.trim())
        ? [postalAddress("Toronto", "ON", "CA")]
        : [];
    for (const place of use) {
      const key = JSON.stringify(place.address);
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(place);
    }
  }
  if (places.length) return places;
  if (/\b(?:toronto|gta|greater toronto)\b/i.test(cleaned)) return [postalAddress("Toronto", "ON", "CA")];
  return [];
}

function asNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

function monetary(unit: string, numbers: { value?: number; minValue?: number; maxValue?: number }) {
  return {
    "@type": "MonetaryAmount",
    currency: "CAD",
    value: { "@type": "QuantitativeValue", unitText: unit, ...numbers },
  };
}

function baseSalary(raw: string) {
  const cleaned = text(raw).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const explicit = [
    /^(?<cur>CAD|USD|EUR|GBP)\s+(?<min>\d+(?:\.\d+)?)\s*[-–—]\s*(?<max>\d+(?:\.\d+)?)\s*\((?<unit>year|hour|month|week|day)\)$/i,
    /^\$?(?<min>\d+(?:,\d{3})*(?:\.\d+)?)\s*\/\s*(?<unit>hour|hr|year|month|week|day)\s*\((?<cur>CAD|USD|EUR|GBP)\)$/i,
    /^\$?(?<min>\d+(?:,\d{3})*(?:\.\d+)?)\s*[-–—]\s*\$?(?<max>\d+(?:,\d{3})*(?:\.\d+)?)\s*\/\s*(?<unit>hour|hr|year|month|week|day)\s*\((?<cur>CAD|USD|EUR|GBP)\)$/i,
  ];
  for (const pattern of explicit) {
    const match = cleaned.match(pattern);
    if (!match?.groups) continue;
    const min = asNumber(match.groups.min);
    if (min == null) return null;
    const max = match.groups.max ? asNumber(match.groups.max) : null;
    const unit = /hour|hr/i.test(match.groups.unit) ? "HOUR" : match.groups.unit.toUpperCase() === "YEAR" ? "YEAR" : match.groups.unit.toUpperCase();
    const numbers = max == null ? { value: min } : { minValue: min, maxValue: max };
    if (match.groups.cur.toUpperCase() !== "CAD" && match.groups.cur.toUpperCase() !== "USD") return null;
    return {
      "@type": "MonetaryAmount",
      currency: match.groups.cur.toUpperCase(),
      value: { "@type": "QuantitativeValue", unitText: unit === "HR" ? "HOUR" : unit, ...numbers },
    };
  }
  if (/bi-?weekly|semi-?monthly|per\s+(?:week|month|day)|monthly|weekly|daily/i.test(cleaned)) return null;
  if (/[-–—]\s*\$\s*$/.test(cleaned)) return null;
  const amounts = [...cleaned.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((amount) => amount > 0);
  if (!amounts.length || amounts.length > 2) return null;
  let unit = "";
  if (/\b(?:per\s+hour|hourly|\/\s*(?:hour|hr))\b/i.test(cleaned)) unit = "HOUR";
  else if (/\b(?:per\s+(?:annum|year)|annually|annual|yearly|\/\s*(?:year|yr))\b/i.test(cleaned)) unit = "YEAR";
  if (!unit && Math.min(...amounts) >= 20000) unit = "YEAR";
  if (!unit) return null;
  if (unit === "HOUR" && Math.max(...amounts) > 500) return null;
  if (unit === "YEAR" && Math.min(...amounts) < 10000) return null;
  const num = (amount: number) => (Number.isInteger(amount) ? amount : amount);
  const lo = Math.min(...amounts);
  const hi = Math.max(...amounts);
  const numbers = lo === hi ? { value: num(lo) } : { minValue: num(lo), maxValue: num(hi) };
  return monetary(unit, numbers);
}

function applyJobId(url: string): string {
  const raw = text(url);
  if (!raw) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }
  for (const key of ["career_job_req_id", "gh_jid", "jobId", "opportunityId", "rid", "JobOpeningId"]) {
    const value = parsed.searchParams.get(key);
    if (value && text(value)) return text(value);
  }
  const path = decodeURIComponent(parsed.pathname).replace(/\/$/, "");
  const segment = path.split("/").pop() || "";
  let match = segment.match(/_((?:JR|R)[-_]?\d[\w-]*)$/i);
  if (match) return match[1];
  if (/^\d+$/.test(segment)) return segment;
  if (/^[0-9a-f-]{36}$/i.test(segment)) return segment.toLowerCase();
  match = path.match(/\/view\/([A-Za-z0-9]{8,})(?:\/|$)/);
  if (match) return match[1];
  match = path.match(/\/apply\/([A-Za-z0-9]{6,})(?:\/|$)/);
  if (match) return match[1];
  if (!parsed.hostname.toLowerCase().includes("myworkdayjobs.com")) {
    match = path.match(/\/job\/([A-Za-z0-9]{6,})$/);
    if (match) return match[1];
  }
  return "";
}

function fullyRemote(mode: string): boolean {
  const value = mode.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  return ["remote", "fully remote", "work from home", "telecommute"].includes(value);
}

export function jobPosting(job: JobRecord): Record<string, unknown> | null {
  const description = descriptionHtml(job.description);
  if (!job.title || !job.employer || !description) return null;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description,
    directApply: false,
  };
  const jobId = applyJobId(job.applyUrl);
  if (jobId) {
    data.identifier = { "@type": "PropertyValue", name: job.employer, value: jobId };
  }
  if (job.postedDate) data.datePosted = job.postedDate;
  if (job.closingDate) data.validThrough = job.closingDate;
  const types = employmentTypes(job.employmentType);
  if (types.length === 1) data.employmentType = types[0];
  else if (types.length) data.employmentType = types;
  const organization: Record<string, unknown> = { "@type": "Organization", name: job.employer };
  if (job.website) organization.sameAs = job.website;
  if (job.logoUrl) organization.logo = job.logoUrl;
  data.hiringOrganization = organization;
  const places = jobLocations(job.location);
  if (places.length === 1) data.jobLocation = places[0];
  else if (places.length) data.jobLocation = places;
  if (fullyRemote(job.workMode)) data.jobLocationType = "TELECOMMUTE";
  const salary = baseSalary(job.salary);
  if (salary) data.baseSalary = salary;
  return data;
}

export function websiteJsonLd(origin: string) {
  const orgId = `${origin}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "PublicJobs.ca",
        url: `${origin}/`,
        email: "hello@publicjobs.ca",
        founder: { "@type": "Person", name: "Osama Chaudhary", jobTitle: "Founder and operator" },
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "PublicJobs.ca",
        url: `${origin}/`,
        publisher: { "@id": orgId },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${origin}/?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}
