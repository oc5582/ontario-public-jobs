import type Stripe from "stripe";

/**
 * Exclusive GST/HST for a Canadian billing province.
 * Quebec is GST only: PublicJobs.ca is not registered for QST.
 * Keep this list in sync with scripts/stripe_tax_rates.mjs.
 */
export const CA_TAX_JURISDICTIONS = [
  { code: "AB", name: "Alberta", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "BC", name: "British Columbia", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "MB", name: "Manitoba", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "NB", name: "New Brunswick", percentage: 15, displayName: "HST", taxType: "hst" },
  { code: "NL", name: "Newfoundland and Labrador", percentage: 15, displayName: "HST", taxType: "hst" },
  { code: "NS", name: "Nova Scotia", percentage: 15, displayName: "HST", taxType: "hst" },
  { code: "NT", name: "Northwest Territories", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "NU", name: "Nunavut", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "ON", name: "Ontario", percentage: 13, displayName: "HST", taxType: "hst" },
  { code: "PE", name: "Prince Edward Island", percentage: 15, displayName: "HST", taxType: "hst" },
  { code: "QC", name: "Quebec", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "SK", name: "Saskatchewan", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "YT", name: "Yukon", percentage: 5, displayName: "GST", taxType: "gst" },
] as const;

export type ProvinceCode = (typeof CA_TAX_JURISDICTIONS)[number]["code"];
export type TaxJurisdiction = (typeof CA_TAX_JURISDICTIONS)[number];

export const TAX_RATE_METADATA_KEY = "publicjobs_tax";
export const TAX_RATE_METADATA_VALUE = "ca_gst_hst";

const rateCache = new Map<ProvinceCode, string>();

export function clearTaxRateCache(): void {
  rateCache.clear();
}

export function taxRateEnvName(code: ProvinceCode): string {
  return `STRIPE_TAX_RATE_${code}`;
}

export function provinceByCode(code: string): TaxJurisdiction | null {
  const found = CA_TAX_JURISDICTIONS.find((item) => item.code === code);
  return found ?? null;
}

export function isProvinceCode(code: string): code is ProvinceCode {
  return provinceByCode(code) !== null;
}

export function taxRateIdFromEnv(code: ProvinceCode): string | null {
  const value = process.env[taxRateEnvName(code)]?.trim();
  return value || null;
}

function matchesJurisdiction(rate: Stripe.TaxRate, item: TaxJurisdiction): boolean {
  return (
    rate.active !== false &&
    rate.inclusive === false &&
    rate.metadata?.[TAX_RATE_METADATA_KEY] === TAX_RATE_METADATA_VALUE &&
    rate.metadata?.province === item.code &&
    Number(rate.percentage) === item.percentage
  );
}

async function loadTaxRateIds(stripe: Stripe): Promise<void> {
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.taxRates.list({ limit: 100, active: true, starting_after: startingAfter });
    for (const rate of page.data) {
      const item = provinceByCode(rate.metadata?.province || "");
      if (!item || rateCache.has(item.code) || !matchesJurisdiction(rate, item)) continue;
      rateCache.set(item.code, rate.id);
    }
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
}

/** Env var wins. Otherwise the active Stripe tax rate with our metadata. */
export async function taxRateIdForProvince(stripe: Stripe, code: ProvinceCode): Promise<string | null> {
  const fromEnv = taxRateIdFromEnv(code);
  if (fromEnv) return fromEnv;
  if (!rateCache.has(code)) await loadTaxRateIds(stripe);
  return rateCache.get(code) ?? null;
}
