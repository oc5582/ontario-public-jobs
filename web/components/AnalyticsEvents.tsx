"use client";

import { track } from "@vercel/analytics";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { paywallPage } from "@/lib/paywall-page";

/** Mounted only when the membership card is on the page, once per page view. */
export function PaywallView() {
  const pathname = usePathname() || "/";
  useEffect(() => {
    track("paywall_view", { page: paywallPage(pathname) });
  }, [pathname]);
  return null;
}

export function PricingView() {
  useEffect(() => {
    track("pricing_view");
  }, []);
  return null;
}
