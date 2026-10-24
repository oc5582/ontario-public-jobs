/**
 * JobPosting fields filled at render time from the posting we already store.
 * Salary and employment type are omitted when the employer did not publish them.
 * Nothing here invents a closing date, a zero salary, or a logo.
 */

const LOOSE_AMOUNT_RE = /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g;
const FRENCH_AMOUNT_RE =
  /(?<![\d$.,])(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s?\$/g;
const BIWEEKLY_RE = /\bbi-?\s?weekly\b|\bevery (?:two|2) weeks\b|\baux deux semaines\b/i;
const OTHER_PERIOD_RE =
  /semi-?monthly|\bmonthly\b|\bdaily\b|per\s+(?:month|day)\b|\/\s*(?:month|mo|day)\b|par\s+(?:mois|jour)\b/i;
const WEEKLY_RE = /per\s+week\b|\/\s*(?:week|wk)\b|\bweekly\b|par\s+semaine\b/i;
const HOURLY_RE =
  /per\s+(?:hour|hr)\b|\bhourly\b|\/\s*(?:hour|hr|h)\b|\bp\/hr\b|\ban hour\b|\bde l[’']heure\b|\bl[’']heure\b/i;
const YEARLY_RE =
  /per\s+(?:annum|year)\b|\bannually\b|\bannual\b|\byearly\b|\/\s*(?:year|yr)\b|\ba year\b|par\s+an(?:née|nee)?\b/i;
const UNIT_BOUNDS: Record<string, [number, number]> = {
  HOUR: [10, 500],
  WEEK: [200, 20000],
  YEAR: [10000, 1000000],
};

const LABELED_PAY_RE =
  /(?:salary\s+range|pay\s+range|hiring\s+rate|(?:pay|wage|salary))\s*[:\-]\s*(.{1,180})/i;
const LABELED_TYPE_RE =
  /(?:position type|vacancy type|job type(?:\s*&\s*duration)?|employment type)\s*:\s*([^\n]{1,120})/i;

export function httpUrl(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  return "";
}

/** Permanent and Regular are full-time unless the same text says part-time. */
export function employmentTypes(raw: string): string[] {
  const value = raw.toLowerCase();
  if (!value.trim()) return [];
  const found: string[] = [];
  const add = (token: string) => {
    if (!found.includes(token)) found.push(token);
  };
  if (/\bfull[\s-]?time\b/.test(value)) add("FULL_TIME");
  if (/\bpart[\s-]?time\b/.test(value)) add("PART_TIME");
  if (/\bcontracts?\b|\bcontractor\b/.test(value)) add("CONTRACTOR");
  if (/\btemporary\b|\bfixed[\s-]?term\b|\bseasonal\b/.test(value)) add("TEMPORARY");
  if (/\bintern(?:ship)?\b|\bco-?ops?\b/.test(value)) add("INTERN");
  if (/\bvolunteer\b/.test(value)) add("VOLUNTEER");
  if (/\bper[\s-]?diem\b/.test(value)) add("PER_DIEM");
  if (!found.includes("FULL_TIME") && !found.includes("PART_TIME") && /\b(?:permanent|regular)\b/.test(value)) {
    add("FULL_TIME");
  }
  return found;
}

/** Employment type from the feed field, or from one labeled line in the description. */
export function employmentTypesFor(field: string, description: string): string[] {
  const fromField = employmentTypes(field || "");
  if (fromField.length) return fromField;
  const match = LABELED_TYPE_RE.exec(description || "");
  if (!match) return [];
  return employmentTypes(match[1]);
}

export function missingEmploymentType(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function normalizeSalaryText(raw: string): string {
  let value = raw.replace(/\s+/g, " ").trim();
  value = value.replace(FRENCH_AMOUNT_RE, (_full, whole: string, fraction?: string) => {
    const digits = whole.replace(/[ \u00a0\u202f]/g, "");
    return `$${digits}${fraction ? `.${fraction}` : ""}`;
  });
  value = value.replace(/\$\s+(?=\d)/g, "$");
  value = value.replace(/(\d),\s+(\d{3})\b/g, "$1,$2");
  value = value.replace(/(\$\d[\d,]*(?:\.\d+)?)\s*(?:[-–—]|\bto\b|\bet\b)\s*(?=\d)/gi, "$1 - $");
  value = value.replace(/\s*[-–—,;(]*\s*\+?\s*\bplus\b\s*\$.*\bpremium\b.*$/i, "");
  const parts = value.split(";").filter((part) => !/training rate/i.test(part));
  if (parts.length) value = parts.join(";").trim();
  return value.replace(/^[\s\-–—,;]+|[\s\-–—,;]+$/g, "");
}

function statedPayUnit(value: string): string {
  if (BIWEEKLY_RE.test(value)) return "BIWEEKLY";
  if (OTHER_PERIOD_RE.test(value)) return "OTHER";
  if (WEEKLY_RE.test(value)) return "WEEK";
  if (HOURLY_RE.test(value)) return "HOUR";
  if (YEARLY_RE.test(value)) return "YEAR";
  return "";
}

function looseAmounts(value: string): number[] {
  return [...value.matchAll(LOOSE_AMOUNT_RE)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
}

function descriptionPay(description: string, firstAmount: string): { amounts: number[]; unit: string } {
  const body = normalizeSalaryText(description);
  if (!body || !firstAmount) return { amounts: [], unit: "" };
  const start = body.indexOf(firstAmount);
  if (start < 0) return { amounts: [], unit: "" };
  const run = /\$\d[\d,]*(?:\.\d+)?(?:\s*(?:-|–|—|to|et)\s*\$\d[\d,]*(?:\.\d+)?)?/.exec(body.slice(start));
  if (!run) return { amounts: [], unit: "" };
  const amounts = looseAmounts(run[0]);
  const after = body.slice(start + run[0].length, start + run[0].length + 25);
  let before = body.slice(Math.max(0, start - 45), start);
  if (/(?:salary|annual)\s*\/\s*hourly|hourly\s*(?:rate)?\s*\/\s*(?:salary|annual)/i.test(before)) before = "";
  return { amounts, unit: statedPayUnit(after) || statedPayUnit(before) };
}

function asSchemaNumber(amount: number): number {
  return Math.abs(amount - Math.round(amount)) < 1e-9 ? Math.round(amount) : amount;
}

function monetaryAmount(unit: string, amounts: number[]): Record<string, unknown> | null {
  if (!amounts.length || amounts.length > 2) return null;
  const bounds = UNIT_BOUNDS[unit];
  if (!bounds) return null;
  const lo = Math.min(...amounts);
  const hi = Math.max(...amounts);
  if (lo < bounds[0] || hi > bounds[1]) return null;
  const quantitative: Record<string, unknown> = { "@type": "QuantitativeValue", unitText: unit };
  if (lo === hi) quantitative.value = asSchemaNumber(lo);
  else {
    quantitative.minValue = asSchemaNumber(lo);
    quantitative.maxValue = asSchemaNumber(hi);
  }
  return { "@type": "MonetaryAmount", currency: "CAD", value: quantitative };
}

/** Employer-stated CAD pay. Ambiguous periods and zero amounts are left out. */
export function baseSalaryFromText(raw: string, context = ""): Record<string, unknown> | null {
  const value = normalizeSalaryText(raw);
  if (!value) return null;
  if (/[-–—]\s*\$?\s*$/.test(value) && (value.match(/\$/g) || []).length < 2) return null;
  let amounts = looseAmounts(value);
  if (!amounts.length || amounts.length > 2) return null;
  let unit = statedPayUnit(value);
  const decidable = Math.max(...amounts) < 200 || Math.min(...amounts) >= 20000;
  if (!unit && !decidable && context) {
    const first = /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/.exec(value);
    const nearby = descriptionPay(context, first ? first[0] : "");
    if (nearby.unit && nearby.amounts.length && nearby.amounts[0] === amounts[0] && nearby.amounts.length <= 2) {
      amounts = nearby.amounts;
      unit = nearby.unit;
    }
  }
  if (unit === "OTHER") return null;
  if (!unit) {
    if (Math.max(...amounts) < 200) unit = "HOUR";
    else if (Math.min(...amounts) >= 20000) unit = "YEAR";
    else return null;
  }
  if (unit === "BIWEEKLY") {
    amounts = amounts.map((amount) => Math.round(amount * 26 * 100) / 100);
    unit = "YEAR";
  }
  return monetaryAmount(unit, amounts);
}

function labeledPayText(description: string): string {
  const flat = (description || "").replace(/\s+/g, " ");
  const match = LABELED_PAY_RE.exec(flat);
  return match ? match[1].trim() : "";
}

/** Salary field first. A labeled line in the description is used only when that field does not parse. */
export function baseSalaryFromJob(salary: string, description: string): Record<string, unknown> | null {
  const fromField = salary.trim() ? baseSalaryFromText(salary, description) : null;
  if (fromField) return fromField;
  const labeled = labeledPayText(description);
  if (!labeled || labeled === salary.trim()) return null;
  return baseSalaryFromText(labeled, description);
}

function schemaNumbers(value: Record<string, unknown>): number[] {
  return [value.value, value.minValue, value.maxValue].filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
}

/** A stored baseSalary is kept only when it is a positive CAD amount. Zeros are not a salary. */
export function usableBaseSalary(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data["@type"] !== "MonetaryAmount" || data.currency !== "CAD") return null;
  const quantitative = data.value;
  if (!quantitative || typeof quantitative !== "object") return null;
  const amount = quantitative as Record<string, unknown>;
  if (amount["@type"] !== "QuantitativeValue") return null;
  const unit = amount.unitText;
  if (unit !== "HOUR" && unit !== "DAY" && unit !== "WEEK" && unit !== "MONTH" && unit !== "YEAR") return null;
  const numbers = schemaNumbers(amount);
  if (!numbers.length || numbers.some((item) => item <= 0)) return null;
  return data;
}
