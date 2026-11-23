/** JSON body posted to the signup Worker. Same fields as the live site's app.js. */
export function weeklyAlertPayload(
  email: string,
  turnstileToken = "",
): {
  email: string;
  casl_consent: "yes";
  _gotcha: "";
  turnstile_token?: string;
} {
  const normalized = email.trim().toLowerCase();
  const payload = {
    email: normalized.length > 254 ? normalized.slice(0, 254) : normalized,
    casl_consent: "yes" as const,
    _gotcha: "" as const,
  };
  const token = turnstileToken.trim();
  if (!token) return payload;
  return { ...payload, turnstile_token: token.slice(0, 2048) };
}
