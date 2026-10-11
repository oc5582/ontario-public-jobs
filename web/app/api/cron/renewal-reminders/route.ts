import { sendDueRenewalReminders } from "@/lib/renewal-reminders";

export const dynamic = "force-dynamic";

async function run(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  const header = request.headers.get("authorization") || "";
  if (header !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const result = await sendDueRenewalReminders();
  return Response.json(result);
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
