import { applicationKey } from "@/lib/application-key";
import { listApplicationKeys, setApplication } from "@/lib/applications";
import { reportEvent } from "@/lib/analytics";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function denied() {
  return Response.json({ ok: false }, { status: 403, headers: NO_STORE });
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer.isMember || !viewer.profile) return denied();
  const paths = await listApplicationKeys(viewer.profile.id);
  return Response.json({ ok: true, paths: [...paths] }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer.isMember || !viewer.profile) return denied();
  let body: { path?: unknown; applied?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE });
  }
  const key = applicationKey(typeof body.path === "string" ? body.path : "");
  if (!key || typeof body.applied !== "boolean") {
    return Response.json({ ok: false }, { status: 400, headers: NO_STORE });
  }
  const saved = await setApplication(viewer.profile.id, key, body.applied);
  if (!saved) return Response.json({ ok: false }, { status: 404, headers: NO_STORE });
  reportEvent("mark_applied", { action: body.applied ? "mark" : "undo" }, request);
  return Response.json({ ok: true, applied: body.applied, path: key }, { headers: NO_STORE });
}
