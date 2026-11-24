"use client";

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

function turnstileApi(): TurnstileApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  return api || null;
}

/**
 * Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 * The widget stays hidden unless Cloudflare asks the visitor to interact.
 */
export function TurnstileField({ action }: { action: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    const render = () => {
      const api = turnstileApi();
      if (cancelled || !api || el.dataset.widgetId) return;
      const id = api.render(el, {
        sitekey: SITE_KEY,
        action,
        appearance: "interaction-only",
      });
      el.dataset.widgetId = id;
    };

    if (turnstileApi()) {
      render();
    } else {
      let script = document.querySelector("script[data-turnstile]");
      if (!script) {
        const created = document.createElement("script");
        created.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        created.async = true;
        created.dataset.turnstile = "1";
        document.head.appendChild(created);
        script = created;
      }
      script.addEventListener("load", render);
    }

    return () => {
      cancelled = true;
      const id = el.dataset.widgetId;
      const api = turnstileApi();
      if (id && api) api.remove(id);
      delete el.dataset.widgetId;
    };
  }, [action]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="cf-turnstile" />;
}
