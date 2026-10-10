"use client";

import { pixelBlockedPath } from "@/lib/legal-copy";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "pj-ad-tracking";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push?: unknown;
};

function readChoice(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return "off";
  }
}

function loadPixel(pixelId: string) {
  const w = window as Window & { fbq?: Fbq; _fbq?: Fbq };
  if (typeof w.fbq === "function") return;
  const n = function (this: Fbq, ...args: unknown[]) {
    if (n.callMethod) n.callMethod.apply(n, args);
    else n.queue.push(args);
  } as Fbq;
  n.queue = [];
  n.loaded = true;
  n.version = "2.0";
  n.push = n;
  w.fbq = n;
  w._fbq = n;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);
  w.fbq("init", pixelId);
  w.fbq("track", "PageView");
}

export function AdNotice({ pixelId }: { pixelId: string }) {
  const path = usePathname() || "/";
  const blocked = pixelBlockedPath(path);
  const [choice, setChoice] = useState<string | null>("pending");

  useEffect(() => {
    setChoice(readChoice());
  }, []);

  useEffect(() => {
    if (choice !== "on" || blocked || !pixelId) return;
    loadPixel(pixelId);
  }, [choice, blocked, pixelId]);

  if (!pixelId || blocked || choice !== null) return null;

  function choose(next: "on" | "off") {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: leave the pixel unloaded */
    }
    setChoice(next);
  }

  return (
    <div className="ad-notice" role="dialog" aria-label="Ad tracking">
      <p>
        PublicJobs.ca can use a Meta Pixel to measure ads. It stays off until you allow it, and it is never used on
        match, account, billing, or sign-in pages. Cloudflare Web Analytics stays on and does not use cookies.{" "}
        <a href="/privacy/">Privacy</a>
      </p>
      <p className="ad-notice-actions">
        <button type="button" className="apply-btn" onClick={() => choose("on")}>
          Allow
        </button>
        <button type="button" className="apply-btn secondary" onClick={() => choose("off")}>
          No thanks
        </button>
      </p>
    </div>
  );
}

export function turnOffAdTracking() {
  try {
    localStorage.setItem(KEY, "off");
  } catch {
    /* ignore */
  }
  window.location.reload();
}
