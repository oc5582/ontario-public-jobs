import { getViewer } from "@/lib/auth";
import { canEnableWeeklyEmail, weeklyMemberGuard } from "@/lib/weekly-match";
import { loadWeeklyAccount, setWeeklyOptIn } from "@/lib/weekly-match-data";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const viewer = await getViewer();
  const guard = weeklyMemberGuard(viewer);
  if (!guard.ok) return Response.json({ ok: false, error: guard.error }, { status: guard.status, headers: NO_STORE });
  let data: { opted_in?: unknown; _gotcha?: unknown };
  try {
    data = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Choose whether to get the weekly email." }, { status: 400, headers: NO_STORE });
  }
  if (String(data._gotcha || "").trim()) return Response.json({ ok: true, optedIn: false }, { headers: NO_STORE });
  const optedIn = data.opted_in === true || ["yes", "true", "on"].includes(String(data.opted_in || ""));
  if (optedIn) {
    const state = await loadWeeklyAccount(viewer.profile!.id);
    if (!canEnableWeeklyEmail(viewer.isMember, Boolean(state.saved))) {
      return Response.json(
        { ok: false, error: "Save a resume before turning on the weekly email." },
        { status: 400, headers: NO_STORE },
      );
    }
  }
  const saved = await setWeeklyOptIn(viewer.profile!.id, optedIn);
  if (!saved.ok) return Response.json({ ok: false, error: saved.error }, { status: saved.status, headers: NO_STORE });
  return Response.json({ ok: true, optedIn: saved.optedIn }, { headers: NO_STORE });
}
