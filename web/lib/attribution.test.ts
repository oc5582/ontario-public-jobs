import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { checkoutSessionCreateParams } from "./billing";
import {
  ATTRIBUTION_TTL_MS,
  ATTRIBUTION_VALUE_MAX,
  applyIncomingTouch,
  attributionColumnValues,
  attributionFromForm,
  attributionFromPayload,
  attributionMetadata,
  cookieMaxAgeSeconds,
  decodeTouch,
  encodeTouch,
  mergeAttribution,
  profileAttributionUpdateSql,
  touchFromParams,
  type StoredAttribution,
  type TouchRecord,
} from "./attribution";

const NOW = 1_700_000_000_000;

test("landing parameters keep the first touch and replace the last touch", () => {
  const google = touchFromParams(new URLSearchParams("utm_source=google&utm_campaign=ttc&fbclid=click1"));
  const firstVisit = applyIncomingTouch(null, null, google, NOW);
  assert.equal(firstVisit.first?.at, NOW);
  assert.equal(firstVisit.first?.touch.utm_source, "google");
  assert.equal(firstVisit.first?.touch.utm_campaign, "ttc");
  assert.equal(firstVisit.first?.touch.fbclid, "click1");
  assert.deepEqual(firstVisit.last, firstVisit.first);

  const facebook = touchFromParams(new URLSearchParams("utm_source=facebook&utm_medium=paid&gclid=g1"));
  const second = applyIncomingTouch(firstVisit.first, firstVisit.last, facebook, NOW + 5_000);
  assert.equal(second.first, firstVisit.first);
  assert.equal(second.last?.touch.utm_source, "facebook");
  assert.equal(second.last?.touch.utm_medium, "paid");
  assert.equal(second.last?.touch.gclid, "g1");
  assert.equal(second.last?.touch.utm_campaign, undefined);

  const again = applyIncomingTouch(second.first, second.last, facebook, NOW + 9_000);
  assert.equal(again.last, second.last);
  assert.equal(applyIncomingTouch(second.first, second.last, {}, NOW + 9_000).first, second.first);
});

test("an expired first touch can be replaced", () => {
  const stored: TouchRecord = { at: NOW, touch: { utm_source: "google" } };
  const next = applyIncomingTouch(null, null, { utm_source: "bing" }, NOW + ATTRIBUTION_TTL_MS + 1);
  assert.equal(next.first?.touch.utm_source, "bing");
  const decoded = decodeTouch(encodeTouch(stored), NOW + ATTRIBUTION_TTL_MS + 1);
  assert.equal(decoded, null);
});

test("values are trimmed, stripped, and capped", () => {
  const touch = touchFromParams(new URLSearchParams({ utm_source: `  goo\ngle${"x".repeat(ATTRIBUTION_VALUE_MAX)}  `, utm_term: "   " }));
  assert.equal(touch.utm_source?.startsWith("googlex"), true);
  assert.equal(touch.utm_source?.length, ATTRIBUTION_VALUE_MAX);
  assert.equal(touch.utm_term, undefined);
});

test("cookie lifetime is about 90 days and is not extended for an older first touch", () => {
  assert.equal(cookieMaxAgeSeconds(NOW, NOW), 90 * 24 * 60 * 60);
  assert.equal(cookieMaxAgeSeconds(NOW, NOW + 24 * 60 * 60 * 1000), 89 * 24 * 60 * 60);
  assert.equal(cookieMaxAgeSeconds(NOW, NOW + ATTRIBUTION_TTL_MS), 0);
});

test("checkout metadata keeps first-touch keys and last-touch copies", () => {
  const stored: StoredAttribution = {
    first: { utm_source: "google", utm_campaign: "ttc" },
    last: { utm_source: "facebook", utm_campaign: "retarget", fbclid: "fb" },
  };
  const metadata = attributionMetadata(stored);
  assert.equal(metadata.utm_source, "google");
  assert.equal(metadata.utm_campaign, "ttc");
  assert.equal(metadata.last_utm_source, "facebook");
  assert.equal(metadata.last_utm_campaign, "retarget");
  assert.equal(metadata.last_fbclid, "fb");
  assert.equal("utm_medium" in metadata, false);
  assert.equal("fbclid" in metadata, false);

  const merged = mergeAttribution(
    { first: { utm_source: "google", utm_campaign: "ttc" }, last: { utm_source: "facebook" } },
    { first: { utm_source: "newsletter" }, last: {} },
  );
  assert.equal(merged.first.utm_source, "google");
  assert.equal(merged.last.utm_source, "facebook");

  const fromLanding = mergeAttribution({ first: {}, last: {} }, { first: { utm_source: "google", utm_campaign: "ttc" }, last: {} });
  assert.deepEqual(attributionMetadata(fromLanding), {
    utm_source: "google",
    utm_campaign: "ttc",
    last_utm_source: "google",
    last_utm_campaign: "ttc",
  });
});

test("form and json payloads read first and last touch", () => {
  const form = new FormData();
  form.set("utm_source", "google");
  form.set("utm_campaign", "ttc");
  form.set("last_utm_source", "facebook");
  form.set("gclid", "gclid-1");
  form.set("last_gclid", "");
  const parsed = attributionFromForm(form);
  assert.equal(parsed.first.utm_source, "google");
  assert.equal(parsed.first.gclid, "gclid-1");
  assert.equal(parsed.last.utm_source, "facebook");
  assert.equal(parsed.last.gclid, undefined);

  const body = attributionFromPayload({
    attribution: { first: { utm_source: "google", utm_campaign: "ttc" }, last: { fbclid: "abc" } },
  });
  assert.equal(body.first.utm_campaign, "ttc");
  assert.equal(body.last.fbclid, "abc");
});

test("member update writes first-touch once and refreshes last-touch", () => {
  const sql = profileAttributionUpdateSql();
  assert.match(sql, /utm_source = coalesce\(utm_source, \$2\)/);
  assert.match(sql, /utm_campaign = coalesce\(utm_campaign, \$4\)/);
  assert.match(sql, /gclid = coalesce\(gclid, \$8\)/);
  assert.match(sql, /last_utm_source = coalesce\(\$9, last_utm_source\)/);
  assert.match(sql, /last_utm_campaign = coalesce\(\$11, last_utm_campaign\)/);
  assert.match(sql, /last_gclid = coalesce\(\$15, last_gclid\)/);
  const values = attributionColumnValues({
    first: { utm_source: "google", utm_campaign: "ttc" },
    last: { utm_source: "facebook", utm_campaign: "retarget" },
  });
  assert.deepEqual(values, [
    "google",
    null,
    "ttc",
    null,
    null,
    null,
    null,
    "facebook",
    null,
    "retarget",
    null,
    null,
    null,
    null,
  ]);
});

test("checkout session params copy attribution onto the session and the subscription", () => {
  const params = checkoutSessionCreateParams(
    {
      profileId: "11111111-1111-4111-8111-111111111111",
      email: "person@example.com",
      plan: "quarter",
      origin: "https://preview.example",
      province: "ON",
      attribution: {
        first: { utm_source: "google", utm_campaign: "ttc" },
        last: { utm_source: "google", utm_campaign: "ttc", gclid: "click" },
      },
    },
    "cus_test",
    "price_test",
    "txr_test",
  );
  assert.equal(params.metadata?.utm_source, "google");
  assert.equal(params.metadata?.utm_campaign, "ttc");
  assert.equal(params.metadata?.last_utm_source, "google");
  assert.equal(params.metadata?.last_utm_campaign, "ttc");
  assert.equal(params.metadata?.last_gclid, "click");
  assert.equal(params.subscription_data?.metadata?.utm_source, "google");
  assert.equal(params.subscription_data?.metadata?.utm_campaign, "ttc");
  assert.equal(params.subscription_data?.metadata?.last_utm_campaign, "ttc");
  assert.equal(params.subscription_data?.metadata?.gclid, undefined);
});

type Jar = Map<string, { value: string; maxAge: number | null }>;

function loadAttributionScript(search: string, clock: { now: number }) {
  const jar: Jar = new Map();
  const ls = new Map<string, string>();
  const document = {};
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get() {
      return [...jar.entries()].map(([name, item]) => `${name}=${item.value}`).join("; ");
    },
    set(cookieString: string) {
      const semi = cookieString.indexOf(";");
      const pair = semi === -1 ? cookieString : cookieString.slice(0, semi);
      const rest = semi === -1 ? "" : cookieString.slice(semi + 1);
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const match = /max-age=(\d+)/i.exec(rest);
      const maxAge = match ? Number(match[1]) : null;
      if (maxAge === 0) jar.delete(name);
      else jar.set(name, { value, maxAge });
    },
  });
  const browser = {
    document,
    location: { protocol: "https:", search },
    localStorage: {
      getItem(key: string) {
        return ls.has(key) ? ls.get(key)! : null;
      },
      setItem(key: string, value: string) {
        ls.set(key, String(value));
      },
    },
  };
  const context: vm.Context = vm.createContext({
    URLSearchParams,
    decodeURIComponent,
    isFinite,
    Date: { now: () => clock.now },
    window: browser,
  });
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../public/attribution.js"), "utf8");
  vm.runInContext(source, context);
  const capture = (browser as { pjCaptureAttribution?: (value: string) => void }).pjCaptureAttribution;
  const read = (browser as { pjReadAttribution?: () => StoredAttribution }).pjReadAttribution;
  assert.equal(typeof capture, "function");
  assert.equal(typeof read, "function");
  return { jar, ls, capture: capture!, read: read!, browser };
}

test("the page script stores a 90-day first touch and does not overwrite it", () => {
  const clock = { now: NOW };
  const page = loadAttributionScript("?utm_source=google&utm_campaign=ttc", clock);
  const first = page.jar.get("pj_attr_first");
  const last = page.jar.get("pj_attr_last");
  assert.ok(first);
  assert.equal(first?.maxAge, 90 * 24 * 60 * 60);
  assert.equal(decodeTouch(first?.value, clock.now)?.touch.utm_source, "google");
  assert.equal(decodeTouch(first?.value, clock.now)?.touch.utm_campaign, "ttc");
  assert.equal(decodeTouch(last?.value, clock.now)?.touch.utm_campaign, "ttc");
  assert.equal(page.ls.get("pj_attr_first"), first?.value);
  assert.equal(page.read().first.utm_source, "google");

  const original = first?.value;
  page.browser.location.search = "?utm_source=facebook&utm_campaign=retarget&fbclid=abc";
  page.capture("?utm_source=facebook&utm_campaign=retarget&fbclid=abc");
  assert.equal(page.jar.get("pj_attr_first")?.value, original);
  assert.equal(page.read().first.utm_source, "google");
  assert.equal(page.read().first.utm_campaign, "ttc");
  assert.equal(page.read().last.utm_source, "facebook");
  assert.equal(page.read().last.fbclid, "abc");
  assert.equal(page.read().last.utm_campaign, "retarget");

  page.capture("");
  assert.equal(page.read().first.utm_source, "google");
  assert.equal(page.read().last.utm_source, "facebook");

  clock.now = NOW + ATTRIBUTION_TTL_MS + 1;
  page.capture("?utm_source=bing&utm_campaign=next");
  assert.equal(page.read().first.utm_source, "bing");
  assert.equal(page.read().first.utm_campaign, "next");
});
