import { consentForPage, recordAlertConsent } from "@/lib/alert-consent";
import { clientIpFrom } from "@/lib/client-ip";
import { boundedEmailLower, isBasicEmail } from "@/lib/email-address";
import { requestAllowed, RULES } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  let email = "";
  let pageUrl = "/";
  try {
    const body = (await request.json()) as { email?: unknown; page_url?: unknown };
    email = boundedEmailLower(body.email);
    pageUrl = String(body.page_url || "/").slice(0, 500);
  } catch {
    return Response.json({ ok: false, error: "Expected JSON." }, { status: 400, headers: NO_STORE });
  }
  if (!isBasicEmail(email)) return Response.json({ ok: false, error: "Enter an email." }, { status: 400, headers: NO_STORE });
  const allowed = await requestAllowed({
    scope: "alert-consent",
    ip,
    email,
    ipRule: RULES.alertConsent.ip,
    emailRule: RULES.alertConsent.email,
  });
  if (!allowed) {
    return Response.json(
      { ok: false, error: "Please wait a few minutes and try again." },
      { status: 429, headers: NO_STORE },
    );
  }
  const record = consentForPage(pageUrl);
  try {
    await recordAlertConsent({ email, consentText: record.consentText, pageUrl: record.pageUrl });
  } catch (error) {
    console.info(
      JSON.stringify({
        event: "alert_consent_failed",
        page: record.pageUrl,
        message: error instanceof Error ? error.message.slice(0, 160) : "error",
      }),
    );
    return Response.json({ ok: false }, { status: 503, headers: NO_STORE });
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}
