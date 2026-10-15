"use client";

import { installMetaBridge, trackMeta } from "@/lib/meta-pixel";
import { isRegistrationToken, REGISTRATION_COOKIE } from "@/lib/meta-registration";
import { useEffect, useRef } from "react";

function cookieValue(name: string): string {
  try {
    const prefix = `${name}=`;
    const parts = document.cookie ? document.cookie.split("; ") : [];
    const hit = parts.find((part) => part.startsWith(prefix));
    return hit ? decodeURIComponent(hit.slice(prefix.length)) : "";
  } catch {
    return "";
  }
}

function clearRegistrationCookie(): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REGISTRATION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** Reads the one-time first-sign-in cookie. Renders nothing. */
export function MetaEvents() {
  installMetaBridge();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try {
      const token = cookieValue(REGISTRATION_COOKIE);
      if (!isRegistrationToken(token)) return;
      const key = `pj-meta-reg:${token}`;
      if (localStorage.getItem(key) === "1") {
        clearRegistrationCookie();
        return;
      }
      localStorage.setItem(key, "1");
      clearRegistrationCookie();
      trackMeta("track", "CompleteRegistration");
    } catch {
      /* storage blocked: the cookie expires on its own */
    }
  }, []);
  return null;
}
