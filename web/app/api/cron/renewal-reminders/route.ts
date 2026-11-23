import { sendDueRenewalReminders } from "@/lib/renewal-reminders";
import { cronAuthorized } from "@/lib/weekly-match";

export const dynamic = "force-dynamic";

async function run(request: Request): Promise<Response> {
  const auth = cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "missing") return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  if (auth === "denied") return Response.json({ error: "Unauthorized." }, { status: 401 });
  const result = await sendDueRenewalReminders();
  return Response.json(result);
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
