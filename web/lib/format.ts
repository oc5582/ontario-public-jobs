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

function torontoOffset(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    timeZoneName: "longOffset",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const name = parts.find((part) => part.type === "timeZoneName")?.value || "";
  const match = name.match(/([+-]\d{2}:\d{2})/);
  return match ? match[1] : "-05:00";
}

/** Closing date at 23:59:59 America/Toronto, with the offset for that day. */
export function validThrough(isoDate: string): string {
  const raw = parseIsoDate(isoDate);
  if (!raw) return "";
  let offset = "-05:00";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    offset = torontoOffset(new Date(`${raw}T23:59:59${offset}`));
  }
  return `${raw}T23:59:59${offset}`;
}

export function formatLongDate(iso: string): string {
  const raw = parseIsoDate(iso);
  if (!raw) return "";
  const [year, month, day] = raw.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function closingLabel(iso: string, todayIso = torontoTodayIso()): { text: string; urgent: boolean } {
  const raw = parseIsoDate(iso);
  if (!raw) return { text: "", urgent: false };
  const close = Date.parse(`${raw}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  const diff = Math.round((close - today) / 86400000);
  if (diff === 0) return { text: "Closes today", urgent: true };
  if (diff === 1) return { text: "Closes in 1 day", urgent: true };
  if (diff > 1 && diff <= 7) return { text: `Closes in ${diff} days`, urgent: true };
  return { text: formatLongDate(raw), urgent: false };
}

/** Calendar days from a Toronto today until the closing date. Null when either date is missing. */
export function daysUntilClosing(iso: string, todayIso: string): number | null {
  const raw = parseIsoDate(iso);
  const today = parseIsoDate(todayIso);
  if (!raw || !today) return null;
  const close = Date.parse(`${raw}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(close) || !Number.isFinite(start)) return null;
  return Math.round((close - start) / 86400000);
}

/**
 * Honest relative closing line for a job page.
 * Empty when there is no date, the date is past, or it is more than 14 days away.
 * "Closes tomorrow" is day 1. Day 0 is "Closes today".
 */
export function closingSoonPhrase(iso: string, todayIso: string): string {
  const diff = daysUntilClosing(iso, todayIso);
  if (diff == null || diff < 0 || diff > 14) return "";
  if (diff === 0) return "Closes today";
  if (diff === 1) return "Closes tomorrow";
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
