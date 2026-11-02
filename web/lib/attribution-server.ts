import { cookies } from "next/headers";
import {
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  attributionFromForm,
  attributionFromPayload,
  decodeTouch,
  mergeAttribution,
  type StoredAttribution,
} from "./attribution";

export async function attributionFromCookieJar(now = Date.now()): Promise<StoredAttribution> {
  const store = await cookies();
  const first = decodeTouch(store.get(FIRST_TOUCH_COOKIE)?.value, now);
  const last = decodeTouch(store.get(LAST_TOUCH_COOKIE)?.value, now);
  return { first: first?.touch || {}, last: last?.touch || {} };
}

export async function attributionForCheckout(submitted: StoredAttribution, now = Date.now()): Promise<StoredAttribution> {
  const stored = await attributionFromCookieJar(now);
  return mergeAttribution(stored, submitted);
}

export async function attributionForForm(formData: FormData): Promise<StoredAttribution> {
  return attributionForCheckout(attributionFromForm(formData));
}

export async function attributionForBody(payload: unknown): Promise<StoredAttribution> {
  return attributionForCheckout(attributionFromPayload(payload));
}
