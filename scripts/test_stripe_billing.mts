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
import { getPool, query } from "../web/lib/db.ts";
import { grantsMemberAccess, membershipPeriodLabel } from "../web/lib/membership.ts";
import { cardLast4ForCheckout, cardLast4FromCharge, cardLast4FromInvoice } from "../web/lib/agreement-mail.ts";
import { deleteAccount, shouldRetainBillingRecord } from "../web/lib/account-delete.ts";
import {
  acceptsStripeLivemode,
  chargeRefundKind,
  handleStripeWebhook,
  membershipState,
  periodEndUnix,
  setSubscriptionCancellerForTests,
  subscriptionWrite,
} from "../web/lib/stripe-webhook.ts";

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
delete process.env.STRIPE_WEBHOOK_LIVEMODE;
delete process.env.VERCEL_ENV;

assert.equal(chargeRefundKind({ refunded: true, amount: 1694, amount_refunded: 1694 }), "full");
assert.equal(chargeRefundKind({ refunded: false, amount: 1694, amount_refunded: 1694 }), "full");
assert.equal(chargeRefundKind({ refunded: false, amount: 1694, amount_refunded: 100 }), "partial");
assert.equal(acceptsStripeLivemode(false, {}), true);
assert.equal(acceptsStripeLivemode(true, {}), false);
assert.equal(acceptsStripeLivemode(true, { VERCEL_ENV: "production" }), true);
assert.equal(acceptsStripeLivemode(false, { VERCEL_ENV: "production" }), false);
assert.equal(acceptsStripeLivemode(true, { VERCEL_ENV: "preview" }), false);
assert.equal(acceptsStripeLivemode(false, { VERCEL_ENV: "preview" }), true);
assert.equal(acceptsStripeLivemode(true, { VERCEL_ENV: "production", STRIPE_WEBHOOK_LIVEMODE: "test" }), false);
assert.equal(acceptsStripeLivemode(false, { VERCEL_ENV: "preview", STRIPE_WEBHOOK_LIVEMODE: "live" }), false);
assert.equal(acceptsStripeLivemode(true, { STRIPE_WEBHOOK_LIVEMODE: "1" }), true);

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
  {
    profileId: PROFILE,
    email: "stripe-test@example.com",
    plan: "month",
    origin: "https://publicjobs.ca",
    province: "ON",
  },
  "cus_1",
  "price_month",
  "txr_on",
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
assert.equal(params.billing_address_collection, "required");
assert.equal(params.consent_collection?.terms_of_service, "required");
assert.equal(params.metadata?.terms_version, "2026-10-11");
assert.equal(params.metadata?.tax_province, "ON");
assert.equal(params.automatic_tax, undefined);
assert.deepEqual(params.adaptive_pricing, { enabled: false });
assert.equal(
  cardLast4FromCharge({
    payment_method_details: { type: "card", card: { last4: "4242" } },
  } as never),
  "4242",
);
assert.equal(cardLast4FromCharge("ch_123" as never), "");
assert.equal(cardLast4FromCharge({ payment_method_details: { type: "card", card: { last4: "the card" } } } as never), "");

// Subscription Checkout leaves payment_intent null and puts the card on the invoice
// payment. Expanding that payment intent does not include latest_charge.payment_method_details,
// so the charge id has to be retrieved. The old lookup stopped there and emailed no last4.
const expands: string[][] = [];
const invoiceOnly = await cardLast4ForCheckout(
  { id: "cs_sub", object: "checkout.session", mode: "subscription", payment_intent: null, invoice: "in_1" } as never,
  {
    paymentIntents: {
      async retrieve(_id: string, params?: { expand?: string[] }) {
        expands.push(params?.expand || []);
        const expanded = params?.expand?.includes("latest_charge.payment_method_details");
        return {
          id: "pi_1",
          object: "payment_intent",
          latest_charge: expanded
            ? { id: "ch_1", object: "charge", payment_method_details: { type: "card", card: { last4: "4242" } } }
            : "ch_1",
          payment_method: "pm_1",
        } as never;
      },
    },
    charges: {
      async retrieve() {
        return { id: "ch_1", object: "charge", payment_method_details: { type: "card", card: { last4: "4242" } } } as never;
      },
    },
    invoices: {
      async retrieve() {
        return {
          id: "in_1",
          object: "invoice",
          payments: {
            object: "list",
            data: [
              {
                id: "inpay_1",
                payment: { type: "payment_intent", payment_intent: { id: "pi_1", latest_charge: "ch_1", payment_method: "pm_1" } },
              },
            ],
          },
        } as never;
      },
    },
    invoicePayments: { async list() { return { data: [] }; } },
    checkout: { sessions: { async retrieve() { throw new Error("session retrieve unused"); } } },
    subscriptions: { async retrieve() { throw new Error("subscription retrieve unused"); } },
  },
);
assert.equal(invoiceOnly, "4242");
assert.ok(expands.some((expand) => expand.includes("latest_charge.payment_method_details")));

const fromRecord = await cardLast4ForCheckout(
  { id: "cs_rec", object: "checkout.session", mode: "subscription", payment_intent: null, invoice: "in_rec" } as never,
  {
    paymentIntents: { async retrieve() { return { id: "pi_x", latest_charge: null, payment_method: null } as never; } },
    charges: { async retrieve() { return { id: "ch_x", payment_method_details: null } as never; } },
    invoices: {
      async retrieve() {
        return {
          id: "in_rec",
          payments: { data: [{ payment: { type: "payment_record", payment_record: "pr_1" } }] },
        } as never;
      },
    },
    invoicePayments: { async list() { return { data: [] }; } },
    checkout: { sessions: { async retrieve() { return { id: "cs_rec" } as never; } } },
    subscriptions: {
      async retrieve() {
        return { id: "sub_x", default_payment_method: { card: { last4: "1111" } } } as never;
      },
    },
    paymentRecords: {
      async retrieve() {
        return { payment_method_details: { card: { last4: "1881" } } };
      },
    },
  },
);
assert.equal(fromRecord, "1881");
assert.equal(
  cardLast4FromInvoice({
    payments: { data: [{ payment: { payment_record: { payment_method_details: { card: { last4: "1881" } } } } }] },
  } as never),
  "1881",
);
assert.deepEqual(params.line_items?.[0]?.tax_rates, ["txr_on"]);
assert.match(params.custom_text?.submit?.message || "", /HST 13%/);
assert.match(params.custom_text?.terms_of_service_acceptance?.message || "", /5-day refund/);
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
assert.equal(
  membershipPeriodLabel({
    membership_status: "refunded",
    current_period_end: "2026-10-11T15:00:00.000Z",
    cancel_at: null,
  }),
  "Refunded. Access ended October 11, 2026.",
);
assert.equal(shouldRetainBillingRecord({ stripe_subscription_id: null, membership_status: "none" }), false);
assert.equal(shouldRetainBillingRecord({ stripe_subscription_id: "cus_only", membership_status: "none" }), true);
assert.equal(shouldRetainBillingRecord({ stripe_subscription_id: null, membership_status: "refunded" }), true);
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
process.env.STRIPE_TAX_RATE_ON = "txr_on";
const fake = {
  customers: {
    retrieve: async () => ({ id: "cus_existing", object: "customer" }),
    create: async (body: { email?: string; metadata?: { profile_id?: string } }) => {
      creates += 1;
      assert.equal(body.email, "stripe-test@example.com");
      assert.equal(body.metadata?.profile_id, PROFILE);
      return { id: "cus_created", object: "customer" };
    },
    update: async (id: string, body: { name?: string; address?: { country?: string; state?: string } }) => {
      assert.equal(id, "cus_created");
      assert.equal(body.address?.country, "CA");
      assert.equal(body.address?.state, "ON");
      return { id, object: "customer" };
    },
  },
  checkout: {
    sessions: {
      create: async (body: Stripe.Checkout.SessionCreateParams) => {
        assert.equal(body.mode, "subscription");
        assert.equal(body.subscription_data?.trial_period_days, undefined);
        assert.equal(body.optional_items, undefined);
        assert.equal(body.automatic_tax, undefined);
        assert.deepEqual(body.line_items?.[0]?.tax_rates, ["txr_on"]);
        return { url: "https://checkout.stripe.com/c/pay/cs_test_session" };
      },
    },
  },
} as unknown as Stripe;

await resetProfile();
const session = await createCheckoutSession(
  {
    profileId: PROFILE,
    email: "stripe-test@example.com",
    plan: "year",
    origin: "http://localhost:3000",
    province: "ON",
    customerName: "Pat Example",
  },
  fake,
);
assert.equal(session.url, "https://checkout.stripe.com/c/pay/cs_test_session");
assert.equal(creates, 1);
const agreements = await query<{ plan: string; price_label: string; terms_version: string }>(
  `select plan, price_label, terms_version from agreement_acceptances where profile_id = $1`,
  [PROFILE],
);
assert.equal(agreements.length, 1);
assert.equal(agreements[0].plan, "year");
assert.equal(agreements[0].terms_version, "2026-10-11");
assert.match(agreements[0].price_label, /CA\$59 a year/);
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
      {
        profileId: PROFILE,
        email: "stripe-test@example.com",
        plan: "month",
        origin: "http://localhost:3000",
        province: "ON",
      },
      fake,
    ),
  AlreadySubscribedError,
);
assert.equal(creates, 1);

const cancelled: string[] = [];
setSubscriptionCancellerForTests(async (id) => {
  cancelled.push(id);
});

function chargeInvoice(subscriptionId: string) {
  return {
    id: `in_${subscriptionId}`,
    object: "invoice",
    parent: {
      type: "subscription_details",
      quote_details: null,
      subscription_details: { subscription: subscriptionId, metadata: null },
    },
  };
}

async function armRefundProfile() {
  await resetProfile("active");
  await query(
    `update profiles
     set stripe_customer_id = 'cus_refund',
         stripe_subscription_id = 'sub_refund',
         plan = 'month',
         current_period_end = now() + interval '20 days'
     where id = $1`,
    [PROFILE],
  );
}

await armRefundProfile();
const fullRefund = await post(
  event(
    "evt_test_refund_full",
    "charge.refunded",
    {
      id: "ch_full",
      object: "charge",
      amount: 1694,
      amount_refunded: 1694,
      refunded: true,
      customer: "cus_refund",
      invoice: chargeInvoice("sub_refund"),
    },
    6000,
  ),
);
assert.equal(fullRefund.status, 200);
row = await profile();
assert.equal(row?.membership_status, "refunded");
assert.equal(grantsMemberAccess(row), false);
assert.match(membershipPeriodLabel(row), /^Refunded\. Access ended /);
assert.ok(Math.abs(new Date(row?.current_period_end || 0).getTime() - 6000 * 1000) < 1500);
assert.deepEqual(cancelled, ["sub_refund"]);

const fullAgain = await post(
  event(
    "evt_test_refund_full",
    "charge.refunded",
    {
      id: "ch_full",
      object: "charge",
      amount: 1694,
      amount_refunded: 1694,
      refunded: true,
      customer: "cus_refund",
      invoice: chargeInvoice("sub_refund"),
    },
    6000,
  ),
);
assert.equal(fullAgain.status, 200);
assert.deepEqual(cancelled, ["sub_refund"]);
row = await profile();
assert.equal(row?.membership_status, "refunded");

const deletedAfterRefund = await post(
  event(
    "evt_test_deleted_after_refund",
    "customer.subscription.deleted",
    subscription({
      id: "sub_refund",
      customer: "cus_refund",
      status: "canceled",
      ended_at: 1_700_000_000,
    }),
    6100,
  ),
);
assert.equal(deletedAfterRefund.status, 200);
row = await profile();
assert.equal(row?.membership_status, "refunded");
assert.equal(grantsMemberAccess(row), false);
assert.ok(Math.abs(new Date(row?.current_period_end || 0).getTime() - 6000 * 1000) < 1500);
assert.match(membershipPeriodLabel(row), /^Refunded\. Access ended /);

await armRefundProfile();
cancelled.length = 0;
const partial = await post(
  event(
    "evt_test_refund_partial",
    "charge.refunded",
    {
      id: "ch_partial",
      object: "charge",
      amount: 1694,
      amount_refunded: 100,
      refunded: false,
      customer: "cus_refund",
      invoice: chargeInvoice("sub_old"),
    },
    6200,
  ),
);
assert.equal(partial.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");
assert.equal(grantsMemberAccess(row), true);
assert.deepEqual(cancelled, []);

await armRefundProfile();
const dispute = await post(
  event(
    "evt_test_dispute",
    "charge.dispute.created",
    {
      id: "du_test",
      object: "dispute",
      amount: 1694,
      status: "needs_response",
      charge: {
        id: "ch_disputed",
        object: "charge",
        amount: 1694,
        amount_refunded: 0,
        refunded: false,
        customer: "cus_refund",
        invoice: chargeInvoice("sub_refund"),
      },
    },
    6300,
  ),
);
assert.equal(dispute.status, 200);
row = await profile();
assert.equal(row?.membership_status, "canceled");
assert.equal(grantsMemberAccess(row), false);
assert.match(membershipPeriodLabel(row), /^Ended /);
assert.ok(Math.abs(new Date(row?.current_period_end || 0).getTime() - 6300 * 1000) < 1500);
assert.deepEqual(cancelled, ["sub_refund"]);

await armRefundProfile();
cancelled.length = 0;
const oldCharge = await post(
  event(
    "evt_test_refund_old_charge",
    "charge.refunded",
    {
      id: "ch_old",
      object: "charge",
      amount: 1694,
      amount_refunded: 1694,
      refunded: true,
      customer: "cus_refund",
      invoice: chargeInvoice("sub_previous"),
    },
    6350,
  ),
);
assert.equal(oldCharge.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");
assert.equal(grantsMemberAccess(row), true);
assert.deepEqual(cancelled, []);

await resetProfile("none");
const unlinked = await post(
  event(
    "evt_test_dispute_unlinked",
    "charge.dispute.created",
    {
      id: "du_unlinked",
      object: "dispute",
      charge: {
        id: "ch_unlinked",
        object: "charge",
        customer: "cus_not_yet",
        billing_details: { email: "stripe-test@example.com" },
        invoice: chargeInvoice("sub_not_yet"),
      },
    },
    6360,
  ),
);
assert.equal(unlinked.status, 409);
row = await profile();
assert.equal(row?.membership_status, "none");
assert.equal(row?.stripe_customer_id, null);
const unlinkedEvents = await query<{ id: string }>(`select id from stripe_events where id = 'evt_test_dispute_unlinked'`);
assert.equal(unlinkedEvents.length, 0);

await query(
  `update profiles
   set stripe_subscription_id = 'sub_not_yet', membership_status = 'active', plan = 'month',
       current_period_end = now() + interval '20 days'
   where id = $1`,
  [PROFILE],
);
cancelled.length = 0;
setSubscriptionCancellerForTests(async (id) => {
  cancelled.push(id);
});
const linkedOnRetry = await post(
  event(
    "evt_test_dispute_unlinked",
    "charge.dispute.created",
    {
      id: "du_unlinked",
      object: "dispute",
      charge: {
        id: "ch_unlinked",
        object: "charge",
        customer: "cus_not_yet",
        billing_details: { email: "stripe-test@example.com" },
        invoice: chargeInvoice("sub_not_yet"),
      },
    },
    6360,
  ),
);
assert.equal(linkedOnRetry.status, 200);
row = await profile();
assert.equal(row?.membership_status, "canceled");
assert.equal(row?.stripe_customer_id, "cus_not_yet");
assert.match(membershipPeriodLabel(row), /^Ended /);
assert.deepEqual(cancelled, ["sub_not_yet"]);

await armRefundProfile();
setSubscriptionCancellerForTests(async () => {
  throw new Error("stripe down");
});
const cancelFailed = await post(
  event(
    "evt_test_refund_cancel_failed",
    "charge.refunded",
    {
      id: "ch_fail",
      object: "charge",
      amount: 1694,
      amount_refunded: 1694,
      refunded: true,
      customer: "cus_refund",
      invoice: chargeInvoice("sub_refund"),
    },
    6400,
  ),
);
assert.equal(cancelFailed.status, 500);
row = await profile();
assert.equal(row?.membership_status, "active");
const failedEvents = await query<{ id: string }>(`select id from stripe_events where id = 'evt_test_refund_cancel_failed'`);
assert.equal(failedEvents.length, 0);
setSubscriptionCancellerForTests(null);

await resetProfile("none");
process.env.VERCEL_ENV = "production";
const testOnProduction = await post(
  event("evt_test_mode_on_prod", "customer.subscription.updated", subscription({ status: "active" }), 6500),
);
assert.equal(testOnProduction.status, 200);
row = await profile();
assert.equal(row?.membership_status, "none");

process.env.VERCEL_ENV = "preview";
const liveOnPreview = await post({
  ...event("evt_test_live_on_preview", "customer.subscription.updated", subscription({ status: "active" }), 6600),
  livemode: true,
});
assert.equal(liveOnPreview.status, 200);
row = await profile();
assert.equal(row?.membership_status, "none");

delete process.env.VERCEL_ENV;
const testOnPreview = await post(
  event("evt_test_mode_on_preview", "customer.subscription.updated", subscription({ status: "active" }), 6700),
);
assert.equal(testOnPreview.status, 200);
row = await profile();
assert.equal(row?.membership_status, "active");
assert.equal(grantsMemberAccess(row), true);

await query(`delete from stripe_events where id like 'evt_test_%'`);
await query(`delete from agreement_acceptances where profile_id = $1 or email = 'stripe-test@example.com'`, [PROFILE]);
await query(`delete from profiles where id = $1`, [PROFILE]);

const DELETE_ID = "00000000-0000-4000-8000-0000000000bb";
await query(`create table if not exists auth.users (id uuid primary key)`);
await query(`alter table public.profiles drop constraint if exists profiles_id_fkey`);
await query(`insert into auth.users (id) select id from profiles on conflict do nothing`);
await query(
  `alter table public.profiles
   add constraint profiles_id_fkey
   foreign key (id) references auth.users (id) on delete cascade`,
);
await query(`delete from billing_records where email in ('never-paid@example.com', 'paid-then-deleted@example.com')`);
await query(`delete from auth.users where id = $1`, [DELETE_ID]);
await query(`delete from profiles where id = $1`, [DELETE_ID]);

await query(`insert into auth.users (id) values ($1)`, [DELETE_ID]);
await query(
  `insert into profiles (id, email, membership_status, stripe_customer_id)
   values ($1, 'never-paid@example.com', 'none', 'cus_abandoned')`,
  [DELETE_ID],
);
await deleteAccount(DELETE_ID);
const unpaidBills = await query<{ id: string }>(
  `select id from billing_records where email = 'never-paid@example.com'`,
);
assert.equal(unpaidBills.length, 0);
const unpaidProfile = await query<{ id: string }>(`select id from profiles where id = $1`, [DELETE_ID]);
assert.equal(unpaidProfile.length, 0);

await query(`insert into auth.users (id) values ($1)`, [DELETE_ID]);
await query(
  `insert into profiles (id, email, membership_status, stripe_subscription_id, plan)
   values ($1, 'paid-then-deleted@example.com', 'canceled', 'sub_paid', 'month')`,
  [DELETE_ID],
);
await deleteAccount(DELETE_ID);
const paidBills = await query<{ stripe_subscription_id: string }>(
  `select stripe_subscription_id from billing_records where email = 'paid-then-deleted@example.com'`,
);
assert.equal(paidBills.length, 1);
assert.equal(paidBills[0].stripe_subscription_id, "sub_paid");

await query(`insert into auth.users (id) values ($1)`, [DELETE_ID]);
await query(
  `insert into profiles (id, email, membership_status) values ($1, 'cascade@example.com', 'none')`,
  [DELETE_ID],
);
await query(
  `insert into resume_match_usage (profile_id, email_hash, used_on) values ($1, 'cascade', current_date)`,
  [DELETE_ID],
);
await query(`delete from auth.users where id = $1`, [DELETE_ID]);
const cascaded = await query<{ id: string }>(`select id from profiles where id = $1`, [DELETE_ID]);
assert.equal(cascaded.length, 0);
const cascadedUsage = await query<{ id: string }>(
  `select id from resume_match_usage where profile_id = $1`,
  [DELETE_ID],
);
assert.equal(cascadedUsage.length, 0);
await query(`delete from billing_records where email in ('never-paid@example.com', 'paid-then-deleted@example.com')`);
await query(`alter table public.profiles drop constraint if exists profiles_id_fkey`);

const appRole = await query<{ ok: number }>(`select 1 as ok from pg_roles where rolname = 'publicjobs_app'`);
if (!appRole.length) {
  console.log("app-role webhook check skipped: publicjobs_app is not on this database");
} else {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role publicjobs_app");
    await client.query(`insert into stripe_events (id, type) values ($1, 'role.probe')`, [
      `evt_role_${Date.now()}`,
    ]);
    await client.query(`update profiles set updated_at = updated_at where false`);
    await client.query(
      `insert into resume_match_usage (profile_id, email_hash, used_on)
       select id, 'probe', current_date from profiles where false`,
    );
    await client.query("rollback");
  } finally {
    client.release();
  }
  console.log("app role can write stripe_events, profiles, and resume_match_usage");
}

console.log("stripe billing tests passed");
