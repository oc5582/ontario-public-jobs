import assert from "node:assert/strict";
import { agreementEmail, checkoutCheckboxText, disclosureText, pixelBlockedPath, renewalEmail } from "../web/lib/legal-copy.ts";
import { LEGAL, unresolvedLegalPlaceholders } from "../web/lib/legal-config.ts";
import { reminderKind } from "../web/lib/renewal-reminders.ts";
import { planPriceLine } from "../web/lib/site.ts";

const placeholders = unresolvedLegalPlaceholders();
assert.deepEqual(placeholders, [
  "[LEGAL_NAME]",
  "[BUSINESS_NAME]",
  "[MAILING_ADDRESS]",
  "[PHONE]",
  "[SUPPORT_EMAIL]",
  "[PRIVACY_OFFICER_EMAIL]",
  "[HST_NUMBER]",
]);

assert.equal(planPriceLine("quarter"), "CA$29.99 every 3 months (about CA$10 a month)");
assert.equal(planPriceLine("year"), "CA$59 a year (about CA$4.92 a month)");
assert.match(planPriceLine("month"), /CA\$14\.99/);

const disclosure = disclosureText("quarter");
assert.match(disclosure, /CA\$29\.99 every 3 months/);
assert.match(disclosure, /14 days/);
assert.match(disclosure, /GST\/HST/);
assert.match(disclosure, new RegExp(LEGAL.legalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(checkoutCheckboxText("year"), /CA\$59/);
assert.match(checkoutCheckboxText("year"), /until I cancel/);

const mail = agreementEmail({
  customerName: "Pat Example",
  email: "pat@example.com",
  plan: "quarter",
  agreedAt: new Date("2026-10-10T15:00:00.000Z"),
  renewsOn: "January 10, 2027",
  periodEnd: "January 10, 2027",
  priceLabel: planPriceLine("quarter"),
  taxLabel: "GST/HST CA$3.90",
  totalLabel: "CA$33.89",
  last4: "4242",
});
assert.match(mail.subject, /agreement/);
assert.match(mail.text, /Pat Example/);
assert.match(mail.text, /CA\$29\.99 every 3 months/);
assert.match(mail.text, /14 days/);
assert.match(mail.text, /Consumer Protection Act/);
assert.doesNotMatch(mail.text, /%\s*off|discount|limited time|upgrade now/i);
assert.doesNotMatch(mail.html, /%\s*off|discount|limited time|upgrade now/i);

const renewal = renewalEmail({
  customerName: "Pat Example",
  plan: "year",
  renewsOn: "October 10, 2027",
  priceLabel: planPriceLine("year"),
  totalLabel: "CA$59 plus GST/HST",
  last4: "4242",
});
assert.match(renewal.text, /cancel before/);
assert.doesNotMatch(renewal.text, /%\s*off|discount|upgrade now/i);

const now = new Date("2026-10-10T12:00:00.000Z");
assert.equal(reminderKind("year", new Date(now.getTime() + 30 * 86_400_000), now), "year_30");
assert.equal(reminderKind("quarter", new Date(now.getTime() + 7 * 86_400_000), now), "quarter_7");
assert.equal(reminderKind("month", new Date(now.getTime() + 7 * 86_400_000), now), null);
assert.equal(reminderKind("year", new Date(now.getTime() + 7 * 86_400_000), now), null);
assert.equal(reminderKind("quarter", new Date(now.getTime() + 30 * 86_400_000), now), null);

assert.equal(pixelBlockedPath("/match/"), true);
assert.equal(pixelBlockedPath("/account/"), true);
assert.equal(pixelBlockedPath("/pricing/"), true);
assert.equal(pixelBlockedPath("/login/"), true);
assert.equal(pixelBlockedPath("/report/"), true);
assert.equal(pixelBlockedPath("/jobs/"), false);

console.log("legal copy tests passed");
