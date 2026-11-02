import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AD_TRACKING_KEY } from "../web/lib/meta-pixel.ts";
import { planPixel } from "../web/lib/site.ts";
import {
  GOOGLE_ADS_ID,
  GOOGLE_ADS_LEAD_SEND_TO,
  GOOGLE_ADS_PURCHASE_SEND_TO,
  googleAdsConversionPayload,
  installGoogleAdsBridge,
  loadGoogleAds,
  trackGoogleAdsLead,
  trackGoogleAdsPurchase,
} from "../web/lib/google-ads.ts";

type ScriptNode = { src: string; async: boolean };

const store = new Map<string, string>();
const inserted: ScriptNode[] = [];

function installDom() {
  const dataLayer: unknown[] = [];
  const documentMock = {
    createElement() {
      return { src: "", async: false };
    },
    getElementsByTagName() {
      return [
        {
          parentNode: {
            insertBefore(node: ScriptNode) {
              inserted.push(node);
            },
          },
        },
      ];
    },
  };
  const windowMock = {
    dataLayer,
    localStorage: {
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
    },
    document: documentMock,
  };
  const root = globalThis as unknown as { window: typeof windowMock; document: typeof documentMock };
  root.window = windowMock;
  root.document = documentMock;
  return windowMock;
}

function queued(dataLayer: unknown[]): unknown[][] {
  return dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

function resetTag(windowMock: { dataLayer: unknown[]; gtag?: unknown }) {
  inserted.length = 0;
  windowMock.dataLayer.length = 0;
  delete windowMock.gtag;
}

const windowMock = installDom();

assert.deepEqual(googleAdsConversionPayload(GOOGLE_ADS_LEAD_SEND_TO), {
  send_to: GOOGLE_ADS_LEAD_SEND_TO,
});
assert.deepEqual(
  googleAdsConversionPayload(GOOGLE_ADS_PURCHASE_SEND_TO, {
    value: 14.99,
    currency: "CAD",
    transaction_id: "cs_test_paid",
  }),
  {
    send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
    value: 14.99,
    currency: "CAD",
    transaction_id: "cs_test_paid",
  },
);

store.delete(AD_TRACKING_KEY);
loadGoogleAds();
trackGoogleAdsLead();
trackGoogleAdsPurchase(14.99, "cs_test_paid");
assert.equal(inserted.length, 0);
assert.equal(windowMock.dataLayer.length, 0);
assert.equal(windowMock.gtag, undefined);

store.set(AD_TRACKING_KEY, "off");
loadGoogleAds();
trackGoogleAdsLead();
assert.equal(inserted.length, 0);

store.set(AD_TRACKING_KEY, "on");
loadGoogleAds();
loadGoogleAds();
assert.equal(inserted.length, 1);
assert.equal(inserted[0].async, true);
assert.equal(inserted[0].src, `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`);
assert.deepEqual(queued(windowMock.dataLayer).map((entry) => entry[0]), ["js", "config"]);
assert.equal(queued(windowMock.dataLayer)[1][1], GOOGLE_ADS_ID);

trackGoogleAdsLead();
const lead = queued(windowMock.dataLayer).at(-1);
assert.deepEqual(lead, ["event", "conversion", { send_to: GOOGLE_ADS_LEAD_SEND_TO }]);
assert.equal(inserted.length, 1);

resetTag(windowMock);
for (const [plan, session] of [
  ["month", "cs_test_month"],
  ["quarter", "cs_test_quarter"],
  ["year", "cs_test_year"],
] as const) {
  const price = planPixel(plan);
  assert.ok(price);
  trackGoogleAdsPurchase(price.value, session);
  const hit = queued(windowMock.dataLayer).at(-1);
  assert.deepEqual(hit, [
    "event",
    "conversion",
    {
      send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
      value: price.value,
      currency: "CAD",
      transaction_id: session,
    },
  ]);
}
assert.deepEqual(
  [planPixel("month")?.value, planPixel("quarter")?.value, planPixel("year")?.value],
  [14.99, 29.99, 59],
);
assert.equal(inserted.length, 1);

trackGoogleAdsPurchase(Number.NaN, "cs_test_year");
trackGoogleAdsPurchase(59, "");
assert.equal(queued(windowMock.dataLayer).length, 5);

installGoogleAdsBridge();
const bridge = (windowMock as { pjTrackGoogleAdsPurchase?: (value: number, transactionId: string) => void })
  .pjTrackGoogleAdsPurchase;
assert.equal(typeof bridge, "function");
bridge!(29.99, "cs_test_bridge");
const bridged = queued(windowMock.dataLayer).at(-1);
assert.deepEqual(bridged?.[2], {
  send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
  value: 29.99,
  currency: "CAD",
  transaction_id: "cs_test_bridge",
});

store.set(AD_TRACKING_KEY, "off");
const before = windowMock.dataLayer.length;
trackGoogleAdsPurchase(59, "cs_test_denied");
assert.equal(windowMock.dataLayer.length, before);

const quiz = readFileSync(new URL("../web/components/QuizApp.tsx", import.meta.url), "utf8");
const leadAt = quiz.indexOf('trackMeta("track", "Lead")');
assert.notEqual(leadAt, -1);
assert.match(quiz.slice(leadAt, leadAt + 120), /trackGoogleAdsLead\(\)/);

const purchase = readFileSync(new URL("../web/components/PurchasePixel.tsx", import.meta.url), "utf8");
const purchaseAt = purchase.indexOf("trackGoogleAdsPurchase(event.value, event.eventId)");
const guardAt = purchase.indexOf('localStorage.getItem(key) === "1"');
assert.ok(purchaseAt !== -1 && guardAt !== -1 && guardAt < purchaseAt);

const notice = readFileSync(new URL("../web/components/AdNotice.tsx", import.meta.url), "utf8");
assert.match(notice, /loadGoogleAds\(\)/);
assert.match(notice, /installGoogleAdsBridge\(\)/);
assert.doesNotMatch(notice, /Google Ads/);

const attribution = readFileSync(new URL("../web/public/attribution.js", import.meta.url), "utf8");
assert.match(attribution, /gclid/);
assert.match(attribution, /pj_attr_first/);
assert.match(attribution, /pj_attr_last/);

console.log("google ads tests passed");
