import Stripe from "stripe";
import { reportEvent } from "./analytics";
import { CA_TAX_JURISDICTIONS, taxRateIdForProvince } from "./ca-tax";
import { query } from "./db";
import { disclosureText, stripeSubmitMessage, stripeTermsMessage } from "./legal-copy";
import { LEGAL } from "./legal-config";
import { planPriceLine, type PlanId } from "./site";

export class BillingNotConfiguredError extends Error {
  constructor(message = "Billing is not available right now.") {
    super(message);
    this.name = "BillingNotConfiguredError";
  }
}

export class AlreadySubscribedError extends Error {
  constructor() {
    super("This account already has a membership.");
    this.name = "AlreadySubscribedError";
  }
}

export type CheckoutInput = {
  profileId: string;
  email: string;
  plan: PlanId;
  origin: string;
  agreementId?: string;
};

export type CheckoutTax =
  | { mode: "stripe_tax" }
  | { mode: "dynamic"; taxRateIds: string[] };

export type PortalInput = {
  stripeCustomerId: string;
  origin: string;
};

const PRICE_ENV: Record<PlanId, string> = {
  month: "STRIPE_PRICE_MONTHLY",
  quarter: "STRIPE_PRICE_QUARTERLY",
  year: "STRIPE_PRICE_YEARLY",
};

let stripeClient: Stripe | null = null;
let stripeCacheKey = "";

export function priceIdForPlan(plan: PlanId): string {
  const name = PRICE_ENV[plan];
  const value = process.env[name];
  if (!value) throw new BillingNotConfiguredError(`${name} is not set.`);
  return value;
}

export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  const plans = Object.keys(PRICE_ENV) as PlanId[];
  for (const plan of plans) {
    const value = process.env[PRICE_ENV[plan]];
    if (value && value === priceId) return plan;
  }
  return null;
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new BillingNotConfiguredError("STRIPE_SECRET_KEY is not set.");
  // STRIPE_API_HOST points local tests at stripe-mock. Leave it unset on Vercel.
  const host = process.env.STRIPE_API_HOST || "";
  const cacheKey = `${key}|${host}|${process.env.STRIPE_API_PORT || ""}|${process.env.STRIPE_API_PROTOCOL || ""}`;
  if (!stripeClient || stripeCacheKey !== cacheKey) {
    stripeCacheKey = cacheKey;
    stripeClient = new Stripe(key, {
      appInfo: { name: "PublicJobs.ca", url: "https://publicjobs.ca" },
      host: host || undefined,
      port: process.env.STRIPE_API_PORT ? Number(process.env.STRIPE_API_PORT) : undefined,
      protocol: process.env.STRIPE_API_PROTOCOL === "http" ? "http" : undefined,
    });
  }
  return stripeClient;
}

type LineItemWithDynamicTax = Stripe.Checkout.SessionCreateParams.LineItem & {
  dynamic_tax_rates?: string[];
};

/**
 * Stripe Tax when the account can calculate Canadian GST/HST.
 * Otherwise the exclusive provincial rates go on dynamic_tax_rates and Checkout
 * picks the one that matches the billing address. Prices stay exclusive of tax.
 * Hosted Checkout cannot limit the billing-country list, so the customer address
 * is preset to Canada and the submit message says memberships are sold in Canada only.
 */
export function checkoutSessionCreateParams(
  input: CheckoutInput,
  customerId: string,
  priceId: string,
  tax: CheckoutTax,
): Stripe.Checkout.SessionCreateParams {
  const metadata: Stripe.MetadataParam = {
    profile_id: input.profileId,
    plan: input.plan,
    terms_version: LEGAL.termsVersion,
    tax_mode: tax.mode,
  };
  if (input.agreementId) metadata.agreement_id = input.agreementId;
  const lineItem: LineItemWithDynamicTax = { price: priceId, quantity: 1 };
  if (tax.mode === "dynamic") lineItem.dynamic_tax_rates = tax.taxRateIds;
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.profileId,
    line_items: [lineItem],
    success_url: `${input.origin}/account/?checkout=success`,
    cancel_url: `${input.origin}/pricing/`,
    allow_promotion_codes: false,
    payment_method_collection: "always",
    billing_address_collection: "required",
    // Prices are CAD. Turn off Adaptive Pricing so Checkout does not present a converted currency.
    adaptive_pricing: { enabled: false },
    customer_update: { name: "auto", address: "auto" },
    consent_collection: { terms_of_service: "required" },
    custom_text: {
      terms_of_service_acceptance: { message: stripeTermsMessage(input.plan) },
      submit: { message: stripeSubmitMessage() },
    },
    metadata,
    subscription_data: {
      metadata: {
        profile_id: input.profileId,
        plan: input.plan,
        terms_version: LEGAL.termsVersion,
        tax_mode: tax.mode,
      },
    },
  };
  if (tax.mode === "stripe_tax") params.automatic_tax = { enabled: true };
  return params;
}

/**
 * Stripe Tax is used when settings are active and a Canadian registration exists.
 * The live account is left as it is. In test mode only, a missing head office or
 * GST/HST registration is filled in so Checkout can calculate exclusive tax.
 * Quebec stays GST only: this does not add a provincial registration.
 */
export async function stripeTaxReady(stripe: Stripe): Promise<boolean> {
  try {
    let settings: Stripe.Tax.Settings = await stripe.tax.settings.retrieve();
    if (settings.livemode === false) settings = await ensureTestCanadianTax(stripe, settings);
    if (settings.status !== "active") return false;
    const page = await stripe.tax.registrations.list({ status: "active", limit: 100 });
    const activeCa = page.data.some((item) => item.country === "CA" && item.status === "active");
    if (activeCa) return true;
    if (settings.livemode !== false) return false;
    await stripe.tax.registrations.create({
      country: "CA",
      country_options: { ca: { type: "standard" } },
      active_from: "now",
    });
    console.info(JSON.stringify({ event: "stripe_tax_test_registration" }));
    return true;
  } catch {
    console.error(JSON.stringify({ event: "stripe_tax_settings_unavailable" }));
    return false;
  }
}

async function ensureTestCanadianTax(
  stripe: Stripe,
  settings: Stripe.Tax.Settings,
): Promise<Stripe.Tax.Settings> {
  if (settings.status === "active" && settings.defaults?.tax_behavior === "exclusive") return settings;
  const updated = await stripe.tax.settings.update({
    head_office: {
      address: {
        line1: LEGAL.streetAddress,
        city: LEGAL.addressLocality,
        state: "ON",
        postal_code: LEGAL.postalCode,
        country: "CA",
      },
    },
    defaults: { tax_behavior: "exclusive", tax_code: "txcd_10103001" },
  });
  console.info(JSON.stringify({ event: "stripe_tax_test_settings", status: updated.status }));
  return updated;
}

async function exclusiveTaxRateIds(stripe: Stripe): Promise<string[]> {
  const ids: string[] = [];
  const missing: string[] = [];
  for (const item of CA_TAX_JURISDICTIONS) {
    const id = await taxRateIdForProvince(stripe, item.code);
    if (id) ids.push(id);
    else missing.push(item.code);
  }
  if (missing.length > 0) {
    throw new BillingNotConfiguredError(
      `Stripe tax rate for ${missing.join(", ")} is not set. Run scripts/stripe_tax_rates.mjs.`,
    );
  }
  return ids;
}

const exclusivePrices = new Set<string>();

async function ensureExclusivePrice(stripe: Stripe, priceId: string): Promise<void> {
  if (exclusivePrices.has(priceId)) return;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.tax_behavior === "exclusive") {
      exclusivePrices.add(priceId);
      return;
    }
    if (price.tax_behavior === "inclusive") {
      console.error(JSON.stringify({ event: "price_tax_inclusive" }));
      return;
    }
    await stripe.prices.update(priceId, { tax_behavior: "exclusive" });
    exclusivePrices.add(priceId);
  } catch {
    console.error(JSON.stringify({ event: "price_tax_behavior_update_failed" }));
  }
}

function dynamicTaxRejected(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /dynamic[_\s]tax/i.test(message) || (/tax rate/i.test(message) && /not supported|unsupported/i.test(message));
}

// dynamic_tax_rates was removed in Stripe API 2026-07-29.dahlia. Checkout on the
// current API version cannot select a Canadian rate from the billing address
// unless Stripe Tax is active, so the manual-rate path uses the last version
// that still accepts the parameter.
const DYNAMIC_TAX_API_VERSION = "2026-06-24.dahlia";

async function openCheckoutSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
  apiVersion?: string,
): Promise<Stripe.Checkout.Session> {
  const options = apiVersion ? { apiVersion } : undefined;
  try {
    return await stripe.checkout.sessions.create(params, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/terms of service/i.test(message)) throw error;
    console.error(JSON.stringify({ event: "stripe_terms_url_missing" }));
    const withoutTerms = { ...params };
    delete withoutTerms.consent_collection;
    return stripe.checkout.sessions.create(withoutTerms, options);
  }
}

export function portalSessionCreateParams(input: PortalInput): Stripe.BillingPortal.SessionCreateParams {
  return {
    customer: input.stripeCustomerId,
    return_url: `${input.origin}/account/`,
  };
}

function missingCustomer(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing";
}

async function ensureCustomer(stripe: Stripe, input: CheckoutInput, existing: string | null): Promise<string> {
  if (existing) {
    try {
      const customer = await stripe.customers.retrieve(existing);
      if (!("deleted" in customer && customer.deleted)) return existing;
    } catch (error) {
      if (!missingCustomer(error)) throw error;
    }
  }
  const customer = await stripe.customers.create(
    { email: input.email, metadata: { profile_id: input.profileId } },
    { idempotencyKey: `publicjobs_customer_${input.profileId}` },
  );
  await query(
    `update profiles set stripe_customer_id = $2, updated_at = now() where id = $1`,
    [input.profileId, customer.id],
  );
  return customer.id;
}

export async function createCheckoutSession(input: CheckoutInput, stripe = getStripe()): Promise<{ url: string }> {
  const priceId = priceIdForPlan(input.plan);
  const rows = await query<{
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    membership_status: string;
  }>(
    `select stripe_customer_id, stripe_subscription_id, membership_status from profiles where id = $1`,
    [input.profileId],
  );
  const profile = rows[0];
  if (!profile) throw new Error("Profile not found.");
  if (
    profile.stripe_subscription_id &&
    (profile.membership_status === "active" || profile.membership_status === "past_due")
  ) {
    throw new AlreadySubscribedError();
  }
  const customerId = await ensureCustomer(stripe, input, profile.stripe_customer_id);
  // Country only. Checkout collects the name and the rest of the billing address.
  await stripe.customers.update(customerId, { address: { country: "CA" } });
  const disclosure = `${disclosureText(input.plan)}\nName and Canadian billing address are collected on the payment page. GST/HST follows that province and is added before payment. GST/HST ${LEGAL.hstNumber}.`;
  const inserted = await query<{ id: string }>(
    `insert into agreement_acceptances
       (profile_id, email, customer_name, plan, price_label, terms_version, disclosure_text)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [input.profileId, input.email, null, input.plan, planPriceLine(input.plan), LEGAL.termsVersion, disclosure],
  );
  const agreementId = inserted[0]?.id;
  let tax: CheckoutTax = (await stripeTaxReady(stripe))
    ? { mode: "stripe_tax" }
    : { mode: "dynamic", taxRateIds: await exclusiveTaxRateIds(stripe) };
  if (tax.mode === "stripe_tax") await ensureExclusivePrice(stripe, priceId);
  console.info(JSON.stringify({ event: "checkout_tax", mode: tax.mode }));
  let params = checkoutSessionCreateParams({ ...input, agreementId }, customerId, priceId, tax);
  let session: Stripe.Checkout.Session;
  try {
    session = await openCheckoutSession(
      stripe,
      params,
      tax.mode === "dynamic" ? DYNAMIC_TAX_API_VERSION : undefined,
    );
  } catch (error) {
    if (tax.mode !== "dynamic" || !dynamicTaxRejected(error)) throw error;
    console.error(
      JSON.stringify({
        event: "checkout_tax_dynamic_rejected",
        message: (error instanceof Error ? error.message : "").slice(0, 400),
      }),
    );
    throw new BillingNotConfiguredError();
  }
  if (agreementId && session.id) {
    await query(`update agreement_acceptances set stripe_session_id = $2 where id = $1`, [agreementId, session.id]);
  }
  if (!session.url) throw new Error("Stripe Checkout did not return a URL.");
  reportEvent("checkout_start", { plan: input.plan });
  return { url: session.url };
}

export async function createPortalSession(input: PortalInput, stripe = getStripe()): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create(portalSessionCreateParams(input));
  if (!session.url) throw new Error("Stripe Customer Portal did not return a URL.");
  return { url: session.url };
}
