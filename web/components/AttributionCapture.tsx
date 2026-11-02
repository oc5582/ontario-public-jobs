"use client";

import { capturePageAttribution } from "@/lib/attribution-browser";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Records ad parameters on client navigations. Renders nothing. */
export function AttributionCapture() {
  const search = useSearchParams();
  const query = search.toString();
  useEffect(() => {
    capturePageAttribution(query ? `?${query}` : "");
  }, [query]);
  return null;
}
