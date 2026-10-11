const ACRONYMS = new Set(
  [
    "TTC",
    "IT",
    "HR",
    "GIS",
    "OLG",
    "CUPE",
    "LTC",
    "CPA",
    "ECS",
    "SSLTC",
    "HVAC",
    "PSW",
    "RN",
    "CEO",
    "CFO",
    "COO",
    "VP",
    "SQL",
    "API",
    "UI",
    "UX",
    "QA",
    "ERP",
    "CRM",
    "AI",
    "AML",
    "KYC",
    "BDC",
    "OPS",
    "PROG",
    "ID",
  ],
);

const BRANDS: Record<string, string> = {
  servicenow: "ServiceNow",
};

const SMALL = new Set(["a", "an", "the", "and", "or", "of", "for", "in", "on", "at", "to", "by", "with", "nor", "vs"]);

const ROMAN = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)$/;

export function isShoutyTitle(title: string): boolean {
  const letters = title.match(/[A-Za-zÀ-ÿ]/g);
  if (!letters || letters.length < 2) return false;
  return letters.every((letter) => letter === letter.toUpperCase() && letter !== letter.toLowerCase());
}

function caseWord(word: string, index: number, last: number): string {
  const upper = word.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;
  const brand = BRANDS[word.toLowerCase()];
  if (brand) return brand;
  if (ROMAN.test(upper)) return upper;
  if (/^\d+$/.test(word)) return word;
  const lower = word.toLowerCase();
  if (word.length === 1) return upper;
  if (index !== 0 && index !== last && SMALL.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function caseToken(token: string, index: number, last: number): string {
  const upper = token.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;
  const brand = BRANDS[token.toLowerCase()];
  if (brand) return brand;
  if (ROMAN.test(upper)) return upper;
  const parts = token.split(/([&/'’-])/);
  return parts
    .map((part, partIndex) => {
      if (/^[&/'’-]$/.test(part)) return part;
      if (part.toLowerCase() === "s" && parts[partIndex - 1] === "'") return "s";
      return caseWord(part, index, last);
    })
    .join("");
}

/** Title-case an ALL-CAPS title. Mixed-case titles are returned unchanged. */
export function displayTitle(title: string): string {
  if (!isShoutyTitle(title)) return title;
  const token = /[A-Za-z0-9]+(?:[&/'’-][A-Za-z0-9]+)*/g;
  const matches = [...title.matchAll(token)];
  if (!matches.length) return title;
  let out = "";
  let cursor = 0;
  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    out += title.slice(cursor, start);
    out += caseToken(match[0], index, matches.length - 1);
    cursor = start + match[0].length;
  });
  out += title.slice(cursor);
  return out.replace(/[ \t]+/g, " ").trim();
}

/** Replace a shouty title, or a clipped prefix of it, inside a page title or meta description. */
export function displayPageTitle(pageTitle: string, rawTitle: string): string {
  if (!isShoutyTitle(rawTitle)) return pageTitle;
  const raw = rawTitle.trim();
  if (pageTitle.startsWith(raw)) return displayTitle(raw) + pageTitle.slice(raw.length);
  let length = Math.min(raw.length, pageTitle.length);
  while (length > 0 && pageTitle.slice(0, length) !== raw.slice(0, length)) length -= 1;
  if (length < 8) return pageTitle;
  return displayTitle(raw.slice(0, length)) + pageTitle.slice(length);
}
