import { query } from "./db";
import { homepageConsentText, matchConsentText } from "./legal-copy";
import { SITE_URL } from "./site";

export async function recordAlertConsent(input: {
  email: string;
  consentText: string;
  pageUrl: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || email.length > 254) return;
  await query(`insert into alert_consents (email, consent_text, page_url) values ($1, $2, $3)`, [
    email,
    input.consentText.slice(0, 2000),
    input.pageUrl.slice(0, 500),
  ]);
}

/** Records the match-page wording. A failure must not block matching. */
export async function recordMatchAlertConsent(email: string, pageUrl: string): Promise<void> {
  try {
    await recordAlertConsent({
      email,
      consentText: matchConsentText(),
      pageUrl,
    });
  } catch (error) {
    console.info(
      JSON.stringify({
        event: "alert_consent_failed",
        page: "match",
        message: error instanceof Error ? error.message.slice(0, 160) : "error",
      }),
    );
  }
}

function sameSite(pageUrl: string): { path: string; stored: string } {
  if (!pageUrl.startsWith("http")) {
    const path = pageUrl.startsWith("/") ? pageUrl : `/${pageUrl}`;
    return { path, stored: "" };
  }
  try {
    const url = new URL(pageUrl);
    const host = url.hostname;
    const allowed =
      host === "publicjobs.ca" ||
      host.endsWith(".publicjobs.ca") ||
      host.endsWith(".vercel.app") ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (!allowed) return { path: "/", stored: "" };
    return { path: url.pathname || "/", stored: `${url.origin}${url.pathname || "/"}` };
  } catch {
    return { path: "/", stored: "" };
  }
}

export function consentForPage(pageUrl: string): { consentText: string; pageUrl: string } {
  const parsed = sameSite(pageUrl);
  const path = parsed.path.startsWith("/") ? parsed.path : `/${parsed.path}`;
  const match = path.replace(/\/$/, "") === "/match";
  const canonicalPath = path.endsWith("/") ? path : `${path}/`;
  return {
    consentText: match ? matchConsentText() : homepageConsentText(),
    pageUrl: parsed.stored || `${SITE_URL}${canonicalPath}`,
  };
}
