const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const EMPLOYER_FIELD_KEYS = ["employer_posted_date", "posting_date", "date_posted", "datePosted"] as const;

const LABEL =
  /(?<![A-Za-z])(?:Posting Date|Date Posted|Posted Date|Posted On)\b(?:\s*\([^)\n]{0,40}\))?\s*:?\s*([^\n]{0,80})(?:\n\s*([^\n]{0,40}))?/gi;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseIsoDate(value: string | null | undefined): string {
  const raw = (value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [year, month, day] = raw.split("-").map(Number);
  return calendarIso(year, month, day);
}

function calendarIso(year: number, month: number, day: number): string {
  if (year < 2000 || year > 2040 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** A labeled calendar date. Empty when the text is not a complete date. */
export function parseLooseDate(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const iso = parseIsoDate(raw);
  if (iso && raw.startsWith(iso)) return iso;
  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (match) return calendarIso(Number(match[3]), Number(match[1]), Number(match[2]));
  match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\b/);
  if (match) return calendarIso(Number(match[3]), Number(match[1]), Number(match[2]));
  match = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\b/);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    if (month) return calendarIso(Number(match[3]), month, Number(match[2]));
  }
  match = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month) return calendarIso(Number(match[3]), month, Number(match[1]));
  }
  return "";
}

function postingDateFromDescription(description: string): string {
  const head = description.replace(/\r\n/g, "\n").slice(0, 4000);
  LABEL.lastIndex = 0;
  for (const match of head.matchAll(LABEL)) {
    const found = parseLooseDate(match[1]) || parseLooseDate(match[2]);
    if (found) return found;
  }
  return "";
}

/**
 * The employer's own posting date, from an explicit scraped field or a labeled
 * date in the description header. `posted_date` is not read here: in this feed
 * that field is the first day we collected the job.
 */
export function employerPostingDate(input: {
  description?: string;
  fields?: Record<string, string | null | undefined>;
}): string {
  const fields = input.fields || {};
  for (const key of EMPLOYER_FIELD_KEYS) {
    const found = parseLooseDate(fields[key]);
    if (found) return found;
  }
  return postingDateFromDescription(input.description || "");
}

/** Employer posting date when we have one, otherwise the first-collected date. */
export function displayPostedDate(input: {
  employerPosted?: string;
  description?: string;
  fields?: Record<string, string | null | undefined>;
  firstCollected?: string;
}): string {
  const stored = parseLooseDate(input.employerPosted);
  if (stored) return stored;
  const employer = employerPostingDate({ description: input.description, fields: input.fields });
  if (employer) return employer;
  return parseLooseDate(input.firstCollected || "");
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

/** Closing calendar date at 23:59 in America/Toronto, with the offset for that day. */
export function validThrough(isoDate: string | null | undefined): string {
  const raw = parseIsoDate(isoDate);
  if (!raw) return "";
  let offset = "-05:00";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    offset = torontoOffset(new Date(`${raw}T23:59:00${offset}`));
  }
  return `${raw}T23:59:00${offset}`;
}
