import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkoutSessionCreateParams } from "../web/lib/billing.ts";
import {
  isCheckoutEmail,
  isCheckoutSessionId,
  normalizeCheckoutEmail,
  profileIsSubscribed,
  safeAppOrigin,
  subscriptionBlocksNewCheckout,
} from "../web/lib/guest-checkout.ts";

assert.equal(normalizeCheckoutEmail("  A@B.CA "), "a@b.ca");
assert.equal(isCheckoutEmail("a@b.ca"), true);
assert.equal(isCheckoutEmail("not-an-email"), false);
assert.equal(isCheckoutEmail("a@b"), false);
assert.equal(isCheckoutEmail(`${"a".repeat(250)}@b.ca`), false);

assert.equal(profileIsSubscribed({ stripe_subscription_id: "sub", membership_status: "active" }), true);
assert.equal(profileIsSubscribed({ stripe_subscription_id: "sub", membership_status: "past_due" }), true);
assert.equal(profileIsSubscribed({ stripe_subscription_id: "sub", membership_status: "canceled" }), false);
assert.equal(profileIsSubscribed({ stripe_subscription_id: null, membership_status: "active" }), false);

assert.equal(subscriptionBlocksNewCheckout("active"), true);
assert.equal(subscriptionBlocksNewCheckout("past_due"), true);
assert.equal(subscriptionBlocksNewCheckout("unpaid"), true);
assert.equal(subscriptionBlocksNewCheckout("canceled"), false);
assert.equal(subscriptionBlocksNewCheckout("incomplete"), false);

assert.equal(isCheckoutSessionId("cs_test_abc123"), true);
assert.equal(isCheckoutSessionId("cs_live_abc"), true);
assert.equal(isCheckoutSessionId("../cs_test_abc"), false);
assert.equal(isCheckoutSessionId("pi_abc"), false);

assert.equal(safeAppOrigin("https://publicjobs.ca/pricing/"), "https://publicjobs.ca");
assert.equal(safeAppOrigin("https://www.publicjobs.ca"), "https://www.publicjobs.ca");
assert.equal(safeAppOrigin("https://publicjobs-preview.vercel.app"), "https://publicjobs-preview.vercel.app");
assert.equal(
  safeAppOrigin("https://publicjobs-preview-git-cursor-pricing-guest-checkout-5e63.vercel.app"),
  "https://publicjobs-preview-git-cursor-pricing-guest-checkout-5e63.vercel.app",
);
assert.equal(safeAppOrigin("https://evil.com"), "https://publicjobs.ca");
assert.equal(safeAppOrigin("https://publicjobs.ca.evil.com"), "https://publicjobs.ca");
assert.equal(safeAppOrigin("http://localhost:3000"), "http://localhost:3000");
assert.equal(safeAppOrigin("http://evil.com"), "https://publicjobs.ca");
assert.equal(safeAppOrigin("https://notpublicjobs.vercel.app"), "https://publicjobs.ca");
assert.equal(safeAppOrigin("https://evil.vercel.app"), "https://publicjobs.ca");

const guest = checkoutSessionCreateParams(
  {
    profileId: "00000000-0000-4000-8000-0000000000aa",
    email: "guest@example.com",
    plan: "quarter",
    origin: "https://publicjobs-preview.vercel.app",
    province: "ON",
    guestCheckout: true,
    guestSignInSent: true,
  },
  "cus_1",
  "price_quarter",
  "txr_on",
);
assert.equal(guest.mode, "subscription");
assert.equal(guest.automatic_tax, undefined);
assert.equal(guest.customer, "cus_1");
assert.equal(
  guest.success_url,
  "https://publicjobs-preview.vercel.app/checkout/return/?session_id={CHECKOUT_SESSION_ID}",
);
assert.equal(guest.cancel_url, "https://publicjobs-preview.vercel.app/pricing/");
assert.equal(guest.metadata?.guest_checkout, "1");
assert.equal(guest.metadata?.signin_link_sent, "1");
assert.equal(guest.metadata?.plan, "quarter");
assert.equal(guest.metadata?.tax_province, "ON");
assert.equal(guest.line_items?.[0]?.price, "price_quarter");
assert.deepEqual(guest.line_items?.[0]?.tax_rates, ["txr_on"]);
assert.equal(guest.subscription_data?.metadata?.plan, "quarter");

const member = checkoutSessionCreateParams(
  {
    profileId: "00000000-0000-4000-8000-0000000000aa",
    email: "member@example.com",
    plan: "month",
    origin: "https://publicjobs.ca",
    province: "QC",
  },
  "cus_2",
  "price_month",
  "txr_qc",
);
assert.equal(member.mode, "subscription");
assert.equal(member.automatic_tax, undefined);
assert.equal(
  member.success_url,
  "https://publicjobs.ca/account/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
);
assert.equal(member.metadata?.guest_checkout, undefined);
assert.equal(member.metadata?.plan, "month");
assert.deepEqual(member.line_items?.[0]?.tax_rates, ["txr_qc"]);

const pricing = readFileSync(new URL("../web/app/(info)/pricing/page.tsx", import.meta.url), "utf8");
assert.doesNotMatch(pricing, /\/login\/\?next=\/pricing/);
assert.match(pricing, /startGuestCheckout/);
assert.match(pricing, /collectEmail=\{guest\}/);
assert.match(pricing, /enter your email on this page, then pay on Stripe/);
assert.doesNotMatch(pricing, /You create an account before you pay/);

const plans = readFileSync(new URL("../web/components/PricingPlans.tsx", import.meta.url), "utf8");
assert.doesNotMatch(plans, /You'll sign in with your email first/);
assert.doesNotMatch(plans, /\/login\//);

const form = readFileSync(new URL("../web/components/CheckoutForm.tsx", import.meta.url), "utf8");
assert.match(form, /name="email"/);
assert.match(form, /name="province"/);
assert.match(form, /name="agree"/);
assert.match(form, /Enter your email on this page, then pay on Stripe/);
assert.match(form, /collectEmail \?/);
assert.match(form, /id="checkout-email"/);

console.log("guest checkout tests passed");
