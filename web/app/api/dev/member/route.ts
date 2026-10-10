import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.ALLOW_DEV_MEMBER !== "1" || !process.env.DEV_MEMBER_TOKEN) {
    return NextResponse.json({ error: "Dev member sign-in is off." }, { status: 404 });
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set("pj_dev_member", process.env.DEV_MEMBER_TOKEN, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
