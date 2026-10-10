import Stripe from "stripe";
import { query } from "./db";
import type { PlanId } from "./site";

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
};

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

export function checkoutSessionCreateParams(
  input: CheckoutInput,
  customerId: string,
  priceId: string,
): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.profileId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${input.origin}/account/?checkout=success`,
    cancel_url: `${input.origin}/pricing/`,
    allow_promotion_codes: false,
    payment_method_collection: "always",
    metadata: { profile_id: input.profileId, plan: input.plan },
    subscription_data: {
      metadata: { profile_id: input.profileId, plan: input.plan },
    },
  };
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
  const session = await stripe.checkout.sessions.create(checkoutSessionCreateParams(input, customerId, priceId));
  if (!session.url) throw new Error("Stripe Checkout did not return a URL.");
  return { url: session.url };
}

export async function createPortalSession(input: PortalInput, stripe = getStripe()): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create(portalSessionCreateParams(input));
  if (!session.url) throw new Error("Stripe Customer Portal did not return a URL.");
  return { url: session.url };
}
