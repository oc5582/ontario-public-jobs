/**
 * Consent-gated Meta Pixel. The Allow / No thanks choice lives in
 * localStorage under the same key the notice writes. Calls queue on the
 * standard fbq stub when the script has not finished loading, and they
 * no-op when consent is missing. Nothing here throws.
 *
 * The notice still hides itself on match, account, pricing, and sign-in
 * pages. A funnel event on one of those pages loads this same pixel only
 * when consent was already granted on another page.
 */

export const AD_TRACKING_KEY = "pj-ad-tracking";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push?: Fbq;
};

export type MetaCommand = "track" | "trackCustom";
export type MetaParams = Record<string, string | number>;

type MetaWindow = Window & {
  fbq?: Fbq;
  _fbq?: Fbq;
  pjTrackMeta?: (
    command: MetaCommand,
    name: string,
    params?: MetaParams,
    eventID?: string,
  ) => void;
};

export function adConsentGranted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AD_TRACKING_KEY) === "on";
  } catch {
    return false;
  }
}

/** Same stub the notice uses. Async script, never document.write. */
export function loadMetaPixel(pixelId: string): void {
  if (typeof window === "undefined" || !pixelId) return;
  const w = window as MetaWindow;
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

export function metaArguments(
  command: MetaCommand,
  name: string,
  params?: MetaParams,
  eventID?: string,
): unknown[] {
  if (params && eventID) return [command, name, params, { eventID }];
  if (params) return [command, name, params];
  if (eventID) return [command, name, {}, { eventID }];
  return [command, name];
}

export function trackMeta(
  command: MetaCommand,
  name: string,
  params?: MetaParams,
  eventID?: string,
): void {
  try {
    if (!adConsentGranted()) return;
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
    if (!pixelId) return;
    loadMetaPixel(pixelId);
    const fbq = (window as MetaWindow).fbq;
    if (typeof fbq !== "function") return;
    fbq(...metaArguments(command, name, params, eventID));
  } catch {
    /* storage blocked, or the stub was replaced: never throw */
  }
}

/** match.js calls this after results render. It no-ops until this bundle runs. */
export function installMetaBridge(): void {
  if (typeof window === "undefined") return;
  (window as MetaWindow).pjTrackMeta = trackMeta;
}
