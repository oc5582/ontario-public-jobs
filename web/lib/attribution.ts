/** First-touch and last-touch ad parameters. No network calls. */

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type AttributionTouch = Partial<Record<AttributionKey, string>>;

export type TouchRecord = {
  at: number;
  touch: AttributionTouch;
};

export type StoredAttribution = {
  first: AttributionTouch;
  last: AttributionTouch;
};

export const FIRST_TOUCH_COOKIE = "pj_attr_first";
export const LAST_TOUCH_COOKIE = "pj_attr_last";

/** About 90 days. The first-touch cookie is not renewed once it is set. */
export const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Stripe metadata values are limited to 500 characters. 200 keeps the cookie small. */
export const ATTRIBUTION_VALUE_MAX = 200;

const FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export function cleanAttributionValue(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, ATTRIBUTION_VALUE_MAX);
}

export function hasAttribution(touch: AttributionTouch | null | undefined): boolean {
  if (!touch) return false;
  return ATTRIBUTION_KEYS.some((key) => Boolean(touch[key]));
}

export function sameAttribution(a: AttributionTouch, b: AttributionTouch): boolean {
  return ATTRIBUTION_KEYS.every((key) => (a[key] || "") === (b[key] || ""));
}

export function touchFromParams(params: { get(name: string): string | null }): AttributionTouch {
  const touch: AttributionTouch = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = cleanAttributionValue(params.get(key) || "");
    if (value) touch[key] = value;
  }
  return touch;
}

export function touchFromRecord(params: Record<string, string | string[] | undefined>): AttributionTouch {
  const touch: AttributionTouch = {};
  for (const key of ATTRIBUTION_KEYS) {
    const raw = params[key];
    const value = cleanAttributionValue(Array.isArray(raw) ? raw[0] || "" : raw || "");
    if (value) touch[key] = value;
  }
  return touch;
}

export function touchFromUnknown(value: unknown): AttributionTouch {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const touch: AttributionTouch = {};
  for (const key of ATTRIBUTION_KEYS) {
    const cleaned = cleanAttributionValue(typeof record[key] === "string" ? record[key] : "");
    if (cleaned) touch[key] = cleaned;
  }
  return touch;
}

export function encodeTouch(record: TouchRecord): string {
  const params = new URLSearchParams();
  params.set("at", String(record.at));
  for (const key of ATTRIBUTION_KEYS) {
    const value = record.touch[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function decodeTouch(raw: string | null | undefined, now: number): TouchRecord | null {
  if (!raw) return null;
  let text = raw;
  if (!text.includes("=")) {
    try {
      text = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  const params = new URLSearchParams(text);
  const at = Number(params.get("at"));
  if (!Number.isFinite(at) || at <= 0 || now - at > ATTRIBUTION_TTL_MS || at > now + FUTURE_SKEW_MS) return null;
  const touch = touchFromParams(params);
  if (!hasAttribution(touch)) return null;
  return { at, touch };
}

export function cookieMaxAgeSeconds(at: number, now: number): number {
  const ttlSec = ATTRIBUTION_TTL_MS / 1000;
  const remaining = Math.floor((at + ATTRIBUTION_TTL_MS - now) / 1000);
  if (remaining <= 0) return 0;
  return Math.min(ttlSec, remaining);
}

export function pickOlder(a: TouchRecord | null, b: TouchRecord | null): TouchRecord | null {
  if (!a) return b;
  if (!b) return a;
  return a.at <= b.at ? a : b;
}

export function pickNewer(a: TouchRecord | null, b: TouchRecord | null): TouchRecord | null {
  if (!a) return b;
  if (!b) return a;
  return a.at >= b.at ? a : b;
}

export function applyIncomingTouch(
  first: TouchRecord | null,
  last: TouchRecord | null,
  incoming: AttributionTouch,
  now: number,
): { first: TouchRecord | null; last: TouchRecord | null } {
  if (!hasAttribution(incoming)) return { first, last };
  return {
    first: first ?? { at: now, touch: incoming },
    last: last && sameAttribution(last.touch, incoming) ? last : { at: now, touch: incoming },
  };
}

export function slotsNeedWrite(
  record: TouchRecord | null,
  slots: { ls: TouchRecord | null; ck: TouchRecord | null },
): boolean {
  if (!record) return false;
  if (!slots.ls || !slots.ck) return true;
  return (
    slots.ls.at !== record.at ||
    slots.ck.at !== record.at ||
    !sameAttribution(slots.ls.touch, record.touch) ||
    !sameAttribution(slots.ck.touch, record.touch)
  );
}

/** Cookie wins for first-touch. Submitted last-touch wins when the form sent one. */
export function mergeAttribution(stored: StoredAttribution, submitted: StoredAttribution): StoredAttribution {
  const first = hasAttribution(stored.first) ? stored.first : submitted.first;
  let last = hasAttribution(submitted.last) ? submitted.last : stored.last;
  if (!hasAttribution(last)) last = hasAttribution(first) ? first : submitted.first;
  return { first, last: hasAttribution(last) ? last : {} };
}

export function attributionForStripe(stored: StoredAttribution | undefined): StoredAttribution {
  const first = touchFromUnknown(stored?.first || {});
  const lastTouch = touchFromUnknown(stored?.last || {});
  const last = hasAttribution(lastTouch) ? lastTouch : first;
  return { first, last };
}

/** Session and subscription metadata. Empty values are omitted. First-touch uses the bare key. */
export function attributionMetadata(stored: StoredAttribution | undefined): Record<string, string> {
  const ready = attributionForStripe(stored);
  const metadata: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const first = ready.first[key];
    const last = ready.last[key];
    if (first) metadata[key] = first;
    if (last) metadata[`last_${key}`] = last;
  }
  return metadata;
}

export function attributionFromStripeMetadata(
  metadata: { [key: string]: string } | null | undefined,
): StoredAttribution {
  const source: Record<string, string | string[] | undefined> = {};
  const last: Record<string, string | string[] | undefined> = {};
  if (metadata) {
    for (const key of ATTRIBUTION_KEYS) {
      if (metadata[key]) source[key] = metadata[key];
      const lastKey = `last_${key}`;
      if (metadata[lastKey]) last[key] = metadata[lastKey];
    }
  }
  return { first: touchFromRecord(source), last: touchFromRecord(last) };
}

export function attributionFromForm(formData: FormData): StoredAttribution {
  const first: AttributionTouch = {};
  const last: AttributionTouch = {};
  for (const key of ATTRIBUTION_KEYS) {
    const firstValue = cleanAttributionValue(String(formData.get(key) || ""));
    const lastValue = cleanAttributionValue(String(formData.get(`last_${key}`) || ""));
    if (firstValue) first[key] = firstValue;
    if (lastValue) last[key] = lastValue;
  }
  return { first, last };
}

export function attributionFromPayload(payload: unknown): StoredAttribution {
  if (!payload || typeof payload !== "object") return { first: {}, last: {} };
  const record = payload as Record<string, unknown>;
  const nested = record.attribution;
  if (nested && typeof nested === "object") {
    const box = nested as Record<string, unknown>;
    return { first: touchFromUnknown(box.first), last: touchFromUnknown(box.last) };
  }
  const first = touchFromUnknown(record);
  const lastSource: Record<string, unknown> = {};
  for (const key of ATTRIBUTION_KEYS) lastSource[key] = record[`last_${key}`];
  return { first, last: touchFromUnknown(lastSource) };
}

/** Values for the profiles update, in PROFILE_ATTRIBUTION_COLUMNS order. Empty becomes null. */
export function attributionColumnValues(stored: StoredAttribution): Array<string | null> {
  const ready = attributionForStripe(stored);
  const values: Array<string | null> = [];
  for (const key of ATTRIBUTION_KEYS) values.push(ready.first[key] || null);
  for (const key of ATTRIBUTION_KEYS) values.push(ready.last[key] || null);
  return values;
}

export function profileAttributionUpdateSql(): string {
  const first = ATTRIBUTION_KEYS.map((key, index) => `${key} = coalesce(${key}, $${index + 2})`);
  const last = ATTRIBUTION_KEYS.map(
    (key, index) => `last_${key} = coalesce($${index + 2 + ATTRIBUTION_KEYS.length}, last_${key})`,
  );
  return `update profiles set\n       ${[...first, ...last].join(",\n       ")}\n     where id = $1`;
}
