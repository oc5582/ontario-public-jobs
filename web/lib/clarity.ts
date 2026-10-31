/**
 * Consent-gated Microsoft Clarity. Uses the same Allow / No thanks choice
 * as the Meta Pixel (localStorage key pj-ad-tracking). Renders nothing when
 * the project id is missing or consent was not granted. Nothing here throws.
 *
 * The notice stays hidden on pricing, match, account, and sign-in, same as
 * the pixel. Those pages still load Clarity when Allow was already saved.
 */

import { adConsentGranted } from "@/lib/meta-pixel";

const CLARITY_PROJECT_ID = /^[A-Za-z0-9]{4,32}$/;

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

type ClarityWindow = Window & {
  clarity?: ClarityFn;
};

/** Public project id, or "" when unset or not a Clarity id. */
export function clarityProjectId(value = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || ""): string {
  const id = value.trim();
  return CLARITY_PROJECT_ID.test(id) ? id : "";
}

/** Official tag. Async script, never document.write. No-ops without consent. */
export function loadClarity(projectId: string): void {
  try {
    if (typeof window === "undefined") return;
    const id = clarityProjectId(projectId);
    if (!id || !adConsentGranted()) return;
    const w = window as ClarityWindow;
    if (typeof w.clarity === "function") return;
    const clarity = function (...args: unknown[]) {
      (clarity.q = clarity.q || []).push(args);
    } as ClarityFn;
    w.clarity = clarity;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${id}`;
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);
  } catch {
    /* storage blocked, or the stub was replaced: never throw */
  }
}
