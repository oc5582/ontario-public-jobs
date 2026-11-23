const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True when the server will require a Turnstile token. Unset means the check is off. */
export function turnstileRequired(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export function turnstileToken(formData: FormData): string {
  return String(formData.get("cf-turnstile-response") || "").trim().slice(0, 2048);
}

/**
 * Passes when TURNSTILE_SECRET_KEY is unset, so forms keep working until a widget exists.
 * When the secret is set, a missing or rejected token fails closed.
 */
export async function turnstileOk(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
