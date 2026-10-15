"use client";

import { trackMeta } from "@/lib/meta-pixel";
import { useEffect, useRef } from "react";

type PurchaseEvent = {
  eventId: string;
  value: number;
  contentName: string;
};

/** Fires Purchase once. The server already claimed the session id. */
export function PurchasePixel({ event }: { event: PurchaseEvent | null }) {
  const started = useRef(false);
  useEffect(() => {
    if (!event || started.current) return;
    started.current = true;
    const key = `pj-meta-purchase:${event.eventId}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      /* a missing backup still has the server claim */
    }
    trackMeta(
      "track",
      "Purchase",
      { value: event.value, currency: "CAD", content_name: event.contentName },
      event.eventId,
    );
  }, [event]);
  return null;
}
