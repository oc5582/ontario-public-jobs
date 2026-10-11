import type { TaxJurisdiction } from "./ca-tax";
import { LEGAL } from "./legal-config";
import { PLANS, SITE_URL, planPriceLine, type PlanId } from "./site";

export function planById(plan: PlanId) {
  const found = PLANS.find((item) => item.id === plan);
  if (!found) throw new Error("Unknown plan.");
  return found;
}

export function renewalPeriodPhrase(plan: PlanId): string {
  if (plan === "month") return "month";
  if (plan === "quarter") return "3 months";
  return "year";
}

export function sellerLine(): string {
  return `${LEGAL.legalName}, operating as ${LEGAL.businessName}`;
}

export function taxLine(): string {
  if (LEGAL.pricesIncludeTax) return "Prices include GST/HST.";
  return "Prices are shown plus applicable GST/HST. GST/HST is added at checkout for your Canadian billing province, and the total with tax is shown before you pay. Alberta, British Columbia, Manitoba, Quebec, Saskatchewan, the Northwest Territories, Nunavut, and Yukon are charged GST at 5%. Ontario is charged HST at 13%. New Brunswick, Newfoundland and Labrador, Nova Scotia, and Prince Edward Island are charged HST at 15%. We are not registered for Quebec sales tax (QST), so customers in Quebec are charged GST only.";
}

export function refundSentence(): string {
  const days = LEGAL.refundWindowDays;
  return `You can ask for a full refund within ${days} days after your first purchase and within ${days} days after each renewal, by emailing ${LEGAL.supportEmail} from your account email. We issue at most one such refund per account in any 12-month period. We refund the full amount, including tax, to the original card within ${LEGAL.refundBusinessDays} business days of your request, and your membership ends when the refund is issued.`;
}

export function refundShortLine(): string {
  return `Refund: full refund if you ask within ${LEGAL.refundWindowDays} days of your first purchase or of a renewal, once per account in any 12 months.`;
}

export function homepageConsentText(): string {
  return `I agree to receive job alert emails from PublicJobs.ca at this address. I can unsubscribe anytime. PublicJobs.ca, ${LEGAL.mailingAddress}, ${LEGAL.supportEmail}. I can withdraw this consent anytime.`;
}

export function matchConsentText(): string {
  return `Email me new jobs once a week from PublicJobs.ca, ${LEGAL.mailingAddress}, ${LEGAL.supportEmail}. I can unsubscribe anytime. Matching does not require this.`;
}

export function checkoutCheckboxText(plan: PlanId): string {
  const item = planById(plan);
  return `I have read and agree to the Terms, including the Membership terms. I understand my membership renews automatically at ${item.price} plus applicable GST/HST every ${renewalPeriodPhrase(plan)} until I cancel, and that I can cancel anytime from my Account page.`;
}

export function disclosureText(plan: PlanId): string {
  const item = planById(plan);
  return [
    "Before you subscribe",
    `Seller: ${sellerLine()} · ${LEGAL.mailingAddress} · ${LEGAL.phone} · ${LEGAL.supportEmail}`,
    "What you get: the full filterable list of current openings and up to 20 resume matches a day, starting right away. Job pages, Apply links and the weekly email stay free. A membership does not get you a job or an interview; we are not a recruiter.",
    `Price: ${item.name} ${planPriceLine(plan)}, plus applicable GST/HST for your province (shown before you pay). Prices in Canadian dollars. No other fees. ${taxLine()} GST/HST ${LEGAL.hstNumber}.`,
    `Renews automatically every ${renewalPeriodPhrase(plan)} until you cancel. We email a reminder before yearly and 3-month renewals.`,
    `Cancel anytime on your Account page, by email or by phone; access lasts until the end of the paid period.`,
    refundShortLine(),
    `Memberships are offered to people in ${LEGAL.sellTo}.`,
    `Terms version ${LEGAL.termsVersion}.`,
  ].join("\n");
}

export function stripeTermsMessage(plan: PlanId): string {
  return `I agree to the PublicJobs.ca Terms. My membership renews automatically at the price shown plus applicable GST/HST every ${renewalPeriodPhrase(plan)} until I cancel. I can cancel anytime from my Account page. ${LEGAL.refundWindowDays}-day refund.`;
}

export function stripeSubmitMessage(province: TaxJurisdiction): string {
  return `You'll be charged today, plus applicable ${province.displayName} ${province.percentage}% for ${province.name}, and on each renewal until you cancel. Seller: ${LEGAL.businessName}, ${LEGAL.phone}. Memberships are sold in Canada only.`;
}

export function membershipTermsText(): string {
  return [
    `Membership terms`,
    `Last updated ${LEGAL.effectiveDate}. Version ${LEGAL.termsVersion}.`,
    `1. Who you are dealing with. PublicJobs.ca is operated by ${LEGAL.legalName}, a sole proprietor operating as ${LEGAL.businessName}, ${LEGAL.mailingAddress}, Ontario, Canada. Phone ${LEGAL.phone}. Email ${LEGAL.supportEmail}. GST/HST ${LEGAL.hstNumber}.`,
    `2. What a membership is. A membership gives you, while it is active: (a) the full list of current openings on PublicJobs.ca with all filters, and (b) up to 20 resume matches a day. Matching compares your resume with current openings using automated tools, including AI, and shows openings that look like a fit with a short reason. Matches are suggestions and can be wrong. Job pages, Apply links and the weekly email stay free without a membership. A membership does not get you a job or an interview. PublicJobs.ca is a search tool. It is not an employment agency or recruiter, does not contact employers for you, and does not send your information to employers. PublicJobs.ca is independent and is not affiliated with or endorsed by any government or employer. You need an email address and a current web browser. Memberships are offered to people in ${LEGAL.sellTo}.`,
    `3. Prices. Monthly: CA$14.99 every month. 3 months: CA$29.99 every 3 months. Yearly: CA$59.00 every year. Prices are in Canadian dollars. ${taxLine()} There are no other fees.`,
    `4. Payment and automatic renewal. You pay by card through our payment processor, Stripe. We do not see or store your full card number. Your first payment is charged when you subscribe and your membership starts right away. Your membership renews automatically at the end of each period (every month, every 3 months, or every year, depending on your plan), and we charge the same card the price for your plan plus applicable GST/HST, until you cancel. We will email you a reminder before each renewal: at least ${LEGAL.yearlyReminderDays} days before a yearly renewal and at least ${LEGAL.quarterReminderDays} days before a 3-month renewal.`,
    `5. Cancelling. You can cancel at any time on your Account page (Manage billing). You can also cancel by emailing ${LEGAL.supportEmail} or calling ${LEGAL.phone}. When you cancel, renewal stops. You keep access until the end of the period you have already paid for, and you are not charged again.`,
    `6. Refunds. ${refundSentence()} If we end your membership for a reason that is not your fault, or we shut down the service, we refund the unused part of your current period. These refund rights are in addition to your rights under consumer protection law, including the Ontario Consumer Protection Act, 2002, which we cannot and do not limit.`,
    `7. Fair use. A membership is for one person's own job search. Do not share your login, resell or republish the member list, or copy it with automated tools. We may limit unusual use (for example, very high numbers of requests) to keep the site working for everyone.`,
    `8. Suspension. We may suspend or end a membership that breaks section 7, after telling you why where it is reasonable to do so. If we end it for a breach, we may refund the unused part of your period at our discretion, unless the law requires otherwise.`,
    `9. Changes to price or terms. We may propose changes to the price of your plan or to these membership terms, no more often than once every 12 months for price. We will email you at least ${LEGAL.priceChangeMinDays} days and no more than ${LEGAL.priceChangeMaxDays} days before the change takes effect. The email will show the new terms and price and the date they start, and explain how to cancel at no cost. If you do not want the change, you can cancel before it takes effect and you will not be charged the new price. If you do nothing, the change applies from your next renewal on or after the effective date. Changes do not affect amounts you have already paid.`,
    `10. Our responsibility. We work to keep listings current, but employers change and remove postings, and we cannot guarantee that every listing is accurate, complete or still open, or that the site will always be available. A membership does not guarantee any number of listings or employers. To the extent the law allows, we are not responsible for indirect losses, such as lost job opportunities. Nothing in these terms limits any right you have under consumer protection law that cannot be limited by contract.`,
    `11. Copy of your agreement. After you subscribe, we email you a copy of these terms, your plan, price, tax and the date you subscribed. Keep it for your records. You can print or save this page at any time.`,
    `12. Law. These terms are governed by the laws of Ontario and the federal laws of Canada that apply there. This does not take away any rights you have under the consumer protection law of the province where you live.`,
    `13. Age. You must be at least ${LEGAL.minimumAge} to buy a membership.`,
    `Fraudulent postings. See the written policy at ${SITE_URL}/fraud-policy/.`,
  ].join("\n\n");
}

export function emailFooterText(): string {
  return `PublicJobs.ca, ${LEGAL.mailingAddress} · ${LEGAL.supportEmail} · ${LEGAL.phone} · Privacy policy: ${SITE_URL}/privacy/`;
}

export type AgreementEmailInput = {
  customerName: string;
  email: string;
  plan: PlanId;
  agreedAt: Date;
  renewsOn: string;
  periodEnd: string;
  priceLabel: string;
  taxLabel: string;
  totalLabel: string;
  last4: string;
};

export function formatToronto(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function agreementEmail(input: AgreementEmailInput): { subject: string; text: string; html: string } {
  const item = planById(input.plan);
  const subject = "Your PublicJobs.ca membership agreement – please keep this email";
  const text = [
    `Hi ${input.customerName},`,
    "",
    "Thanks for subscribing. This email is your copy of your agreement.",
    "",
    `Agreement date: ${formatToronto(input.agreedAt)}`,
    `Customer: ${input.customerName}, ${input.email}`,
    `Seller: ${sellerLine()}, ${LEGAL.mailingAddress}, Ontario, Canada · ${LEGAL.phone} · ${LEGAL.supportEmail} · GST/HST ${LEGAL.hstNumber}`,
    "",
    `Plan: ${item.name}`,
    `Price: ${input.priceLabel} + ${input.taxLabel} = ${input.totalLabel}, charged today to your card ending ${input.last4}`,
    `Renewal: Your membership renews automatically on ${input.renewsOn} and every ${renewalPeriodPhrase(input.plan)} after that at ${input.priceLabel} plus applicable GST/HST, until you cancel. We'll remind you before yearly and 3-month renewals.`,
    "What's included: the full filterable list of current openings and up to 20 resume matches a day, starting now. A membership does not get you a job or an interview. PublicJobs.ca is not a recruiter and is not affiliated with any government or employer.",
    `Cancel: anytime at ${SITE_URL}/account/, by replying to this email, or by calling ${LEGAL.phone}. Access continues until ${input.periodEnd}.`,
    `Refund: ${refundSentence()}`,
    "Your rights: These terms do not limit your rights under the Ontario Consumer Protection Act, 2002 or other consumer law.",
    "",
    `The full Membership terms you agreed to (version ${LEGAL.termsVersion}) are below so you can save or print them.`,
    "",
    membershipTermsText(),
    "",
    emailFooterText(),
  ].join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#16202c;line-height:1.45"><p>Hi ${escapeHtml(input.customerName)},</p><p>Thanks for subscribing. This email is your copy of your agreement.</p><p><strong>Agreement date:</strong> ${escapeHtml(formatToronto(input.agreedAt))}<br><strong>Customer:</strong> ${escapeHtml(input.customerName)}, ${escapeHtml(input.email)}<br><strong>Seller:</strong> ${escapeHtml(sellerLine())}, ${escapeHtml(LEGAL.mailingAddress)}, Ontario, Canada · ${escapeHtml(LEGAL.phone)} · ${escapeHtml(LEGAL.supportEmail)} · GST/HST ${escapeHtml(LEGAL.hstNumber)}</p><p><strong>Plan:</strong> ${escapeHtml(item.name)}<br><strong>Price:</strong> ${escapeHtml(input.priceLabel)} + ${escapeHtml(input.taxLabel)} = <strong>${escapeHtml(input.totalLabel)}</strong>, charged today to your card ending ${escapeHtml(input.last4)}<br><strong>Renewal:</strong> Your membership renews automatically on ${escapeHtml(input.renewsOn)} and every ${escapeHtml(renewalPeriodPhrase(input.plan))} after that at ${escapeHtml(input.priceLabel)} plus applicable GST/HST, until you cancel. We'll remind you before yearly and 3-month renewals.<br><strong>What's included:</strong> the full filterable list of current openings and up to 20 resume matches a day, starting now. A membership does not get you a job or an interview. PublicJobs.ca is not a recruiter and is not affiliated with any government or employer.<br><strong>Cancel:</strong> anytime at ${SITE_URL}/account/, by replying to this email, or by calling ${escapeHtml(LEGAL.phone)}. Access continues until ${escapeHtml(input.periodEnd)}.<br><strong>Refund:</strong> ${escapeHtml(refundSentence())}<br><strong>Your rights:</strong> These terms do not limit your rights under the Ontario Consumer Protection Act, 2002 or other consumer law.</p><p>The full Membership terms you agreed to (version ${escapeHtml(LEGAL.termsVersion)}) are below so you can save or print them.</p><pre style="white-space:pre-wrap;font-family:Georgia,serif">${escapeHtml(membershipTermsText())}</pre><p>${escapeHtml(emailFooterText())}</p></body></html>`;
  return { subject, text, html };
}

export type RenewalEmailInput = {
  customerName: string;
  plan: PlanId;
  renewsOn: string;
  priceLabel: string;
  totalLabel: string;
  last4: string;
};

export function renewalEmail(input: RenewalEmailInput): { subject: string; text: string; html: string } {
  const item = planById(input.plan);
  const subject = `Your PublicJobs.ca membership renews on ${input.renewsOn}`;
  const text = [
    `Hi ${input.customerName}, your ${item.name} membership renews automatically on ${input.renewsOn} at ${input.priceLabel} plus applicable GST/HST (${input.totalLabel}) to your card ending ${input.last4}. To keep it, do nothing. To stop it, cancel before ${input.renewsOn} at ${SITE_URL}/account/ or reply to this email. No charge for cancelling. A full refund of that renewal is available if you ask within ${LEGAL.refundWindowDays} days after the renewal charge, once per account in any 12 months, by emailing ${LEGAL.supportEmail}.`,
    "",
    emailFooterText(),
  ].join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#16202c;line-height:1.45"><p>Hi ${escapeHtml(input.customerName)}, your ${escapeHtml(item.name)} membership renews automatically on ${escapeHtml(input.renewsOn)} at ${escapeHtml(input.priceLabel)} plus applicable GST/HST (${escapeHtml(input.totalLabel)}) to your card ending ${escapeHtml(input.last4)}. To keep it, do nothing. To stop it, cancel before ${escapeHtml(input.renewsOn)} at ${SITE_URL}/account/ or reply to this email. No charge for cancelling. A full refund of that renewal is available if you ask within ${LEGAL.refundWindowDays} days after the renewal charge, once per account in any 12 months, by emailing ${escapeHtml(LEGAL.supportEmail)}.</p><p>${escapeHtml(emailFooterText())}</p></body></html>`;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pixelBlockedPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  const blocked = ["/match", "/account", "/login", "/pricing", "/auth", "/billing", "/report"];
  return blocked.some((item) => path === item || path.startsWith(`${item}/`));
}
