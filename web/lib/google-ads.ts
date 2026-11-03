/**
 * Consent-gated Google Ads tag (gtag.js). Uses the same Allow / No thanks
 * choice as the Meta Pixel (localStorage key pj-ad-tracking). The tag stays
 * unloaded until that choice is on. Conversion calls queue on the gtag stub
 * when the script has not finished loading, and they no-op when consent is
 * missing. Nothing here throws.
 *
 * The notice still hides itself on match, account, pricing, and sign-in
 * pages. A conversion on one of those pages loads this same tag only when
 * consent was already granted on another page.
 */

import { adConsentGranted } from "./meta-pixel";

export const GOOGLE_ADS_ID = "AW-18551087606";
export const GOOGLE_ADS_LEAD_SEND_TO = "AW-18551087606/0DrtCOn7p7AdEPbD7I1F";
export const GOOGLE_ADS_PURCHASE_SEND_TO = "AW-18551087606/gdg0COb7p7AdEPbD7I1F";

export type GoogleAdsParams = Record<string, string | number>;

type Gtag = (...args: unknown[]) => void;

type GoogleWindow = Window & {
  dataLayer?: unknown[];
  gtag?: Gtag;
  pjTrackGoogleAds?: (sendTo: string, params?: GoogleAdsParams) => void;
  pjTrackGoogleAdsPurchase?: (value: number, transactionId: string) => void;
};

export function googleAdsConversionPayload(sendTo: string, params?: GoogleAdsParams): GoogleAdsParams {
  return { send_to: sendTo, ...params };
}

/** Same stub the notice uses. Async script, never document.write. No-ops without consent. */
export function loadGoogleAds(adsId = GOOGLE_ADS_ID): void {
  try {
    if (typeof window === "undefined" || !adsId) return;
    if (!adConsentGranted()) return;
    const w = window as GoogleWindow;
    if (typeof w.gtag === "function") return;
    w.dataLayer = w.dataLayer || [];
    // Google's loader reads an Arguments object from dataLayer, not a rest array.
    w.gtag = function gtag() {
      w.dataLayer!.push(arguments);
    };
    w.gtag("js", new Date());
    w.gtag("config", adsId);
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(adsId)}`;
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);
  } catch {
    /* storage blocked, or the stub was replaced: never throw */
  }
}

export function trackGoogleAdsConversion(sendTo: string, params?: GoogleAdsParams): void {
  try {
    if (!sendTo || !adConsentGranted()) return;
    loadGoogleAds();
    const gtag = (window as GoogleWindow).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", "conversion", googleAdsConversionPayload(sendTo, params));
  } catch {
    /* storage blocked, or the stub was replaced: never throw */
  }
}

/** Quiz email step. Same moment as the Meta Lead event. */
export function trackGoogleAdsLead(): void {
  trackGoogleAdsConversion(GOOGLE_ADS_LEAD_SEND_TO);
}

/**
 * Paid checkout. Value is the plan price before tax (14.99 / 29.99 / 59),
 * the same amount the Meta Purchase event sends. transaction_id is the
 * Stripe Checkout session id so a reload does not count twice.
 */
export function trackGoogleAdsPurchase(value: number, transactionId: string): void {
  if (!transactionId || !Number.isFinite(value)) return;
  trackGoogleAdsConversion(GOOGLE_ADS_PURCHASE_SEND_TO, {
    value,
    currency: "CAD",
    transaction_id: transactionId,
  });
}

/** Pages that cannot import this module call the same consent-gated functions. */
export function installGoogleAdsBridge(): void {
  if (typeof window === "undefined") return;
  const w = window as GoogleWindow;
  w.pjTrackGoogleAds = trackGoogleAdsConversion;
  w.pjTrackGoogleAdsPurchase = trackGoogleAdsPurchase;
}
