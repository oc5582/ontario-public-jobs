/**
 * Owner facts for terms, privacy, checkout, emails, and CASL.
 * Fill the bracketed values in this file only. A production build refuses to
 * ship while any of them are still placeholders. Preview builds may keep them.
 *
 * Defaults already chosen: prices are shown before tax and GST/HST is added
 * where it applies; a full refund is available within 14 days of the first
 * purchase and of each renewal, once per account in any 12 months; memberships
 * are offered to people in Canada.
 */

export const LEGAL = {
  legalName: "[LEGAL_NAME]",
  businessName: "[BUSINESS_NAME]",
  mailingAddress: "[MAILING_ADDRESS]",
  phone: "[PHONE]",
  supportEmail: "[SUPPORT_EMAIL]",
  privacyOfficerEmail: "[PRIVACY_OFFICER_EMAIL]",
  hstNumber: "[HST_NUMBER]",
  /** Prices on the site do not include tax. */
  pricesIncludeTax: false,
  /** Full refund of the first purchase and of each renewal, once per 12 months. */
  refundScope: "full_first_and_renewal_once_per_12_months" as const,
  /** Memberships are offered to people in Canada. */
  sellTo: "Canada" as const,
  termsVersion: "2026-10-10",
  effectiveDate: "October 10, 2026",
  fraudPolicyUpdated: "October 10, 2026",
  fraudReviewBusinessDays: 2,
  fraudRecordYears: 3,
  refundBusinessDays: 5,
  minimumAge: "18, or the age of majority where you live if that is higher",
  yearlyReminderDays: 30,
  quarterReminderDays: 7,
  priceChangeMinDays: 30,
  priceChangeMaxDays: 90,
  privacyOfficerName: "[LEGAL_NAME]",
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
