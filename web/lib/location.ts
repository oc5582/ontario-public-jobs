type Place = { city: string; region: string };

/**
 * Canonical city and province/state. Keys are matched case-insensitively.
 * Montréal and Montreal share one label. Richmondhill is Richmond Hill.
 * A Toronto place keeps its own city; it is not rewritten to Toronto.
 */
const PLACES: Record<string, Place> = {
  toronto: { city: "Toronto", region: "ON" },
  toront: { city: "Toronto", region: "ON" },
  "downtown toronto": { city: "Toronto", region: "ON" },
  "toronto west": { city: "Toronto", region: "ON" },
  "north york": { city: "North York", region: "ON" },
  scarborough: { city: "Scarborough", region: "ON" },
  etobicoke: { city: "Etobicoke", region: "ON" },
  rexdale: { city: "Rexdale", region: "ON" },
  mississauga: { city: "Mississauga", region: "ON" },
  meadowvale: { city: "Mississauga", region: "ON" },
  brampton: { city: "Brampton", region: "ON" },
  caledon: { city: "Caledon", region: "ON" },
  aurora: { city: "Aurora", region: "ON" },
  "east gwillimbury": { city: "East Gwillimbury", region: "ON" },
  queensville: { city: "Queensville", region: "ON" },
  sharon: { city: "Sharon", region: "ON" },
  "king township": { city: "King", region: "ON" },
  "king city": { city: "King City", region: "ON" },
  king: { city: "King", region: "ON" },
  stouffville: { city: "Whitchurch-Stouffville", region: "ON" },
  "whitchurch-stouffville": { city: "Whitchurch-Stouffville", region: "ON" },
  uxbridge: { city: "Uxbridge", region: "ON" },
  "port perry": { city: "Port Perry", region: "ON" },
  scugog: { city: "Scugog", region: "ON" },
  clarington: { city: "Clarington", region: "ON" },
  bowmanville: { city: "Bowmanville", region: "ON" },
  "halton hills": { city: "Halton Hills", region: "ON" },
  georgetown: { city: "Georgetown", region: "ON" },
  richmondhill: { city: "Richmond Hill", region: "ON" },
  "richmond hill": { city: "Richmond Hill", region: "ON" },
  vaughan: { city: "Vaughan", region: "ON" },
  markham: { city: "Markham", region: "ON" },
  oakville: { city: "Oakville", region: "ON" },
  burlington: { city: "Burlington", region: "ON" },
  milton: { city: "Milton", region: "ON" },
  pickering: { city: "Pickering", region: "ON" },
  ajax: { city: "Ajax", region: "ON" },
  whitby: { city: "Whitby", region: "ON" },
  oshawa: { city: "Oshawa", region: "ON" },
  newmarket: { city: "Newmarket", region: "ON" },
  halton: { city: "Halton", region: "ON" },
  durham: { city: "Durham", region: "ON" },
  "peel region": { city: "Peel Region", region: "ON" },
  hamilton: { city: "Hamilton", region: "ON" },
  kitchener: { city: "Kitchener", region: "ON" },
  ottawa: { city: "Ottawa", region: "ON" },
  "sault ste. marie": { city: "Sault Ste. Marie", region: "ON" },
  "grand sudbury": { city: "Grand Sudbury", region: "ON" },
  sudbury: { city: "Grand Sudbury", region: "ON" },
  montreal: { city: "Montreal", region: "QC" },
  montréal: { city: "Montreal", region: "QC" },
  regina: { city: "Regina", region: "SK" },
  calgary: { city: "Calgary", region: "AB" },
  "new york": { city: "New York", region: "NY" },
};

const REGION_BY_NAME: Record<string, string> = {
  ontario: "ON",
  on: "ON",
  quebec: "QC",
  québec: "QC",
  qc: "QC",
  alberta: "AB",
  ab: "AB",
  saskatchewan: "SK",
  sk: "SK",
  "british columbia": "BC",
  bc: "BC",
  manitoba: "MB",
  mb: "MB",
  "new brunswick": "NB",
  nb: "NB",
  "nova scotia": "NS",
  ns: "NS",
  "prince edward island": "PE",
  pei: "PE",
  pe: "PE",
  "newfoundland and labrador": "NL",
  nl: "NL",
  ny: "NY",
};

const STREET_AFTER =
  /^\.?\s*(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|crt|place|pl|crescent|cres|terrace|terr|parkway|pkwy|square|sq|quay)\b/i;

const UNKNOWN_STOP = new Set([
  "various",
  "undefined",
  "hybrid",
  "remote",
  "canada",
  "on-site",
  "onsite",
  "head office",
  "city hall",
  "metro hall",
  "office",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PLACE_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${Object.keys(PLACES)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

const UNKNOWN_RE =
  /(?<![\p{L}\p{N}])([\p{L}][\p{L}.'’-]{1,}(?:\s+[\p{L}][\p{L}.'’-]{1,}){0,3})\s*,\s*(Ontario|ON|Quebec|Québec|QC|Alberta|AB|Saskatchewan|SK|British Columbia|BC|Manitoba|MB|New Brunswick|NB|Nova Scotia|NS|Prince Edward Island|PEI|PE|Newfoundland and Labrador|NL|NY)(?![\p{L}\p{N}])/giu;

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titlePlace(value: string): string {
  return value
    .split(/([\s-])/)
    .map((part) => {
      if (!part || /[\s-]/.test(part)) return part;
      if (part === part.toUpperCase() && part.length <= 3) return part.toUpperCase();
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function labelOf(place: Place): string {
  return `${place.city}, ${place.region}`;
}

function hasKnownPlace(name: string): boolean {
  const padded = ` ${collapse(name).toLowerCase()} `;
  return Object.keys(PLACES).some((key) => padded.includes(` ${key} `));
}

function extractPlaces(raw: string): Place[] {
  const text = collapse(raw);
  if (!text) return [];
  const found: Place[] = [];
  const seen = new Set<string>();
  const add = (place: Place) => {
    const label = labelOf(place);
    if (seen.has(label)) return;
    seen.add(label);
    found.push(place);
  };
  for (const match of text.matchAll(PLACE_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (STREET_AFTER.test(text.slice(end))) continue;
    const place = PLACES[match[0].toLowerCase()];
    if (place) add(place);
  }
  for (const match of text.matchAll(UNKNOWN_RE)) {
    const name = collapse(match[1]);
    const region = REGION_BY_NAME[match[2].toLowerCase()];
    if (!name || !region || UNKNOWN_STOP.has(name.toLowerCase())) continue;
    if (PLACES[name.toLowerCase()] || hasKnownPlace(name)) continue;
    add({ city: titlePlace(name), region });
  }
  return found;
}

/** Cities as `City, XX` labels, in the order they appear. Empty when none are known. */
export function locationCities(raw: string): string[] {
  return extractPlaces(raw).map(labelOf);
}

/**
 * Normalize a job location to `City, ON` (or the province or state the place
 * is in). Known duplicates and typos collapse to one label. Streets are
 * dropped. A string with no known place is returned trimmed, not discarded.
 */
export function normalizeLocation(raw: string): string {
  const cities = locationCities(raw);
  if (!cities.length) return collapse(raw);
  return cities.join("; ");
}

/** Filter dropdown value. A known place uses its cleaned label so it matches the options. */
export function displayFilterLocation(selected: string): string {
  const raw = collapse(selected);
  if (!raw) return "";
  return locationCities(raw)[0] || raw;
}
