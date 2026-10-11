/** Session cookie lifetime. The Supabase SSR helper otherwise keeps cookies for 400 days. */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type CookieSettings = {
  path?: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  [key: string]: unknown;
};

/** Secure, HttpOnly, SameSite=Lax. maxAge 0 still clears the cookie. */
export function authCookieSettings<T extends CookieSettings>(options: T = {} as T): T {
  const clearing = options.maxAge === 0;
  const next: CookieSettings = {
    ...options,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: clearing ? 0 : AUTH_COOKIE_MAX_AGE,
  };
  delete next.expires;
  return next as T;
}
