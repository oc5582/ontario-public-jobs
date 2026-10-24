import { unsubscribeWeeklyMatch } from "@/lib/weekly-match-data";

export const dynamic = "force-dynamic";

function tokenFrom(request: Request): string {
  return (new URL(request.url).searchParams.get("token") || "").trim();
}

export async function GET(request: Request) {
  const turnedOff = await unsubscribeWeeklyMatch(tokenFrom(request));
  const dest = new URL("/weekly-matches/unsubscribed/", request.url);
  dest.searchParams.set("done", turnedOff ? "1" : "0");
  return Response.redirect(dest, 303);
}

/** One-click unsubscribe (List-Unsubscribe-Post). */
export async function POST(request: Request) {
  const turnedOff = await unsubscribeWeeklyMatch(tokenFrom(request));
  return new Response(null, { status: turnedOff ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
