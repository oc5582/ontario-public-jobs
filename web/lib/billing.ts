/**
 * Stripe is intentionally not wired in phase 1. No secret keys.
 *
 * When payments are added, implement this interface and call it from:
 * - app/api/checkout/route.ts          → Checkout Session
 * - app/api/billing/portal/route.ts    → Customer Portal (self-serve cancel)
 * - app/api/stripe/webhook/route.ts    → set profiles.membership_status
 *
 * Webhook events to handle:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 *
 * Map Stripe status onto public.profiles:
 * - membership_status: trialing | active | past_due | canceled | none
 * - stripe_customer_id, stripe_subscription_id
 * - plan_code: monthly | quarterly | annual
 * - current_period_end
 *
 * Prices (CAD), created later in Stripe and stored as env price ids:
 * - monthly   CA$14.99 / month     STRIPE_PRICE_MONTHLY
 * - quarterly CA$29.99 / 3 months  STRIPE_PRICE_QUARTERLY
 * - annual    CA$59 / year         STRIPE_PRICE_ANNUAL
 *
 * Refund copy on /pricing/: 14 days, self-serve cancel in the customer portal.
 * Do not grant membership from the browser. Only the webhook, using the
 * service role, updates profiles.
 */

export type PlanCode = "monthly" | "quarterly" | "annual";

export type CheckoutRequest = {
  plan: PlanCode;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
};

export type PortalRequest = {
  stripeCustomerId: string;
  returnUrl: string;
};

export interface BillingProvider {
  createCheckoutSession(input: CheckoutRequest): Promise<{ url: string }>;
  createPortalSession(input: PortalRequest): Promise<{ url: string }>;
}

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not connected yet.");
    this.name = "BillingNotConfiguredError";
  }
}

export function billingProvider(): BillingProvider {
  // TODO(stripe): return a StripeBillingProvider when STRIPE_SECRET_KEY is set.
  throw new BillingNotConfiguredError();
}
