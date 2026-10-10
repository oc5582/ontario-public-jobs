import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publishableKey } from "./auth";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = publishableKey();
  if (!url || !key) {
    throw new Error("Supabase Auth is not configured");
  }
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot always set cookies. The middleware refresh covers that.
        }
      },
    },
  });
}
