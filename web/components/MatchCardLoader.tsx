"use client";

import { useEffect } from "react";
import { trackEvent } from "@/components/AnalyticsEvents";

/**
 * Loads match.js only on a wide screen, and only once this card is near the viewport.
 * PDF and Word parsers stay inside match.js and run after a file is chosen.
 */
export function MatchCardLoader({ jobId, employer }: { jobId: string; employer: string }) {
  useEffect(() => {
    const root = document.getElementById("resume-match-card");
    if (!root) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    let loaded = false;
    let clicked = false;

    function loadScript() {
      if (loaded || !desktop.matches) return;
      loaded = true;
      if (document.querySelector("script[data-match-js]")) return;
      const script = document.createElement("script");
      script.src = "/match.js";
      script.defer = true;
      script.dataset.matchJs = "1";
      document.body.appendChild(script);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        loadScript();
        observer.disconnect();
      },
      { rootMargin: "240px" },
    );

    function watch() {
      if (!desktop.matches) {
        observer.disconnect();
        return;
      }
      observer.observe(root!);
    }

    function onFocusIn() {
      if (clicked || !desktop.matches) return;
      clicked = true;
      trackEvent("job_resume_card_click", { employer, job: jobId });
    }

    function onSubmit(event: Event) {
      if (!desktop.matches) return;
      const ready = (window as Window & { __pjMatch?: boolean }).__pjMatch;
      if (!ready) {
        event.preventDefault();
        loadScript();
        return;
      }
      trackEvent("job_resume_card_submit", { employer, job: jobId });
    }

    desktop.addEventListener("change", watch);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("submit", onSubmit);
    watch();

    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", watch);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("submit", onSubmit);
    };
  }, [employer, jobId]);

  return null;
}
