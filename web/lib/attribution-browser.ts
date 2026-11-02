import {
  ATTRIBUTION_KEYS,
  LAST_TOUCH_COOKIE,
  FIRST_TOUCH_COOKIE,
  applyIncomingTouch,
  cookieMaxAgeSeconds,
  decodeTouch,
  encodeTouch,
  pickNewer,
  pickOlder,
  slotsNeedWrite,
  touchFromParams,
  type StoredAttribution,
  type TouchRecord,
} from "./attribution";

type AttrWindow = Window & {
  pjCaptureAttribution?: (search: string) => void;
  pjReadAttribution?: () => StoredAttribution;
};

function browserWindow(): AttrWindow | null {
  if (typeof window === "undefined") return null;
  return window as AttrWindow;
}

function cookieValue(name: string): string {
  const parts = document.cookie ? document.cookie.split(";") : [];
  for (const piece of parts) {
    const part = piece.trim();
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return "";
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (maxAge <= 0) return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function storageGet(name: string): string {
  try {
    return localStorage.getItem(name) || "";
  } catch {
    return "";
  }
}

function storageSet(name: string, value: string) {
  try {
    localStorage.setItem(name, value);
  } catch {
    /* storage blocked */
  }
}

function readSlot(name: string, now: number): { ls: TouchRecord | null; ck: TouchRecord | null } {
  return { ls: decodeTouch(storageGet(name), now), ck: decodeTouch(cookieValue(name), now) };
}

function writeRecord(name: string, record: TouchRecord, now: number) {
  const age = cookieMaxAgeSeconds(record.at, now);
  if (age <= 0) return;
  const encoded = encodeTouch(record);
  writeCookie(name, encoded, age);
  storageSet(name, encoded);
}

/** Used when /attribution.js did not run. Same first-touch and last-touch rules. */
function captureWithStorage(search: string) {
  const now = Date.now();
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const incoming = touchFromParams(new URLSearchParams(raw));
  const firstSlots = readSlot(FIRST_TOUCH_COOKIE, now);
  const lastSlots = readSlot(LAST_TOUCH_COOKIE, now);
  const next = applyIncomingTouch(pickOlder(firstSlots.ls, firstSlots.ck), pickNewer(lastSlots.ls, lastSlots.ck), incoming, now);
  if (slotsNeedWrite(next.first, firstSlots) && next.first) writeRecord(FIRST_TOUCH_COOKIE, next.first, now);
  if (slotsNeedWrite(next.last, lastSlots) && next.last) writeRecord(LAST_TOUCH_COOKIE, next.last, now);
}

function readWithStorage(): StoredAttribution {
  const now = Date.now();
  const firstSlots = readSlot(FIRST_TOUCH_COOKIE, now);
  const lastSlots = readSlot(LAST_TOUCH_COOKIE, now);
  const first = pickOlder(firstSlots.ls, firstSlots.ck);
  const last = pickNewer(lastSlots.ls, lastSlots.ck);
  return { first: first?.touch || {}, last: last?.touch || {} };
}

export function capturePageAttribution(search: string) {
  const host = browserWindow();
  if (!host) return;
  if (typeof host.pjCaptureAttribution === "function") {
    host.pjCaptureAttribution(search);
    return;
  }
  captureWithStorage(search);
}

export function captureAndReadAttribution(): StoredAttribution {
  const host = browserWindow();
  if (!host) return { first: {}, last: {} };
  capturePageAttribution(host.location.search || "");
  if (typeof host.pjReadAttribution === "function") {
    const read = host.pjReadAttribution();
    return { first: read?.first || {}, last: read?.last || {} };
  }
  return readWithStorage();
}

export function applyStoredAttribution(form: HTMLFormElement) {
  const stored = captureAndReadAttribution();
  const first = ATTRIBUTION_KEYS.some((key) => stored.first[key]) ? stored.first : null;
  const last = ATTRIBUTION_KEYS.some((key) => stored.last[key]) ? stored.last : first;
  if (!first && !last) return;
  for (const key of ATTRIBUTION_KEYS) {
    const firstInput = form.elements.namedItem(key);
    const lastInput = form.elements.namedItem(`last_${key}`);
    if (first && firstInput instanceof HTMLInputElement) firstInput.value = first[key] || "";
    if (last && lastInput instanceof HTMLInputElement) lastInput.value = last[key] || "";
  }
}
