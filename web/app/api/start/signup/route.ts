import { recordAlertConsent } from "@/lib/alert-consent";
import { query } from "@/lib/db";
import { isCheckoutEmail, normalizeCheckoutEmail } from "@/lib/guest-checkout";
import { alertConsentSender } from "@/lib/legal-copy";
import { SIGNUP_ENDPOINT, SITE_URL } from "@/lib/site";
import { weeklyAlertPayload } from "@/lib/weekly-alert";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function listField(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.map((item) => String(item)) : String(value || "").split(",");
  const seen: string[] = [];
  for (const item of raw) {
    const token = item.trim().slice(0, 40);
    if (!token || seen.includes(token) || seen.length >= 12) continue;
    seen.push(token);
  }
  return seen;
}

function consentLine(kind: string): string {
  const offer = kind === "resume_reminder" ? "Free. Unsubscribe anytime." : "Free. One email a week. Unsubscribe anytime.";
  return `${offer} ${alertConsentSender()}`;
}

async function postWorker(body: Record<string, string>): Promise<boolean> {
  const endpoint = SIGNUP_ENDPOINT.trim();
  if (!endpoint) return false;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: SITE_URL,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return false;
  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean };
  return payload.ok !== false;
}

async function saveAnswers(email: string, kind: string, work: string[], areas: string[], salary: string, levels: string[]) {
  try {
    await query(
      `insert into quiz_signups (email, kind, work, areas, salary, levels)
       values ($1, $2, $3, $4, $5, $6)`,
      [email, kind, work, areas, salary, levels],
    );
  } catch (error) {
    console.info(
      JSON.stringify({
        event: "quiz_signup_store_failed",
        message: error instanceof Error ? error.message.slice(0, 160) : "error",
      }),
    );
  }
}

export async function POST(request: Request) {
  let data: {
    email?: unknown;
    quiz_kind?: unknown;
    quiz_work?: unknown;
    quiz_areas?: unknown;
    quiz_salary?: unknown;
    quiz_level?: unknown;
    _gotcha?: unknown;
  };
  try {
    data = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Enter a valid email address to see your jobs." }, { status: 400, headers: NO_STORE });
  }
  if (String(data._gotcha || "").trim()) {
    return Response.json({ ok: true }, { headers: NO_STORE });
  }
  const email = normalizeCheckoutEmail(String(data.email || ""));
  if (!isCheckoutEmail(email)) {
    return Response.json({ ok: false, error: "Enter a valid email address to see your jobs." }, { status: 400, headers: NO_STORE });
  }
  const kind = data.quiz_kind === "resume_reminder" ? "resume_reminder" : "results";
  const work = listField(data.quiz_work);
  const areas = listField(data.quiz_areas);
  const levels = listField(data.quiz_level);
  const salary = String(data.quiz_salary || "").trim().slice(0, 20);
  const quiz = {
    quiz_kind: kind,
    quiz_work: work.join(","),
    quiz_areas: areas.join(","),
    quiz_salary: salary,
    quiz_level: levels.join(","),
  };
  const base = weeklyAlertPayload(email);
  let saved = false;
  try {
    saved = await postWorker({ ...base, ...quiz });
    if (!saved) saved = await postWorker(base);
  } catch (error) {
    console.info(
      JSON.stringify({
        event: "quiz_signup_worker_failed",
        message: error instanceof Error ? error.message.slice(0, 160) : "error",
      }),
    );
  }
  if (!saved) {
    return Response.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 502, headers: NO_STORE });
  }
  const consent = consentLine(kind);
  try {
    await recordAlertConsent({ email, consentText: consent, pageUrl: `${SITE_URL}/start/` });
  } catch (error) {
    console.info(
      JSON.stringify({
        event: "alert_consent_failed",
        page: "/start/",
        message: error instanceof Error ? error.message.slice(0, 160) : "error",
      }),
    );
  }
  await saveAnswers(email, kind, work, areas, salary, levels);
  return Response.json({ ok: true }, { headers: NO_STORE });
}
