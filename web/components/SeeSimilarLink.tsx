"use client";

import { trackEvent } from "@/components/AnalyticsEvents";

/** Same-tab link to the quiz. Vercel Web Analytics is cookieless and already on. */
export function SeeSimilarLink() {
  return (
    <a className="see-similar" href="/start/" onClick={() => trackEvent("see_similar_click")}>
      See Similar
    </a>
  );
}
