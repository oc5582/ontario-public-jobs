import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

/** IndexNow key file. 404 when INDEXNOW_KEY is unset, so the build does not need it. */
export function GET() {
  const key = (process.env.INDEXNOW_KEY || "").trim();
  if (!KEY_RE.test(key)) {
    return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
