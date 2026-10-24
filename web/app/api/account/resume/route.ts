import { getViewer } from "@/lib/auth";
import { cleanFilename, resumeSource, weeklyMemberGuard } from "@/lib/weekly-match";
import { removeWeeklyResume, saveWeeklyResume } from "@/lib/weekly-match-data";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  const guard = weeklyMemberGuard(viewer);
  if (!guard.ok) return json({ ok: false, error: guard.error }, guard.status);
  let data: { resume_text?: unknown; source?: unknown; filename?: unknown; _gotcha?: unknown };
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Add your resume. Upload a PDF or Word file, or paste the text." }, 400);
  }
  if (String(data._gotcha || "").trim()) return json({ ok: true, charCount: 0 });
  const source = resumeSource(data.source);
  if (!source) return json({ ok: false, error: "Use a PDF or Word file, or paste the text." }, 400);
  const saved = await saveWeeklyResume(
    viewer.profile!.id,
    String(data.resume_text || ""),
    source,
    cleanFilename(data.filename),
  );
  if (!saved.ok) return json({ ok: false, error: saved.error }, saved.status);
  return json({ ok: true, charCount: saved.charCount });
}

export async function DELETE() {
  const viewer = await getViewer();
  const guard = weeklyMemberGuard(viewer);
  if (!guard.ok) return json({ ok: false, error: guard.error }, guard.status);
  await removeWeeklyResume(viewer.profile!.id);
  return json({ ok: true });
}
