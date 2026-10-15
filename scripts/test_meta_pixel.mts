import assert from "node:assert/strict";
import { metaArguments } from "../web/lib/meta-pixel.ts";
import { purchasePixelFromSession, isCheckoutSessionId } from "../web/lib/meta-purchase-rules.ts";
import { isRegistrationToken, newRegistrationToken } from "../web/lib/meta-registration.ts";
import { planPixel } from "../web/lib/site.ts";

assert.deepEqual(planPixel("month"), { value: 14.99, contentName: "monthly" });
assert.deepEqual(planPixel("quarter"), { value: 29.99, contentName: "3months" });
assert.deepEqual(planPixel("year"), { value: 59, contentName: "year" });
assert.equal(planPixel("lifetime"), null);

assert.deepEqual(metaArguments("track", "Lead"), ["track", "Lead"]);
assert.deepEqual(metaArguments("track", "ViewContent", { content_name: "pricing" }), [
  "track",
  "ViewContent",
  { content_name: "pricing" },
]);
assert.deepEqual(
  metaArguments("track", "InitiateCheckout", { value: 14.99, currency: "CAD", content_name: "monthly" }),
  ["track", "InitiateCheckout", { value: 14.99, currency: "CAD", content_name: "monthly" }],
);
assert.deepEqual(metaArguments("trackCustom", "MatchComplete"), ["trackCustom", "MatchComplete"]);
assert.deepEqual(
  metaArguments("track", "Purchase", { value: 59, currency: "CAD", content_name: "year" }, "cs_test_abc"),
  ["track", "Purchase", { value: 59, currency: "CAD", content_name: "year" }, { eventID: "cs_test_abc" }],
);

const profile = "11111111-1111-1111-1111-111111111111";
const paid = {
  id: "cs_test_paid",
  status: "complete",
  payment_status: "paid",
  client_reference_id: profile,
  metadata: { profile_id: profile, plan: "month" },
};
assert.deepEqual(purchasePixelFromSession(paid, profile), {
  eventId: "cs_test_paid",
  value: 14.99,
  contentName: "monthly",
});
assert.equal(purchasePixelFromSession({ ...paid, payment_status: "unpaid" }, profile), null);
assert.equal(purchasePixelFromSession({ ...paid, status: "expired" }, profile), null);
assert.equal(purchasePixelFromSession({ ...paid, payment_status: "no_payment_required" }, profile), null);
assert.equal(purchasePixelFromSession({ ...paid, client_reference_id: "other" }, profile), null);
assert.equal(
  purchasePixelFromSession({ ...paid, metadata: { profile_id: profile, plan: "nope" } }, profile),
  null,
);
assert.deepEqual(
  purchasePixelFromSession(
    { ...paid, client_reference_id: null, metadata: { profile_id: profile, plan: "quarter" } },
    profile,
  ),
  { eventId: "cs_test_paid", value: 29.99, contentName: "3months" },
);
assert.deepEqual(
  purchasePixelFromSession({ ...paid, metadata: { profile_id: profile, plan: "year" } }, profile),
  { eventId: "cs_test_paid", value: 59, contentName: "year" },
);

assert.equal(isCheckoutSessionId("cs_test_abc_123"), true);
assert.equal(isCheckoutSessionId("cs_live_abc"), true);
assert.equal(isCheckoutSessionId("pi_123"), false);
assert.equal(isCheckoutSessionId("cs_test_abc;drop"), false);
assert.equal(isCheckoutSessionId(""), false);

const token = newRegistrationToken();
assert.equal(isRegistrationToken(token), true);
assert.equal(token.includes("@"), false);
assert.equal(isRegistrationToken("1"), false);
assert.equal(isRegistrationToken("not-a-token"), false);
