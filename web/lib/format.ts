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
