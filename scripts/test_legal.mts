import assert from "node:assert/strict";
import { provinceByCode } from "../web/lib/ca-tax.ts";
import { agreementEmail, checkoutCheckboxText, disclosureText, pixelBlockedPath, renewalEmail, sellerLine } from "../web/lib/legal-copy.ts";
import { LEGAL, unresolvedLegalPlaceholders } from "../web/lib/legal-config.ts";
import { reminderKind } from "../web/lib/renewal-reminders.ts";
import { planPriceLine } from "../web/lib/site.ts";

assert.deepEqual(unresolvedLegalPlaceholders(), []);
assert.equal(LEGAL.legalName, "Osama Chaudhary");
assert.equal(LEGAL.businessName, "PublicJobs.ca");
assert.equal(sellerLine(), "Osama Chaudhary, operating as PublicJobs.ca");
assert.match(LEGAL.mailingAddress, /603-65 Thorncliffe Park Drive, Toronto, Ontario M4H 1L2, Canada/);
assert.equal(LEGAL.phone, "(647) 917-3942");
assert.equal(LEGAL.phoneTel, "tel:+16479173942");
assert.equal(LEGAL.supportEmail, "hello@publicjobs.ca");
assert.equal(LEGAL.privacyOfficerEmail, "hello@publicjobs.ca");
assert.equal(LEGAL.privacyOfficerName, "Osama Chaudhary");
assert.equal(LEGAL.hstNumber, "712442870RT0001");
assert.equal(LEGAL.pricesIncludeTax, false);
assert.equal(LEGAL.sellTo, "Canada only");
assert.equal(LEGAL.refundWindowDays, 5);
assert.equal(provinceByCode("ON")?.percentage, 13);
assert.equal(provinceByCode("QC")?.percentage, 5);
assert.equal(provinceByCode("QC")?.displayName, "GST");
assert.equal(provinceByCode("NS")?.percentage, 15);
assert.equal(provinceByCode("AB")?.percentage, 5);

assert.equal(planPriceLine("quarter"), "CA$29.99 every 3 months (about CA$10 a month)");
assert.equal(planPriceLine("year"), "CA$59 a year (about CA$4.92 a month)");
assert.match(planPriceLine("month"), /CA\$14\.99/);

const disclosure = disclosureText("quarter");
assert.match(disclosure, /CA\$29\.99 every 3 months/);
assert.match(disclosure, /5 days/);
assert.match(disclosure, /plus applicable GST\/HST/);
assert.match(disclosure, /712442870RT0001/);
assert.doesNotMatch(disclosure, /14 days/);
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
assert.match(mail.text, /5 days/);
assert.match(mail.text, /712442870RT0001/);
assert.doesNotMatch(mail.text, /14 days/);
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
assert.match(renewal.text, /5 days/);
assert.doesNotMatch(renewal.text, /14 days/);
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
