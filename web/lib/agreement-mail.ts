import type Stripe from "stripe";
import { query } from "./db";
import { agreementEmail, formatToronto, planById } from "./legal-copy";
import { sendTransactional } from "./transactional-email";
import type { PlanId } from "./site";

function money(cents: number | null | undefined): string {
  if (typeof cents !== "number") return "";
  return `CA$${(cents / 100).toFixed(2)}`;
}

function planOf(value: string | null | undefined): PlanId {
  if (value === "month" || value === "quarter" || value === "year") return value;
  return "month";
}

export async function sendAgreementCopy(input: {
  agreementId: string;
  email: string;
  customerName: string;
  plan: PlanId;
  agreedAt: Date;
  renewsOn: string;
  periodEnd: string;
  priceLabel: string;
  taxCents: number | null;
  totalCents: number | null;
  last4: string;
  idempotencyKey: string;
}): Promise<void> {
  const tax =
    input.taxCents === null
      ? "GST/HST (shown on the payment page)"
      : `GST/HST ${money(input.taxCents)}`;
  const total = input.totalCents === null ? `${input.priceLabel} plus tax` : money(input.totalCents);
  const message = agreementEmail({
    customerName: input.customerName || "there",
    email: input.email,
    plan: input.plan,
    agreedAt: input.agreedAt,
    renewsOn: input.renewsOn,
    periodEnd: input.periodEnd,
    priceLabel: input.priceLabel,
    taxLabel: tax,
    totalLabel: total,
    last4: input.last4 || "the card you entered",
  });
  const sent = await sendTransactional({
    to: input.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: input.idempotencyKey,
  });
  if ("skipped" in sent) {
    console.info(JSON.stringify({ event: "agreement_email_skipped", reason: sent.skipped }));
    return;
  }
  await query(
    `update agreement_acceptances
     set agreement_email_sent_at = now(), agreement_email_id = $2
     where id = $1`,
    [input.agreementId, sent.id],
  );
}

export async function fulfillCheckoutAgreement(session: Stripe.Checkout.Session, periodEnd: Date | null): Promise<void> {
  const agreementId = session.metadata?.agreement_id;
  const email = session.customer_details?.email || session.customer_email || "";
  const name = session.customer_details?.name || "";
  const plan = planOf(session.metadata?.plan);
  if (!email) return;
  let rowId = agreementId || "";
  if (rowId) {
    await query(
      `update agreement_acceptances
       set customer_name = coalesce(nullif($2, ''), customer_name),
           stripe_session_id = coalesce($3, stripe_session_id),
           stripe_subscription_id = coalesce($4, stripe_subscription_id),
           amount_total_cents = $5,
           amount_tax_cents = $6
       where id = $1`,
      [
        rowId,
        name,
        session.id,
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
        session.amount_total ?? null,
        session.total_details?.amount_tax ?? null,
      ],
    );
  } else {
    const found = await query<{ id: string }>(
      `select id from agreement_acceptances
       where email = $1 and plan = $2 and agreement_email_sent_at is null
       order by accepted_at desc limit 1`,
      [email, plan],
    );
    rowId = found[0]?.id || "";
  }
  if (!rowId) return;
  const existing = await query<{ agreement_email_sent_at: string | null; price_label: string; accepted_at: string }>(
    `select agreement_email_sent_at::text, price_label, accepted_at::text from agreement_acceptances where id = $1`,
    [rowId],
  );
  const row = existing[0];
  if (!row || row.agreement_email_sent_at) return;
  if (name) {
    await query(`update profiles set customer_name = $2, updated_at = now() where email = $1`, [email, name]);
  }
  const renews = periodEnd ? formatToronto(periodEnd).replace(/,.*/, "") : "the end of this period";
  await sendAgreementCopy({
    agreementId: rowId,
    email,
    customerName: name || "there",
    plan,
    agreedAt: new Date(row.accepted_at),
    renewsOn: renews,
    periodEnd: renews,
    priceLabel: row.price_label || `${planById(plan).price} ${planById(plan).period}`,
    taxCents: session.total_details?.amount_tax ?? null,
    totalCents: session.amount_total ?? null,
    last4: "the card you entered",
    idempotencyKey: `agreement/${session.id || rowId}`,
  });
}
