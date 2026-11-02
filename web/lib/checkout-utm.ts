import type { AttributionTouch } from "./attribution";
import { ATTRIBUTION_KEYS, attributionFromForm, touchFromRecord } from "./attribution";

export const CHECKOUT_UTM_KEYS = ATTRIBUTION_KEYS;

export type CheckoutUtmKey = (typeof CHECKOUT_UTM_KEYS)[number];
export type CheckoutUtm = AttributionTouch;

export function checkoutUtmFromForm(formData: FormData): CheckoutUtm {
  return attributionFromForm(formData).first;
}

export function checkoutUtmFromRecord(
  params: Record<string, string | string[] | undefined>,
): CheckoutUtm {
  return touchFromRecord(params);
}
