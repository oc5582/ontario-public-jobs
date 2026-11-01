"use client";

import { track } from "@vercel/analytics";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { installAnalyticsQueue } from "@/lib/analytics-queue";
import { trackMeta } from "@/lib/meta-pixel";
import { paywallPage } from "@/lib/paywall-page";

export function trackEvent(name: string, properties?: Record<string, string>): void {
  installAnalyticsQueue(window);
  track(name, properties);
}

/** Mounted only when the membership card is on the page, once per page view. */
export function PaywallView() {
  const pathname = usePathname() || "/";
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    // /start is an ad quiz. It has its own plans screen and must not count as a paywall view.
    if (path === "/start") return;
    if (sent.current === pathname) return;
    sent.current = pathname;
    trackEvent("paywall_view", { page: paywallPage(pathname) });
  }, [pathname]);
  return null;
}

export function PricingView() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackEvent("pricing_view");
    trackMeta("track", "ViewContent", { content_name: "pricing" });
  }, []);
  return null;
}
