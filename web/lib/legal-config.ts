/**
 * Owner facts for terms, privacy, checkout, emails, and CASL.
 * This is the only file that holds them. A production build refuses to ship
 * while any bracketed placeholder remains. Preview builds may keep them.
 *
 * Prices are shown plus applicable GST/HST. A full refund is available within
 * 5 days of the first purchase and of each renewal, once per account in any
 * 12 months. Memberships are offered in Canada only.
 */

export const LEGAL = {
  legalName: "Osama Chaudhary",
  businessName: "PublicJobs.ca",
  mailingAddress: "603-65 Thorncliffe Park Drive, Toronto, Ontario M4H 1L2, Canada",
  streetAddress: "603-65 Thorncliffe Park Drive",
  addressLocality: "Toronto",
  addressRegion: "Ontario",
  postalCode: "M4H 1L2",
  addressCountry: "CA",
  phone: "(647) 917-3942",
  phoneTel: "tel:+16479173942",
  supportEmail: "hello@publicjobs.ca",
  privacyOfficerEmail: "hello@publicjobs.ca",
  privacyOfficerName: "Osama Chaudhary",
  hstNumber: "712442870RT0001",
  /** Prices on the site do not include tax. GST/HST is added at checkout. */
  pricesIncludeTax: false,
  /** Full refund of the first purchase and of each renewal, once per 12 months. */
  refundScope: "full_first_and_renewal_once_per_12_months" as const,
  /** Memberships are offered in Canada only. */
  sellTo: "Canada only" as const,
  termsVersion: "2026-10-11",
  effectiveDate: "October 11, 2026",
  fraudPolicyUpdated: "October 10, 2026",
  fraudReviewBusinessDays: 2,
  fraudRecordYears: 3,
  /** Days after the charge during which a full refund can be requested. */
  refundWindowDays: 5,
  /** Business days to send the refund to the original payment method. */
  refundBusinessDays: 5,
  minimumAge: "18, or the age of majority where you live if that is higher",
  yearlyReminderDays: 30,
  quarterReminderDays: 7,
  priceChangeMinDays: 30,
  priceChangeMaxDays: 90,
} as const;

export const LEGAL_PLACEHOLDERS = [
  "[LEGAL_NAME]",
  "[BUSINESS_NAME]",
  "[MAILING_ADDRESS]",
  "[PHONE]",
  "[SUPPORT_EMAIL]",
  "[PRIVACY_OFFICER_EMAIL]",
  "[HST_NUMBER]",
] as const;

export function unresolvedLegalPlaceholders(): string[] {
  const blob = Object.values(LEGAL)
    .filter((value) => typeof value === "string")
    .join("\n");
  return LEGAL_PLACEHOLDERS.filter((token) => blob.includes(token));
}

export function isPlaceholder(value: string): boolean {
  return value.includes("[") && value.includes("]");
}

export function supportMailto(): string | null {
  return isPlaceholder(LEGAL.supportEmail) ? null : LEGAL.supportEmail;
}
