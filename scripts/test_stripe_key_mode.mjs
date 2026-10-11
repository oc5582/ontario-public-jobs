import assert from "node:assert/strict";
import { stripeKeyMode } from "./stripe_tax_rates.mjs";

assert.equal(stripeKeyMode("sk_test_abc"), "test");
assert.equal(stripeKeyMode("sk_live_abc"), "live");
assert.equal(stripeKeyMode("rk_test_abc"), "test");
assert.equal(stripeKeyMode("rk_live_abc"), "live");
assert.equal(stripeKeyMode("pk_test_abc"), null);
assert.equal(stripeKeyMode(""), null);

console.log("stripe key mode tests passed");
