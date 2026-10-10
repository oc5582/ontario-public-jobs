import type { PoolClient } from "pg";
import Stripe from "stripe";
import { getStripe, planForPrice } from "./billing";
import { withTransaction } from "./db";
import type { PlanId } from "./site";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MembershipState = "none" | "active" | "past_due" | "canceled";

let verifyClient: Stripe | null = null;

function stripeForVerify(): Stripe {
  if (process.env.STRIPE_SECRET_KEY) return getStripe();
  if (!verifyClient) verifyClient = new Stripe("sk_test_webhook_verify_only");
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
         membership_status = $4,
         plan = coalesce($5, plan),
         current_period_end = coalesce($6, current_period_end),
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

async function applyEvent(client: PoolClient, event: Stripe.Event, subscription: Stripe.Subscription | null): Promise<void> {
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
  if (!HANDLED.has(event.type)) return Response.json({ received: true });

  let subscription: Stripe.Subscription | null = null;
  try {
    subscription = await loadCheckoutSubscription(event);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "stripe_webhook_error",
        type: event.type,
        message: error instanceof Error ? error.message : "retrieve failed",
      }),
    );
    return Response.json({ error: "Webhook failed." }, { status: 500 });
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
      await applyEvent(client, event, subscription);
      return { duplicate: false };
    });
    console.info(JSON.stringify({ event: "stripe_webhook", type: event.type, duplicate: result.duplicate }));
    return Response.json({ received: true });
  } catch (error) {
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
