import { consentForPage, recordAlertConsent } from "@/lib/alert-consent";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let email = "";
  let pageUrl = "/";
  try {
    const body = (await request.json()) as { email?: unknown; page_url?: unknown };
    email = String(body.email || "");
    pageUrl = String(body.page_url || "/").slice(0, 500);
  } catch {
    return Response.json({ ok: false, error: "Expected JSON." }, { status: 400 });
  }
  if (!email.includes("@")) return Response.json({ ok: false, error: "Enter an email." }, { status: 400 });
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
    return Response.json({ ok: false }, { status: 503 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
