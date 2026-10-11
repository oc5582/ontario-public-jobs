import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasListFilter, isListPath, livePathFor } from "@/lib/cache-paths";

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => {
    if (cookie.name === "pj_local") return true;
    return cookie.name.startsWith("sb-") && cookie.name.includes("auth-token");
  });
}

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("CDN-Cache-Control", "private, no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "private, no-store");
  return response;
}

async function refreshSession(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rewrites land here too. Passing through avoids a redirect loop back to the
  // public URL. robots.txt disallows /dynamic, and the layout is noindex.
  if (pathname === "/dynamic" || pathname.startsWith("/dynamic/")) {
    const response = NextResponse.next();
    privateNoStore(response);
    if (hasSessionCookie(request)) await refreshSession(request, response);
    return response;
  }

  const session = hasSessionCookie(request);
  const live = livePathFor(pathname);
  const rewriteToLive = Boolean(live && (session || (isListPath(pathname) && hasListFilter(request.nextUrl.searchParams))));

  if (!session && !rewriteToLive) {
    // Anonymous public pages must not Set-Cookie, or the CDN will not cache them.
    return NextResponse.next();
  }

  let response: NextResponse;
  if (rewriteToLive && live) {
    const url = request.nextUrl.clone();
    url.pathname = live;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }
  privateNoStore(response);
  if (session) await refreshSession(request, response);
  return response;
}

export const config = {
  // Stripe posts to /api/stripe/webhook/ (trailing slash). That path is not
  // signed in and must not pass through session refresh or any auth redirect.
  matcher: [
    "/((?!_next/static|_next/image|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|css|js)$).*)",
  ],
};
