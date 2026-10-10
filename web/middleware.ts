import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import redirects from "./legacy-redirects.json";

const LEGACY = redirects as Record<string, string>;

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  const target = LEGACY[pathname];
  if (target) {
    return NextResponse.redirect(new URL(target, request.url), 301);
  }
  if (/^\/jobs\/page\/\d+$/.test(pathname)) {
    return NextResponse.redirect(new URL("/jobs/", request.url), 301);
  }
  if (url.searchParams.has("page")) {
    url.searchParams.delete("page");
    return NextResponse.redirect(url, 301);
  }

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    await supabase.auth.getUser();
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|fonts/|.*\\.(?:css|js|png|ico|woff2|svg|txt|xml|webp)$).*)"],
};
