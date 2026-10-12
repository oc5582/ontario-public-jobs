import assert from "node:assert/strict";
import { isFirstSignIn, signupMethod } from "../web/lib/analytics.ts";
import { paywallPage } from "../web/lib/paywall-page.ts";
import { checkoutActivationPlan } from "../web/lib/stripe-webhook.ts";

assert.equal(paywallPage("/"), "home");
assert.equal(paywallPage(""), "home");
assert.equal(paywallPage("/jobs/"), "jobs");
assert.equal(paywallPage("/jobs"), "jobs");
assert.equal(paywallPage("/jobs/ttc/operator/"), "other");
assert.equal(paywallPage("/employers/"), "other");
assert.equal(paywallPage("/employers/city-of-toronto/"), "employer");
assert.equal(paywallPage("/match/"), "match");
assert.equal(paywallPage("/pricing/"), "other");

assert.equal(signupMethod({ app_metadata: { provider: "google" } }), "google");
assert.equal(signupMethod({ app_metadata: { provider: "email" } }), "email");
assert.equal(signupMethod({ identities: [{ provider: "google" }] }), "google");
assert.equal(signupMethod({}), "email");
assert.equal(
  signupMethod({ app_metadata: { provider: "email" }, identities: [{ provider: "google" }] }),
  "email",
);

const created = "2026-10-12T00:00:00.000Z";
const clicked = "2026-10-12T00:12:00.000Z";
assert.equal(isFirstSignIn({ created_at: created, last_sign_in_at: "2026-10-12T00:00:02.000Z" }), true);
assert.equal(isFirstSignIn({ created_at: created, last_sign_in_at: "2026-10-12T00:02:00.000Z" }), false);
assert.equal(
  isFirstSignIn({ created_at: created, email_confirmed_at: clicked, last_sign_in_at: clicked }),
  true,
);
assert.equal(
  isFirstSignIn({
    created_at: created,
    email_confirmed_at: created,
    last_sign_in_at: clicked,
    identities: [{ created_at: created }],
  }),
  false,
);
assert.equal(isFirstSignIn({ created_at: created }, Date.parse("2026-10-12T00:00:05.000Z")), true);
assert.equal(isFirstSignIn({ created_at: created }, Date.parse("2026-10-12T00:05:00.000Z")), false);

delete process.env.STRIPE_PRICE_MONTHLY;
delete process.env.STRIPE_PRICE_QUARTERLY;
delete process.env.STRIPE_PRICE_YEARLY;

function checkout(livemode: boolean, subscription: unknown, mode = "subscription") {
  return {
    id: "evt_analytics",
    object: "event",
    type: "checkout.session.completed",
    created: 1,
    livemode,
    data: {
      object: {
        id: "cs_analytics",
        object: "checkout.session",
        mode,
        metadata: { plan: "month" },
        subscription,
      },
    },
  } as unknown as Parameters<typeof checkoutActivationPlan>[0];
}

function subscription(status: string, plan = "quarter") {
  return {
    id: "sub_analytics",
    object: "subscription",
    customer: "cus_analytics",
    status,
    cancel_at_period_end: false,
    cancel_at: null,
    ended_at: null,
    metadata: { plan },
    items: {
      object: "list",
      data: [{ id: "si_analytics", current_period_end: 1_900_000_000, price: { id: "price_not_configured" } }],
    },
  };
}

assert.equal(checkoutActivationPlan(checkout(true, subscription("active", "year")), subscription("active", "year") as never), "year");
assert.equal(checkoutActivationPlan(checkout(false, subscription("active")), subscription("active") as never), null);
assert.equal(checkoutActivationPlan(checkout(true, subscription("incomplete")), subscription("incomplete") as never), null);
assert.equal(checkoutActivationPlan(checkout(true, subscription("trialing")), subscription("trialing") as never), null);
assert.equal(checkoutActivationPlan(checkout(true, null), null), null);
assert.equal(checkoutActivationPlan(checkout(true, subscription("active"), "payment"), subscription("active") as never), null);
const updated = checkout(true, subscription("active"));
updated.type = "customer.subscription.updated";
assert.equal(checkoutActivationPlan(updated, subscription("active") as never), null);

console.log("analytics tests passed");
