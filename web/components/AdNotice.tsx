"use client";

import { loadClarity } from "@/lib/clarity";
import { pixelBlockedPath } from "@/lib/legal-copy";
import { AD_TRACKING_KEY, loadMetaPixel } from "@/lib/meta-pixel";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function readChoice(): string | null {
  try {
    return localStorage.getItem(AD_TRACKING_KEY);
  } catch {
    return "off";
  }
}

function NoticeCopy({ pixelId, clarityId }: { pixelId: string; clarityId: string }) {
  const privacy = <a href="/privacy/">Privacy</a>;
  if (pixelId && clarityId) {
    return (
      <p>
        PublicJobs.ca can use a Meta Pixel to measure ads, and Microsoft Clarity for heatmaps and session replay. Both
        stay off until you allow them. Cloudflare Web Analytics stays on and does not use cookies. {privacy}
      </p>
    );
  }
  if (clarityId) {
    return (
      <p>
        PublicJobs.ca can use Microsoft Clarity for heatmaps and session replay. It stays off until you allow it.
        Cloudflare Web Analytics stays on and does not use cookies. {privacy}
      </p>
    );
  }
  return (
    <p>
      PublicJobs.ca can use a Meta Pixel to measure ads. It stays off until you allow it. Cloudflare Web Analytics
      stays on and does not use cookies. {privacy}
    </p>
  );
}

export function AdNotice({ pixelId, clarityId = "" }: { pixelId: string; clarityId?: string }) {
  const path = usePathname() || "/";
  const blocked = pixelBlockedPath(path);
  const [choice, setChoice] = useState<string | null>("pending");

  useEffect(() => {
    setChoice(readChoice());
  }, []);

  useEffect(() => {
    if (choice !== "on" || blocked || !pixelId) return;
    loadMetaPixel(pixelId);
  }, [choice, blocked, pixelId]);

  useEffect(() => {
    if (choice !== "on" || !clarityId) return;
    loadClarity(clarityId);
  }, [choice, clarityId]);

  if ((!pixelId && !clarityId) || blocked || choice !== null) return null;

  function choose(next: "on" | "off") {
    try {
      localStorage.setItem(AD_TRACKING_KEY, next);
    } catch {
      /* storage blocked: leave the pixel unloaded */
    }
    setChoice(next);
  }

  return (
    <div className="ad-notice" role="dialog" aria-label={clarityId ? "Tracking" : "Ad tracking"}>
      <NoticeCopy pixelId={pixelId} clarityId={clarityId} />
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
    localStorage.setItem(AD_TRACKING_KEY, "off");
  } catch {
    /* ignore */
  }
  window.location.reload();
}
