/**
 * Create exclusive Canadian GST/HST tax rates on the Stripe account for STRIPE_SECRET_KEY.
 * Idempotent: an active rate with metadata publicjobs_tax=ca_gst_hst and the same
 * province and percentage is reused. Quebec is GST only (not QST).
 *
 * Accepts secret keys (sk_) and restricted keys (rk_), test or live.
 * Live mode is the key's own livemode, confirmed on the tax rate Stripe returns.
 *
 * Test mode:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe_tax_rates.mjs
 *   STRIPE_SECRET_KEY=rk_test_... node scripts/stripe_tax_rates.mjs
 *   (If STRIPE_SECRET_KEY is unset, the script reads web/.env.local.)
 *
 * Live mode (creates rates on the live account; does not enable Stripe Tax):
 *   STRIPE_TAX_RATES_LIVE=1 STRIPE_SECRET_KEY=rk_live_... node scripts/stripe_tax_rates.mjs
 *   STRIPE_TAX_RATES_LIVE=1 STRIPE_SECRET_KEY=sk_live_... node scripts/stripe_tax_rates.mjs
 *
 * Then either set the printed STRIPE_TAX_RATE_* values on Vercel, or leave them
 * unset. Checkout looks up active rates by that metadata when the env var is empty.
 * That lookup is taxRates.list and works with a restricted key that can read Tax Rates.
 *
 * Keep this list in sync with web/lib/ca-tax.ts.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const Stripe = require("stripe");

const JURISDICTIONS = [
  { code: "AB", name: "Alberta", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "BC", name: "British Columbia", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "MB", name: "Manitoba", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "NB", name: "New Brunswick", percentage: 15, displayName: "HST", taxType: "hst" },
  { code: "NL", name: "Newfoundland and Labrador", percentage: 15, displayName: "HST", taxType: "hst" },
  { code: "NS", name: "Nova Scotia", percentage: 15, displayName: "HST", taxType: "hst" },
  { code: "NT", name: "Northwest Territories", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "NU", name: "Nunavut", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "ON", name: "Ontario", percentage: 13, displayName: "HST", taxType: "hst" },
  { code: "PE", name: "Prince Edward Island", percentage: 15, displayName: "HST", taxType: "hst" },
  { code: "QC", name: "Quebec", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "SK", name: "Saskatchewan", percentage: 5, displayName: "GST", taxType: "gst" },
  { code: "YT", name: "Yukon", percentage: 5, displayName: "GST", taxType: "gst" },
];

const META_KEY = "publicjobs_tax";
const META_VALUE = "ca_gst_hst";

function keyFromEnvFile() {
  try {
    const text = readFileSync(new URL("../web/.env.local", import.meta.url), "utf8");
    const match = text.match(/^STRIPE_SECRET_KEY=(.*)$/m);
    return match?.[1]?.trim() || "";
  } catch {
    return "";
  }
}

function matches(rate, item) {
  return (
    rate.active !== false &&
    rate.inclusive === false &&
    rate.metadata?.[META_KEY] === META_VALUE &&
    rate.metadata?.province === item.code &&
    Number(rate.percentage) === item.percentage &&
    rate.country === "CA" &&
    rate.state === item.code
  );
}

async function listRates(stripe) {
  const rates = [];
  let startingAfter;
  for (;;) {
    const page = await stripe.taxRates.list({ limit: 100, active: true, starting_after: startingAfter });
    rates.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return rates;
}

/** "test" or "live" for sk_ and rk_ keys. Null when the key shape is not a Stripe key. */
export function stripeKeyMode(key) {
  const match = /^(?:sk|rk)_(test|live)_/.exec(String(key || ""));
  return match ? match[1] : null;
}

function assertLivemode(rate, mode) {
  if (!rate || typeof rate.livemode !== "boolean") return;
  const live = mode === "live";
  if (rate.livemode !== live) {
    console.error(
      `This Stripe key is ${mode} mode, but Stripe returned livemode=${rate.livemode}. No further tax rates were changed.`,
    );
    process.exit(1);
  }
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY || keyFromEnvFile();
  if (!key) {
    console.error("Set STRIPE_SECRET_KEY, or put it in web/.env.local.");
    process.exit(1);
  }
  const mode = stripeKeyMode(key);
  if (!mode) {
    console.error("STRIPE_SECRET_KEY must be a Stripe secret or restricted key (sk_ or rk_, test or live).");
    process.exit(1);
  }
  if (mode === "live" && process.env.STRIPE_TAX_RATES_LIVE !== "1") {
    console.error("Refusing to create live tax rates. Re-run with STRIPE_TAX_RATES_LIVE=1.");
    process.exit(1);
  }

  const stripe = new Stripe(key);
  const existing = await listRates(stripe);
  for (const rate of existing) assertLivemode(rate, mode);
  const ids = [];

  for (const item of JURISDICTIONS) {
    const found = existing.find((rate) => matches(rate, item));
    if (found) {
      ids.push([item.code, found.id, "reused"]);
      continue;
    }
    const created = await stripe.taxRates.create({
      display_name: item.displayName,
      inclusive: false,
      percentage: item.percentage,
      country: "CA",
      state: item.code,
      jurisdiction: item.name,
      tax_type: item.taxType,
      description:
        item.code === "QC"
          ? "GST 5% for Quebec. Not registered for QST."
          : `${item.displayName} ${item.percentage}% for ${item.name}`,
      metadata: { [META_KEY]: META_VALUE, province: item.code },
    });
    assertLivemode(created, mode);
    ids.push([item.code, created.id, "created"]);
  }

  console.log(mode === "live" ? "Live tax rates:" : "Test tax rates:");
  for (const [code, id, action] of ids) {
    console.log(`STRIPE_TAX_RATE_${code}=${id}  # ${action}`);
  }
  console.log("");
  console.log("Checkout uses Stripe Tax when it is already active and a Canadian registration is active.");
  console.log("Otherwise Checkout passes these exclusive rates as dynamic_tax_rates.");
  console.log("Prices stay exclusive of tax. Quebec is GST only (no QST).");
  console.log("Optional: set the lines above on Vercel. If unset, the app looks them up by metadata.");
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  await main();
}
