/** RFC 5321 maximum. Longer input must not reach a regex. */
export const MAX_EMAIL_LENGTH = 254;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trimmed email, or "" when it is empty or longer than 254 characters.
 * Never slices a long address into a different one.
 */
export function boundedEmail(value: unknown): string {
  const email = String(value ?? "").trim();
  if (!email || email.length > MAX_EMAIL_LENGTH) return "";
  return email;
}

export function boundedEmailLower(value: unknown): string {
  return boundedEmail(value).toLowerCase();
}

/** Length is checked before the pattern so a huge string cannot stall the regex. */
export function isBasicEmail(value: string): boolean {
  if (value.length < 3 || value.length > MAX_EMAIL_LENGTH) return false;
  return EMAIL_RE.test(value);
}
