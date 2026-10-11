import type { PoolClient } from "pg";
import Stripe from "stripe";
import { fulfillCheckoutAgreement } from "./agreement-mail";
import { getStripe, planForPrice } from "./billing";
import { query, withTransaction } from "./db";
import { sendDueRenewalReminders } from "./renewal-reminders";
import type { PlanId } from "./site";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.upcoming",
  "charge.refunded",
  "charge.dispute.created",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The profile is not linked to this customer yet. Stripe should retry. */
export class CustomerNotLinked extends Error {
  constructor() {
    super("Customer is not linked yet.");
    this.name = "CustomerNotLinked";
  }
}

export type MembershipState = "none" | "active" | "past_due" | "canceled";

let verifyClient: Stripe | null = null;

function stripeForVerify(): Stripe {
  // The configured key is passed through as-is (sk_ or rk_, test or live).
  // This stub is only for local signature checks when no key is set. It never calls Stripe.
  if (process.env.STRIPE_SECRET_KEY) return getStripe();
  if (!verifyClient) verifyClient = new Stripe("rk_test_webhook_verify_only");
  return verifyClient;
}

function uuidOrNull(value: string | null | undefined): string | null {
  if (!value || !UUID.test(value)) return null;
  return value;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function planFromMetadata(metadata: Stripe.Metadata | null | undefined): PlanId | null {
  const plan = metadata?.plan;
  if (plan === "month" || plan === "quarter" || plan === "year") return plan;
  return null;
}

export function membershipState(status: string): MembershipState {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "none";
  }
}

export function periodEndUnix(sub: Stripe.Subscription): number | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === "number") return itemEnd;
  const legacy = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  if (typeof legacy === "number") return legacy;
  if (typeof sub.ended_at === "number") return sub.ended_at;
  return null;
}

function priceIdOf(sub: Stripe.Subscription): string | null {
  const price = sub.items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

export type SubscriptionWrite = {
  status: MembershipState;
  touchOnly: boolean;
  plan: PlanId | null;
  periodEnd: Date | null;
  cancelAt: Date | null;
  customerId: string | null;
  subscriptionId: string;
  profileId: string | null;
};

export function subscriptionWrite(sub: Stripe.Subscription, now = Date.now()): SubscriptionWrite {
  const periodUnix = periodEndUnix(sub);
  const periodEnd = periodUnix ? new Date(periodUnix * 1000) : null;
  const status = membershipState(sub.status);
  const canceling =
    status === "active" &&
    (sub.cancel_at_period_end || (typeof sub.cancel_at === "number" && sub.cancel_at * 1000 > now));
  let cancelAt: Date | null = null;
  if (canceling) {
    cancelAt = typeof sub.cancel_at === "number" ? new Date(sub.cancel_at * 1000) : periodEnd;
  }
  return {
    status,
    touchOnly: sub.status === "incomplete",
    plan: planForPrice(priceIdOf(sub)) || planFromMetadata(sub.metadata),
    periodEnd,
    cancelAt,
    customerId: idOf(sub.customer),
    subscriptionId: sub.id,
    profileId: uuidOrNull(sub.metadata?.profile_id),
  };
}

async function findProfile(
  client: PoolClient,
  hints: { profileId: string | null; customerId: string | null; subscriptionId: string | null },
): Promise<string | null> {
  if (hints.profileId) {
    const byId = await client.query<{ id: string }>(`select id from profiles where id = $1`, [hints.profileId]);
    if (byId.rows[0]) return byId.rows[0].id;
  }
  if (hints.customerId) {
    const byCustomer = await client.query<{ id: string }>(
      `select id from profiles where stripe_customer_id = $1`,
      [hints.customerId],
    );
    if (byCustomer.rows[0]) return byCustomer.rows[0].id;
  }
  if (hints.subscriptionId) {
    const bySub = await client.query<{ id: string }>(
      `select id from profiles where stripe_subscription_id = $1`,
      [hints.subscriptionId],
    );
    if (bySub.rows[0]) return bySub.rows[0].id;
  }
  return null;
}

async function writeSubscription(
  client: PoolClient,
  event: Stripe.Event,
  sub: Stripe.Subscription,
  profileHint: string | null,
): Promise<void> {
  const write = subscriptionWrite(sub);
  const profileId = await findProfile(client, {
    profileId: profileHint || write.profileId,
    customerId: write.customerId,
    subscriptionId: write.subscriptionId,
  });
  if (!profileId) {
    console.info(JSON.stringify({ event: "stripe_webhook_unmatched", type: event.type, id: event.id }));
    return;
  }
  if (write.touchOnly) {
    await client.query(
      `update profiles
       set stripe_customer_id = coalesce($2, stripe_customer_id),
           stripe_subscription_id = coalesce($3, stripe_subscription_id),
           billing_event_created = $4,
           updated_at = now()
       where id = $1
         and (billing_event_created is null or billing_event_created <= $4)
         and (
           stripe_subscription_id is null
           or stripe_subscription_id = $3
           or membership_status <> 'active'
         )`,
      [profileId, write.customerId, write.subscriptionId, event.created],
    );
    return;
  }
  await client.query(
    `update profiles
     set stripe_customer_id = coalesce($2, stripe_customer_id),
         stripe_subscription_id = $3,
         membership_status = case
           when membership_status = 'refunded' and $4::text <> 'active' then membership_status
           else $4
         end,
         plan = coalesce($5, plan),
         current_period_end = case
           when membership_status = 'refunded' and $4::text <> 'active' then current_period_end
           when membership_status = 'canceled'
             and $4::text = 'canceled'
             and current_period_end is not null
             and $6::timestamptz is not null
             and $6::timestamptz > current_period_end
             then current_period_end
           else coalesce($6, current_period_end)
         end,
         cancel_at = $7,
         billing_event_created = $8,
         updated_at = now()
     where id = $1
       and (billing_event_created is null or billing_event_created <= $8)
       and (
         stripe_subscription_id is null
         or stripe_subscription_id = $3
         or membership_status <> 'active'
       )`,
    [
      profileId,
      write.customerId,
      write.subscriptionId,
      write.status,
      write.plan,
      write.periodEnd,
      write.cancelAt,
      event.created,
    ],
  );
}

async function linkIds(
  client: PoolClient,
  event: Stripe.Event,
  hints: { profileId: string | null; customerId: string | null; subscriptionId: string | null },
): Promise<void> {
  const profileId = await findProfile(client, hints);
  if (!profileId) {
    console.info(JSON.stringify({ event: "stripe_webhook_unmatched", type: event.type, id: event.id }));
    return;
  }
  await client.query(
    `update profiles
     set stripe_customer_id = coalesce($2, stripe_customer_id),
         stripe_subscription_id = coalesce($3, stripe_subscription_id),
         billing_event_created = $4,
         updated_at = now()
     where id = $1
       and (billing_event_created is null or billing_event_created <= $4)
       and (
         $3::text is null
         or stripe_subscription_id is null
         or stripe_subscription_id = $3
         or membership_status <> 'active'
       )`,
    [profileId, hints.customerId, hints.subscriptionId, event.created],
  );
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent?.subscription_details?.subscription;
  const fromParent = idOf(parent);
  if (fromParent) return fromParent;
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }).subscription;
  return idOf(legacy);
}

async function applyPaymentFailed(client: PoolClient, event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  const customerId = idOf(invoice.customer);
  const profileHint = uuidOrNull(invoice.parent?.subscription_details?.metadata?.profile_id);
  const profileId = await findProfile(client, { profileId: profileHint, customerId, subscriptionId });
  if (!profileId) {
    console.info(JSON.stringify({ event: "stripe_webhook_unmatched", type: event.type, id: event.id }));
    return;
  }
  await client.query(
    `update profiles
     set membership_status = 'past_due',
         stripe_customer_id = coalesce($2, stripe_customer_id),
         stripe_subscription_id = coalesce($3, stripe_subscription_id),
         billing_event_created = $4,
         updated_at = now()
     where id = $1
       and (billing_event_created is null or billing_event_created <= $4)
       and ($3::text is null or stripe_subscription_id is null or stripe_subscription_id = $3)`,
    [profileId, customerId, subscriptionId, event.created],
  );
}

async function loadCheckoutSubscription(event: Stripe.Event): Promise<Stripe.Subscription | null> {
  if (event.type !== "checkout.session.completed") return null;
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.subscription && typeof session.subscription !== "string") return session.subscription;
  const id = typeof session.subscription === "string" ? session.subscription : "";
  if (!id || !process.env.STRIPE_SECRET_KEY) return null;
  return getStripe().subscriptions.retrieve(id);
}

export function chargeRefundKind(charge: {
  refunded?: boolean | null;
  amount?: number | null;
  amount_refunded?: number | null;
}): "full" | "partial" {
  if (charge.refunded === true) return "full";
  const amount = typeof charge.amount === "number" ? charge.amount : 0;
  const refunded = typeof charge.amount_refunded === "number" ? charge.amount_refunded : 0;
  if (amount > 0 && refunded >= amount) return "full";
  return "partial";
}

/** Production accepts live events. Every other deployment accepts test events. STRIPE_WEBHOOK_LIVEMODE overrides that. */
export function acceptsStripeLivemode(livemode: boolean, env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.STRIPE_WEBHOOK_LIVEMODE || "").trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "live") return livemode === true;
  if (flag === "0" || flag === "false" || flag === "test") return livemode === false;
  if (env.VERCEL_ENV === "production") return livemode === true;
  return livemode === false;
}

function subscriptionAlreadyCanceled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return code === "resource_missing" || /already been canceled/i.test(message) || /canceled subscription/i.test(message);
}

async function defaultCancelSubscription(subscriptionId: string): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.info(JSON.stringify({ event: "stripe_subscription_cancel_skipped", subscriptionId, reason: "no_key" }));
    return;
  }
  try {
    await getStripe().subscriptions.cancel(subscriptionId);
  } catch (error) {
    if (subscriptionAlreadyCanceled(error)) return;
    throw error;
  }
}

let cancelSubscriptionImpl: (subscriptionId: string) => Promise<void> = defaultCancelSubscription;

export function setSubscriptionCancellerForTests(fn: ((subscriptionId: string) => Promise<void>) | null): void {
  cancelSubscriptionImpl = fn ?? defaultCancelSubscription;
}

function invoiceLikeSubscriptionId(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== "object") return null;
  return subscriptionIdFromInvoice(invoice as Stripe.Invoice);
}

/** Subscription id carried on the charge or its payment intent, when the payload includes the invoice. */
export function subscriptionIdFromCharge(charge: { invoice?: unknown; payment_intent?: unknown }): string | null {
  const fromInvoice = invoiceLikeSubscriptionId(charge.invoice);
  if (fromInvoice) return fromInvoice;
  const paymentIntent = charge.payment_intent;
  if (paymentIntent && typeof paymentIntent === "object") {
    return invoiceLikeSubscriptionId((paymentIntent as { invoice?: unknown }).invoice);
  }
  return null;
}

function chargeEmail(charge: Stripe.Charge): string | null {
  const email = charge.billing_details?.email || charge.receipt_email || "";
  return email.includes("@") ? email : null;
}

async function resolveCharge(charge: Stripe.Charge | string): Promise<Stripe.Charge> {
  if (typeof charge !== "string") return charge;
  if (!process.env.STRIPE_SECRET_KEY) throw new CustomerNotLinked();
  return getStripe().charges.retrieve(charge);
}

async function subscriptionIdOfResolvedCharge(charge: Stripe.Charge): Promise<string | null> {
  const inline = subscriptionIdFromCharge(charge);
  if (inline) return inline;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const stripe = getStripe();
  const invoiceId = typeof (charge as Stripe.Charge & { invoice?: unknown }).invoice === "string"
    ? ((charge as Stripe.Charge & { invoice?: string }).invoice as string)
    : null;
  if (invoiceId) {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const fromInvoice = subscriptionIdFromInvoice(invoice);
    if (fromInvoice) return fromInvoice;
  }
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return null;
  const payments = await stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: paymentIntentId },
    limit: 5,
  });
  for (const payment of payments.data) {
    const invoiceRef = payment.invoice;
    if (!invoiceRef || typeof invoiceRef === "string") {
      if (typeof invoiceRef !== "string") continue;
      const invoice = await stripe.invoices.retrieve(invoiceRef);
      const fromInvoice = subscriptionIdFromInvoice(invoice);
      if (fromInvoice) return fromInvoice;
      continue;
    }
    if ("deleted" in invoiceRef) continue;
    const fromInvoice = subscriptionIdFromInvoice(invoiceRef);
    if (fromInvoice) return fromInvoice;
  }
  return null;
}

async function profileForCharge(hints: {
  customerId: string | null;
  email: string | null;
  subscriptionId: string | null;
}): Promise<{ id: string; stripe_subscription_id: string | null } | null> {
  if (hints.customerId) {
    const byCustomer = await query<{ id: string; stripe_subscription_id: string | null }>(
      `select id, stripe_subscription_id from profiles where stripe_customer_id = $1`,
      [hints.customerId],
    );
    if (byCustomer[0]) return byCustomer[0];
  }
  if (hints.subscriptionId) {
    const bySubscription = await query<{ id: string; stripe_subscription_id: string | null }>(
      `select id, stripe_subscription_id from profiles where stripe_subscription_id = $1`,
      [hints.subscriptionId],
    );
    if (bySubscription[0]) return bySubscription[0];
  }
  if (hints.email) {
    const byEmail = await query<{ id: string; stripe_subscription_id: string | null }>(
      `select id, stripe_subscription_id from profiles where lower(email) = lower($1)`,
      [hints.email],
    );
    if (byEmail[0]) return byEmail[0];
  }
  return null;
}

type Revocation =
  | { action: "partial" }
  | { action: "ignore" }
  | { action: "revoke"; status: "refunded" | "canceled"; customerId: string | null; subscriptionId: string };

async function revocationFor(event: Stripe.Event): Promise<Revocation | null> {
  if (event.type !== "charge.refunded" && event.type !== "charge.dispute.created") return null;
  if (event.type === "charge.refunded" && chargeRefundKind(event.data.object as Stripe.Charge) === "partial") {
    const charge = event.data.object as Stripe.Charge;
    console.info(
      JSON.stringify({
        event: "stripe_refund_partial",
        id: event.id,
        charge: charge.id,
        amount: charge.amount,
        amount_refunded: charge.amount_refunded,
      }),
    );
    return { action: "partial" };
  }
  const dispute = event.type === "charge.dispute.created" ? (event.data.object as Stripe.Dispute) : null;
  let charge = await resolveCharge(dispute ? dispute.charge : (event.data.object as Stripe.Charge));
  if (dispute && !idOf(charge.payment_intent) && dispute.payment_intent) {
    charge = { ...charge, payment_intent: dispute.payment_intent } as Stripe.Charge;
  }
  const customerId = idOf(charge.customer);
  const subscriptionId = await subscriptionIdOfResolvedCharge(charge);
  const profile = await profileForCharge({
    customerId,
    email: chargeEmail(charge),
    subscriptionId,
  });
  if (!profile || !profile.stripe_subscription_id) throw new CustomerNotLinked();
  if (!subscriptionId || subscriptionId !== profile.stripe_subscription_id) {
    console.info(
      JSON.stringify({
        event: "stripe_charge_other_subscription",
        id: event.id,
        charge: charge.id,
        chargeSubscriptionId: subscriptionId,
        currentSubscriptionId: profile.stripe_subscription_id,
      }),
    );
    return { action: "ignore" };
  }
  return {
    action: "revoke",
    status: event.type === "charge.refunded" ? "refunded" : "canceled",
    customerId,
    subscriptionId,
  };
}

async function applyRevocation(client: PoolClient, event: Stripe.Event, plan: Revocation): Promise<void> {
  if (plan.action !== "revoke") return;
  const profileId = await findProfile(client, {
    profileId: null,
    customerId: plan.customerId,
    subscriptionId: plan.subscriptionId,
  });
  if (!profileId) throw new CustomerNotLinked();
  await client.query(
    `update profiles
     set membership_status = case
           when membership_status = 'refunded' and $2::text <> 'active' then membership_status
           else $2
         end,
         stripe_customer_id = coalesce($3, stripe_customer_id),
         current_period_end = case
           when current_period_end is not null
             and current_period_end < to_timestamp($4::double precision)
             then current_period_end
           else to_timestamp($4::double precision)
         end,
         cancel_at = null,
         billing_event_created = $4,
         updated_at = now()
     where id = $1
       and (billing_event_created is null or billing_event_created <= $4)
       and (stripe_subscription_id is null or stripe_subscription_id = $5)`,
    [profileId, plan.status, plan.customerId, event.created, plan.subscriptionId],
  );
}

async function applyEvent(client: PoolClient, event: Stripe.Event, subscription: Stripe.Subscription | null): Promise<void> {
  if (event.type === "charge.refunded" || event.type === "charge.dispute.created") return;
  if (event.type === "invoice.upcoming") return;
  if (event.type === "invoice.payment_failed") {
    await applyPaymentFailed(client, event);
    return;
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode && session.mode !== "subscription") return;
    const profileHint = uuidOrNull(session.client_reference_id) || uuidOrNull(session.metadata?.profile_id);
    if (subscription) {
      await writeSubscription(client, event, subscription, profileHint);
      return;
    }
    if (session.payment_status === "no_payment_required") return;
    await linkIds(client, event, {
      profileId: profileHint,
      customerId: idOf(session.customer),
      subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
    });
    return;
  }
  await writeSubscription(client, event, event.data.object as Stripe.Subscription, null);
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 500 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripeForVerify().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (!acceptsStripeLivemode(event.livemode)) {
    console.info(
      JSON.stringify({
        event: "stripe_webhook_livemode_ignored",
        type: event.type,
        id: event.id,
        livemode: event.livemode,
      }),
    );
    return Response.json({ received: true });
  }
  if (!HANDLED.has(event.type)) return Response.json({ received: true });

  let subscription: Stripe.Subscription | null = null;
  let revocation: Revocation | null = null;
  try {
    subscription = await loadCheckoutSubscription(event);
    revocation = await revocationFor(event);
  } catch (error) {
    if (error instanceof CustomerNotLinked) {
      console.info(
        JSON.stringify({ event: "stripe_webhook_customer_unlinked", type: event.type, id: event.id }),
      );
      return Response.json({ error: "Customer is not linked yet." }, { status: 409 });
    }
    console.error(
      JSON.stringify({
        event: "stripe_webhook_error",
        type: event.type,
        message: error instanceof Error ? error.message : "retrieve failed",
      }),
    );
    return Response.json({ error: "Webhook failed." }, { status: 500 });
  }

  if (revocation?.action === "revoke" && revocation.subscriptionId) {
    const seen = await query<{ id: string }>(`select id from stripe_events where id = $1`, [event.id]);
    if (!seen.length) {
      try {
        await cancelSubscriptionImpl(revocation.subscriptionId);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "stripe_webhook_error",
            type: event.type,
            message: error instanceof Error ? error.message : "cancel failed",
          }),
        );
        return Response.json({ error: "Webhook failed." }, { status: 500 });
      }
    }
  }

  try {
    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `insert into stripe_events (id, type) values ($1, $2)
         on conflict (id) do nothing
         returning id`,
        [event.id, event.type],
      );
      if (inserted.rowCount === 0) return { duplicate: true };
      if (revocation) await applyRevocation(client, event, revocation);
      else await applyEvent(client, event, subscription);
      return { duplicate: false };
    });
    console.info(JSON.stringify({ event: "stripe_webhook", type: event.type, duplicate: result.duplicate }));
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const unix = subscription ? periodEndUnix(subscription) : null;
      await fulfillCheckoutAgreement(session, unix ? new Date(unix * 1000) : null);
    }
    if (event.type === "invoice.upcoming") {
      await sendDueRenewalReminders();
    }
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof CustomerNotLinked) {
      console.info(
        JSON.stringify({ event: "stripe_webhook_customer_unlinked", type: event.type, id: event.id }),
      );
      return Response.json({ error: "Customer is not linked yet." }, { status: 409 });
    }
    console.error(
      JSON.stringify({
        event: "stripe_webhook_error",
        type: event.type,
        message: error instanceof Error ? error.message : "failed",
      }),
    );
    return Response.json({ error: "Webhook failed." }, { status: 500 });
  }
}
