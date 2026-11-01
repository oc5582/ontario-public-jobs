export const CHECKOUT_UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type CheckoutUtmKey = (typeof CHECKOUT_UTM_KEYS)[number];
export type CheckoutUtm = Partial<Record<CheckoutUtmKey, string>>;

function cleanUtm(value: string): string {
  return value.trim().slice(0, 200);
}

export function checkoutUtmFromForm(formData: FormData): CheckoutUtm {
  const utm: CheckoutUtm = {};
  for (const key of CHECKOUT_UTM_KEYS) {
    const value = cleanUtm(String(formData.get(key) || ""));
    if (value) utm[key] = value;
  }
  return utm;
}

export function checkoutUtmFromRecord(
  params: Record<string, string | string[] | undefined>,
): CheckoutUtm {
  const utm: CheckoutUtm = {};
  for (const key of CHECKOUT_UTM_KEYS) {
    const raw = params[key];
    const value = cleanUtm(Array.isArray(raw) ? raw[0] || "" : raw || "");
    if (value) utm[key] = value;
  }
  return utm;
}
