import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set("pj_dev_member", "", { path: "/", maxAge: 0 });
  return response;
}
