import { cronAuthorized } from "@/lib/weekly-match";
import { runWeeklyMatches } from "@/lib/weekly-match-data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function dryRun(request: Request): boolean {
  const flag = new URL(request.url).searchParams.get("dry_run");
  return flag === "1" || flag === "true";
}

async function run(request: Request): Promise<Response> {
  const auth = cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "missing") return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  if (auth === "denied") return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const result = await runWeeklyMatches({ dryRun: dryRun(request) });
    return Response.json(result);
  } catch (error) {
    console.log(JSON.stringify({
      event: "weekly_match_failed",
      reason: "cron",
      message: error instanceof Error ? error.message.slice(0, 120) : "error",
    }));
    return Response.json({ ok: false, error: "Weekly matches did not finish." }, { status: 500 });
  }
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
