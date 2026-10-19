import { cookies } from "next/headers";
import { recordMatchAlertConsent } from "@/lib/alert-consent";
import { reportEvent } from "@/lib/analytics";
import { getViewer, requestOrigin } from "@/lib/auth";
import {
  FREE_COOKIE,
  FREE_COOKIE_MAX_AGE,
  FREE_RUNS_PER_EMAIL,
  MSG,
  cookieRuns,
  isValidEmail,
  runGuestMatch,
  runMatch,
} from "@/lib/match";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" };

function consentValue(value: unknown): boolean {
  return value === true || ["yes", "true", "on"].includes(String(value || ""));
}

/** Client IP as Vercel reports it. Only an HMAC of it is stored. */
function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip") || "";
  const forwarded = (request.headers.get("x-forwarded-for") || "").split(",")[0] || "";
  return (real || forwarded).trim().slice(0, 64) || "unknown";
}

/** Browser counter of free matches, 1 to FREE_RUNS_PER_EMAIL. */
function freeCookie(request: Request, runs: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const value = Math.max(1, Math.min(FREE_RUNS_PER_EMAIL, Math.floor(runs)));
  return `${FREE_COOKIE}=${value}; Path=/; Max-Age=${FREE_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

export async function POST(request: Request) {
  let data: { email?: unknown; resume_text?: string; casl_consent?: unknown; _gotcha?: string; run_id?: unknown };
  try {
    data = await request.json();
  } catch {
    return Response.json({ ok: false, code: "resume", error: MSG.resume }, { status: 400, headers: NO_STORE });
  }
  const consent = consentValue(data.casl_consent);
  const gotcha = String(data._gotcha || "");
  const viewer = await getViewer();

  if (!viewer.email || !viewer.profile) {
    const email = String(data.email || "").trim();
    if (!gotcha.trim() && isValidEmail(email)) {
      reportEvent("match_email", { alerts: consent ? "yes" : "no" }, request);
    }
    const store = await cookies();
    const browserRuns = cookieRuns(store.get(FREE_COOKIE)?.value);
    const result = await runGuestMatch({
      email,
      resumeText: String(data.resume_text || ""),
      consent,
      gotcha,
      browserRuns,
      runId: data.run_id,
      ip: clientIp(request),
      // Same as the signed-in path: the consent record is written before the Worker subscribes the address.
      beforeWorker: consent
        ? async () => {
            const origin = await requestOrigin();
            await recordMatchAlertConsent(email, `${origin}/match/`);
          }
        : undefined,
    });
    const headers: Record<string, string> = { ...NO_STORE };
    if (result.status === 200 && result.body.ok && !gotcha.trim()) {
      // A resent copy carries the same cookie as the original, so this still counts the run once.
      headers["Set-Cookie"] = freeCookie(request, browserRuns + 1);
      if (!result.body.repeat) reportEvent("match_run", { tier: "guest" }, request);
    } else if (result.body.code === "free_used") {
      headers["Set-Cookie"] = freeCookie(request, FREE_RUNS_PER_EMAIL);
    }
    return Response.json(result.body, { status: result.status, headers });
  }

  if (consent) {
    const origin = await requestOrigin();
    await recordMatchAlertConsent(viewer.email, `${origin}/match/`);
  }
  const result = await runMatch({
    profileId: viewer.profile.id,
    email: viewer.email,
    isMember: viewer.isMember,
    resumeText: String(data.resume_text || ""),
    consent,
    gotcha,
  });
  if (result.status === 200 && result.body.ok && !gotcha.trim()) {
    reportEvent("match_run", { tier: viewer.isMember ? "member" : "free" }, request);
  }
  return Response.json(result.body, { status: result.status, headers: NO_STORE });
}
