import { recordMatchAlertConsent } from "@/lib/alert-consent";
import { getViewer, requestOrigin } from "@/lib/auth";
import { MSG, runMatch } from "@/lib/match";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.email || !viewer.profile) {
    return Response.json(
      { ok: false, code: "auth", error: MSG.auth, login: "/login/?next=/match/" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let data: { resume_text?: string; casl_consent?: unknown; _gotcha?: string };
  try {
    data = await request.json();
  } catch {
    return Response.json({ ok: false, code: "resume", error: MSG.resume }, { status: 400 });
  }

  const consent = data.casl_consent === true || ["yes", "true", "on"].includes(String(data.casl_consent || ""));
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
    gotcha: String(data._gotcha || ""),
  });
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
