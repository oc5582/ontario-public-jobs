import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Stripe from "../web/node_modules/stripe/esm/stripe.esm.node.js";
import {
  AlreadySubscribedError,
  checkoutSessionCreateParams,
  createCheckoutSession,
  portalSessionCreateParams,
  priceIdForPlan,
} from "../web/lib/billing.ts";
import { query } from "../web/lib/db.ts";
import { grantsMemberAccess, membershipPeriodLabel } from "../web/lib/membership.ts";
import { handleStripeWebhook, membershipState, periodEndUnix, subscriptionWrite } from "../web/lib/stripe-webhook.ts";

const envFile = readFileSync(new URL("../web/.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
}

process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_PRICE_MONTHLY = "price_month";
process.env.STRIPE_PRICE_QUARTERLY = "price_quarter";
process.env.STRIPE_PRICE_YEARLY = "price_year";
delete process.env.STRIPE_SECRET_KEY;

const PROFILE = "00000000-0000-4000-8000-0000000000aa";
const stripe = new Stripe("sk_test_webhook_verify_only");

function event(id: string, type: string, object: unknown, created: number) {
  return { id, object: "event", type, created, livemode: false, data: { object } };
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_test_1",
    object: "subscription",
    customer: "cus_test_1",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    ended_at: null,
    metadata: { profile_id: PROFILE, plan: "year" },
    items: {
      object: "list",
      data: [{ id: "si_test", current_period_end: 1_900_000_000, price: { id: "price_year" } }],
    },
    ...overrides,
  };
}

async function post(body: unknown, header?: string, url?: string) {
  const payload = JSON.stringify(body);
  const signature =
    header ??
    stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET || "" });
  return handleStripeWebhook(
    new Request(url || "https://preview.vercel.app/api/stripe/webhook/?x-vercel-protection-bypass=bypass-secret", {
      method: "POST",
      headers: signature ? { "stripe-signature": signature } : {},
      body: payload,
    }),
  );
}

async function profile() {
  const rows = await query<{
    membership_status: string;
    plan: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
    cancel_at: string | null;
    billing_event_created: string | null;
  }>(
    `select membership_status, plan, stripe_customer_id, stripe_subscription_id,
            current_period_end::text as current_period_end, cancel_at::text as cancel_at,
            billing_event_created::text as billing_event_created
     from profiles where id = $1`,
    [PROFILE],
  );
  return rows[0];
}

async function resetProfile(status = "none") {
  await query(`delete from stripe_events where id like 'evt_test_%'`);
  await query(
    `insert into profiles (id, email, membership_status, plan, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at, billing_event_created)
     values ($1, 'stripe-test@example.com', $2, null, null, null, null, null, null)
     on conflict (id) do update set
       email = excluded.email,
       membership_status = excluded.membership_status,
       plan = null,
       stripe_customer_id = null,
       stripe_subscription_id = null,
       current_period_end = null,
       cancel_at = null,
       billing_event_created = null,
       updated_at = now()`,
    [PROFILE, status],
  );
}

const params = checkoutSessionCreateParams(
  { profileId: PROFILE, email: "stripe-test@example.com", plan: "month", origin: "https://publicjobs.ca" },
  "cus_1",
  "price_month",
);
assert.equal(params.mode, "subscription");
assert.equal(params.customer, "cus_1");
assert.equal(params.customer_email, undefined);
assert.equal(params.client_reference_id, PROFILE);
assert.equal(params.allow_promotion_codes, false);
assert.equal(params.payment_method_collection, "always");
assert.equal(params.optional_items, undefined);
assert.equal(params.subscription_data?.trial_period_days, undefined);
assert.equal(params.line_items?.[0]?.price, "price_month");
assert.equal(params.success_url, "https://publicjobs.ca/account/?checkout=success");
assert.equal(params.cancel_url, "https://publicjobs.ca/pricing/");
assert.equal(priceIdForPlan("quarter"), "price_quarter");

const portal = portalSessionCreateParams({ stripeCustomerId: "cus_1", origin: "https://publicjobs.ca" });
assert.deepEqual(Object.keys(portal).sort(), ["customer", "return_url"]);
assert.equal(portal.return_url, "https://publicjobs.ca/account/");

assert.equal(membershipState("active"), "active");
assert.equal(membershipState("trialing"), "none");
assert.equal(membershipState("past_due"), "past_due");
assert.equal(membershipState("unpaid"), "past_due");
assert.equal(membershipState("canceled"), "canceled");

const renewing = subscriptionWrite(subscription() as unknown as Stripe.Subscription);
assert.equal(renewing.status, "active");
assert.equal(renewing.plan, "year");
assert.equal(renewing.cancelAt, null);
assert.equal(renewing.periodEnd?.toISOString(), new Date(1_900_000_000 * 1000).toISOString());

const legacy = subscriptionWrite(
  subscription({
    items: { object: "list", data: [] },
    current_period_end: 1_800_000_000,
    metadata: { profile_id: PROFILE, plan: "month" },
  }) as unknown as Stripe.Subscription,
);
assert.equal(periodEndUnix(subscription({ items: { data: [] }, current_period_end: 1_800_000_000 }) as unknown as Stripe.Subscription), 1_800_000_000);
assert.equal(legacy.plan, "month");

const canceling = subscriptionWrite(
  subscription({ cancel_at_period_end: true, cancel_at: 1_850_000_000 }) as unknown as Stripe.Subscription,
);
assert.equal(canceling.cancelAt?.toISOString(), new Date(1_850_000_000 * 1000).toISOString());

assert.equal(
  membershipPeriodLabel({
    membership_status: "active",
    current_period_end: "2026-11-15T15:00:00.000Z",
    cancel_at: null,
  }),
  "Renews November 15, 2026.",
);
assert.equal(
  membershipPeriodLabel({
    membership_status: "active",
    current_period_end: "2026-11-15T15:00:00.000Z",
    cancel_at: "2026-12-01T15:00:00.000Z",
  }),
  "Cancels December 1, 2026. Access continues until then.",
);
assert.equal(
  membershipPeriodLabel({
    membership_status: "canceled",
    current_period_end: "2026-11-15T15:00:00.000Z",
    cancel_at: null,
  }),
  "Ended November 15, 2026.",
);
assert.match(
  membershipPeriodLabel({ membership_status: "past_due", current_period_end: null, cancel_at: null }),
  /last payment failed/,
);
assert.equal(grantsMemberAccess({ membership_status: "active", current_period_end: "2099-01-01T00:00:00.000Z" }), true);
assert.equal(grantsMemberAccess({ membership_status: "active", current_period_end: "2000-01-01T00:00:00.000Z" }), false);
assert.equal(grantsMemberAccess({ membership_status: "past_due", current_period_end: "2099-01-01T00:00:00.000Z" }), false);
assert.equal(grantsMemberAccess({ membership_status: "active", current_period_end: null }), true);

const middleware = readFileSync(new URL("../web/middleware.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../web/app/api/stripe/webhook/route.ts", import.meta.url), "utf8");
assert.match(middleware, /api\/stripe\/webhook/);
assert.doesNotMatch(route, /getViewer|redirect\(/);

await resetProfile();

const missing = await post(event("evt_test_missing", "customer.subscription.updated", subscription(), 10), "");
assert.equal(missing.status, 400);

const forged = await post(event("evt_test_forged", "customer.subscription.updated", subscription(), 10), "t=1,v1=nope");
assert.equal(forged.status, 400);

const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.STRIPE_WEBHOOK_SECRET;
const unconfigured = await post(event("evt_test_unconfigured", "customer.subscription.updated", subscription(), 10));
assert.equal(unconfigured.status, 500);
process.env.STRIPE_WEBHOOK_SECRET = savedSecret;

const ignored = await post(event("evt_test_ignored", "invoice.paid", { id: "in_x" }, 10));
assert.equal(ignored.status, 200);
const ignoredRows = await query<{ n: number }>(`select count(*)::int as n from stripe_events where id = 'evt_test_ignored'`);
assert.equal(Number(ignoredRows[0]?.n || 0), 0);

const activated = await post(
  event("evt_test_active", "customer.subscription.updated", subscription(), 100),
);
assert.equal(activated.status, 200);
let row = await profile();
assert.equal(row?.membership_status, "active");
assert.equal(row?.plan, "year");
assert.equal(row?.stripe_customer_id, "cus_test_1");
assert.equal(row?.stripe_subscription_id, "sub_test_1");
assert.equal(row?.cancel_at, null);
assert.equal(grantsMemberAccess(row), true);

const replay = await post(
  event(
    "evt_test_active",
    "customer.subscription.updated",
    subscription({ status: "canceled" }),
    100,
  ),
);
assert.equal(replay.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");
const eventCount = await query<{ n: number }>(
  `select count(*)::int as n from stripe_events where id = 'evt_test_active'`,
);
assert.equal(Number(eventCount[0]?.n || 0), 1);

const stale = await post(
  event("evt_test_stale", "customer.subscription.deleted", subscription({ status: "canceled" }), 50),
);
assert.equal(stale.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");

const otherSub = await post(
  event(
    "evt_test_other",
    "customer.subscription.deleted",
    subscription({ id: "sub_other", status: "canceled", metadata: { profile_id: PROFILE } }),
    500,
  ),
);
assert.equal(otherSub.status, 200);
row = await profile();
assert.equal(row?.stripe_subscription_id, "sub_test_1");
assert.equal(row?.membership_status, "active");

const switched = await post(
  event(
    "evt_test_switch",
    "customer.subscription.updated",
    subscription({
      items: { object: "list", data: [{ id: "si_q", current_period_end: 1_910_000_000, price: { id: "price_quarter" } }] },
    }),
    200,
  ),
);
assert.equal(switched.status, 200);
row = await profile();
assert.equal(row?.plan, "quarter");

const cancel = await post(
  event(
    "evt_test_cancel",
    "customer.subscription.updated",
    subscription({
      cancel_at_period_end: true,
      cancel_at: 1_850_000_000,
      metadata: { profile_id: PROFILE, plan: "quarter" },
      items: { object: "list", data: [{ id: "si_q", current_period_end: 1_910_000_000, price: { id: "price_quarter" } }] },
    }),
    300,
  ),
);
assert.equal(cancel.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");
assert.ok(row?.cancel_at);
assert.equal(grantsMemberAccess(row), true);
assert.match(membershipPeriodLabel(row), /^Cancels /);

const failed = await post(
  event(
    "evt_test_failed",
    "invoice.payment_failed",
    {
      id: "in_failed",
      object: "invoice",
      customer: "cus_test_1",
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_test_1", metadata: { profile_id: PROFILE } } },
    },
    400,
  ),
);
assert.equal(failed.status, 200);
row = await profile();
assert.equal(row?.membership_status, "past_due");
assert.equal(row?.plan, "quarter");
assert.equal(grantsMemberAccess(row), false);

await resetProfile("active");
await query(
  `update profiles set stripe_subscription_id = 'sub_live', stripe_customer_id = 'cus_live', membership_status = 'active', plan = 'year' where id = $1`,
  [PROFILE],
);
const oldInvoice = await post(
  event(
    "evt_test_old_invoice",
    "invoice.payment_failed",
    { id: "in_old", object: "invoice", customer: "cus_live", subscription: "sub_old" },
    900,
  ),
);
assert.equal(oldInvoice.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");
assert.equal(row?.stripe_subscription_id, "sub_live");

await resetProfile();
const checkout = await post(
  event(
    "evt_test_checkout",
    "checkout.session.completed",
    {
      id: "cs_test",
      object: "checkout.session",
      mode: "subscription",
      payment_status: "paid",
      client_reference_id: PROFILE,
      customer: "cus_checkout",
      metadata: { profile_id: PROFILE, plan: "month" },
      subscription: subscription({
        id: "sub_checkout",
        customer: "cus_checkout",
        metadata: { profile_id: PROFILE, plan: "month" },
        items: { object: "list", data: [{ id: "si_m", current_period_end: 1_920_000_000, price: { id: "price_month" } }] },
      }),
    },
    1000,
  ),
);
assert.equal(checkout.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");
assert.equal(row?.plan, "month");
assert.equal(row?.stripe_customer_id, "cus_checkout");
assert.equal(grantsMemberAccess(row), true);

await resetProfile();
const linkOnly = await post(
  event(
    "evt_test_link",
    "checkout.session.completed",
    {
      id: "cs_link",
      object: "checkout.session",
      mode: "subscription",
      payment_status: "paid",
      client_reference_id: PROFILE,
      customer: "cus_link",
      subscription: "sub_link",
      metadata: { profile_id: PROFILE },
    },
    1100,
  ),
);
assert.equal(linkOnly.status, 200);
row = await profile();
assert.equal(row?.membership_status, "none");
assert.equal(row?.stripe_customer_id, "cus_link");
assert.equal(row?.stripe_subscription_id, "sub_link");
assert.equal(grantsMemberAccess(row), false);

const created = await post(
  event("evt_test_created", "customer.subscription.created", subscription({ id: "sub_link", customer: "cus_link" }), 1200),
);
assert.equal(created.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");

const ended = await post(
  event(
    "evt_test_deleted",
    "customer.subscription.deleted",
    subscription({ id: "sub_link", customer: "cus_link", status: "canceled", ended_at: 1_930_000_000 }),
    1300,
  ),
);
assert.equal(ended.status, 200);
row = await profile();
assert.equal(row?.membership_status, "canceled");
assert.equal(grantsMemberAccess(row), false);
assert.match(membershipPeriodLabel(row), /^Ended /);

await resetProfile();
const trial = await post(
  event("evt_test_trial", "customer.subscription.updated", subscription({ status: "trialing" }), 1400),
);
assert.equal(trial.status, 200);
row = await profile();
assert.equal(row?.membership_status, "none");
assert.equal(grantsMemberAccess(row), false);

const unmatched = await post(
  event(
    "evt_test_unknown",
    "invoice.payment_failed",
    { id: "in_unknown", object: "invoice", customer: "cus_nobody", subscription: "sub_nobody" },
    1500,
  ),
);
assert.equal(unmatched.status, 200);

let creates = 0;
const fake = {
  customers: {
    retrieve: async () => ({ id: "cus_existing", object: "customer" }),
    create: async (body: { email?: string; metadata?: { profile_id?: string } }) => {
      creates += 1;
      assert.equal(body.email, "stripe-test@example.com");
      assert.equal(body.metadata?.profile_id, PROFILE);
      return { id: "cus_created", object: "customer" };
    },
  },
  checkout: {
    sessions: {
      create: async (body: Stripe.Checkout.SessionCreateParams) => {
        assert.equal(body.mode, "subscription");
        assert.equal(body.subscription_data?.trial_period_days, undefined);
        assert.equal(body.optional_items, undefined);
        return { url: "https://checkout.stripe.com/c/pay/cs_test_session" };
      },
    },
  },
} as unknown as Stripe;

await resetProfile();
const session = await createCheckoutSession(
  { profileId: PROFILE, email: "stripe-test@example.com", plan: "year", origin: "http://localhost:3000" },
  fake,
);
assert.equal(session.url, "https://checkout.stripe.com/c/pay/cs_test_session");
assert.equal(creates, 1);
row = await profile();
assert.equal(row?.stripe_customer_id, "cus_created");
assert.equal(row?.membership_status, "none");

await query(
  `update profiles set membership_status = 'active', stripe_subscription_id = 'sub_already', stripe_customer_id = 'cus_created' where id = $1`,
  [PROFILE],
);
await assert.rejects(
  () =>
    createCheckoutSession(
      { profileId: PROFILE, email: "stripe-test@example.com", plan: "month", origin: "http://localhost:3000" },
      fake,
    ),
  AlreadySubscribedError,
);
assert.equal(creates, 1);

await query(`delete from stripe_events where id like 'evt_test_%'`);
await query(`delete from profiles where id = $1`, [PROFILE]);

console.log("stripe billing tests passed");
