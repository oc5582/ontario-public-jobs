import type { PlanId } from "./site";

export class BillingNotConfiguredError extends Error {
  constructor(message = "Stripe is not connected yet.") {
    super(message);
    this.name = "BillingNotConfiguredError";
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

/**
 * Payments are intentionally not implemented in this phase.
 * The next step is Stripe Checkout (subscription mode, no trial), the Customer
 * Portal for self-serve cancel, and a signed webhook that sets profiles:
 *   checkout.session.completed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.paid
 * Membership status must be written only from the webhook, using the service
 * database connection, never from a value the browser sends.
 */
export async function createCheckoutSession(_input: CheckoutInput): Promise<{ url: string }> {
  // TODO: const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  // TODO: stripe.checkout.sessions.create({
  //   mode: "subscription",
  //   customer_email: input.email,
  //   client_reference_id: input.profileId,
  //   line_items: [{ price: PRICE_IDS[input.plan], quantity: 1 }],
  //   success_url: `${input.origin}/account/?checkout=success`,
  //   cancel_url: `${input.origin}/pricing/`,
  //   allow_promotion_codes: false,
  //   subscription_data: { trial_period_days: undefined },
  // })
  throw new BillingNotConfiguredError("Stripe Checkout is not connected yet.");
}

export async function createPortalSession(_input: PortalInput): Promise<{ url: string }> {
  // TODO: stripe.billingPortal.sessions.create({
  //   customer: input.stripeCustomerId,
  //   return_url: `${input.origin}/account/`,
  // })
  throw new BillingNotConfiguredError("The Stripe customer portal is not connected yet.");
}
