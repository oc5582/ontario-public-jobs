const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function torontoTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseIsoDate(value: string | null | undefined): string {
  const raw = (value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

export function formatLongDate(iso: string): string {
  const raw = parseIsoDate(iso);
  if (!raw) return "";
  const [year, month, day] = raw.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function daysUntil(iso: string, todayIso: string): number | null {
  const raw = parseIsoDate(iso);
  if (!raw) return null;
  const close = Date.parse(`${raw}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  return Math.round((close - today) / 86400000);
}

export function closingLabel(iso: string, todayIso = torontoTodayIso()): { text: string; urgent: boolean } {
  const raw = parseIsoDate(iso);
  const diff = daysUntil(iso, todayIso);
  if (!raw || diff == null) return { text: "", urgent: false };
  if (diff === 0) return { text: "Closes today", urgent: true };
  if (diff === 1) return { text: "Closes in 1 day", urgent: true };
  if (diff > 1 && diff <= 7) return { text: `Closes in ${diff} days`, urgent: true };
  return { text: formatLongDate(raw), urgent: false };
}

/** Days left until the closing date. Empty once the date has passed or is missing. */
export function closesInText(iso: string, todayIso = torontoTodayIso()): string {
  const diff = daysUntil(iso, todayIso);
  if (diff == null || diff < 0) return "";
  if (diff === 0) return "Closes today";
  if (diff === 1) return "Closes in 1 day";
  return `Closes in ${diff} days`;
}

export function pillLabel(value: string): string {
  return value.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

export function countNoun(total: number, filtering: boolean): string {
  if (filtering) return total === 1 ? "matching opening" : "matching openings";
  return total === 1 ? "opening" : "openings";
}

export function englishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
