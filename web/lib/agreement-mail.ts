import type Stripe from "stripe";
import { getStripe } from "./billing";
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
  const total = input.totalCents === null ? `${input.priceLabel} plus applicable GST/HST` : money(input.totalCents);
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
    last4: input.last4,
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
     set agreement_email_sent_at = now(), agreement_email_id = $2, card_last4 = nullif($3, '')
     where id = $1`,
    [input.agreementId, sent.id, input.last4],
  );
}

export async function fulfillCheckoutAgreement(session: Stripe.Checkout.Session, periodEnd: Date | null): Promise<void> {
  const agreementId = session.metadata?.agreement_id;
  const email = session.customer_details?.email || session.customer_email || "";
  const name = session.customer_details?.name || session.customer_details?.individual_name || "";
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
    last4: await cardLast4ForCheckout(session),
    idempotencyKey: `agreement/${session.id || rowId}`,
  });
}

function fourDigits(value: string | null | undefined): string {
  return value && /^\d{4}$/.test(value) ? value : "";
}

export function cardLast4FromCharge(charge: Stripe.Charge | string | null | undefined): string {
  if (!charge || typeof charge === "string") return "";
  return fourDigits(charge.payment_method_details?.card?.last4);
}

function cardLast4FromPaymentMethod(method: Stripe.PaymentMethod | string | null | undefined): string {
  if (!method || typeof method === "string") return "";
  return fourDigits(method.card?.last4);
}

function cardLast4FromPaymentRecord(
  record: { payment_method_details?: { card?: { last4?: string | null } | null } | null } | string | null | undefined,
): string {
  if (!record || typeof record === "string") return "";
  return fourDigits(record.payment_method_details?.card?.last4);
}

export function cardLast4FromPaymentIntent(intent: Stripe.PaymentIntent | string | null | undefined): string {
  if (!intent || typeof intent === "string") return "";
  return cardLast4FromCharge(intent.latest_charge) || cardLast4FromPaymentMethod(intent.payment_method);
}

export function cardLast4FromInvoice(invoice: Stripe.Invoice | string | null | undefined): string {
  if (!invoice || typeof invoice === "string") return "";
  for (const payment of invoice.payments?.data || []) {
    const fromIntent = cardLast4FromPaymentIntent(payment.payment?.payment_intent);
    if (fromIntent) return fromIntent;
    const fromCharge = cardLast4FromCharge(payment.payment?.charge);
    if (fromCharge) return fromCharge;
    const fromRecord = cardLast4FromPaymentRecord(payment.payment?.payment_record);
    if (fromRecord) return fromRecord;
  }
  return "";
}

function cardLast4FromSubscription(subscription: Stripe.Subscription | string | null | undefined): string {
  if (!subscription || typeof subscription === "string") return "";
  return cardLast4FromPaymentMethod(subscription.default_payment_method);
}

/** Stripe client surface used to read a card last4. Tests pass a fake. */
export type CardLast4Client = {
  paymentIntents: {
    retrieve(id: string, params?: { expand?: string[] }): Promise<Stripe.PaymentIntent>;
  };
  charges: {
    retrieve(id: string): Promise<Stripe.Charge>;
  };
  invoices: {
    retrieve(id: string, params?: { expand?: string[] }): Promise<Stripe.Invoice>;
  };
  invoicePayments: {
    list(params: { invoice?: string; expand?: string[] }): Promise<{ data: Stripe.InvoicePayment[] }>;
  };
  checkout: {
    sessions: {
      retrieve(id: string, params?: { expand?: string[] }): Promise<Stripe.Checkout.Session>;
    };
  };
  subscriptions: {
    retrieve(id: string, params?: { expand?: string[] }): Promise<Stripe.Subscription>;
  };
  paymentRecords?: {
    retrieve(id: string): Promise<{ payment_method_details?: { card?: { last4?: string | null } | null } | null }>;
  };
};

async function paymentIntentLast4(stripe: CardLast4Client, intent: Stripe.PaymentIntent | string): Promise<string> {
  const direct = cardLast4FromPaymentIntent(intent);
  if (direct) return direct;
  const id = typeof intent === "string" ? intent : intent.id;
  if (!id) return "";
  // Expanding latest_charge alone omits payment_method_details on the current API.
  // Ask for that hash, then retrieve the charge if it is still only an id.
  let loaded: Stripe.PaymentIntent | null = null;
  try {
    loaded = await stripe.paymentIntents.retrieve(id, {
      expand: ["latest_charge.payment_method_details", "payment_method"],
    });
  } catch {
    try {
      loaded = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge", "payment_method"] });
    } catch {
      loaded = null;
    }
  }
  const fromLoaded = loaded ? cardLast4FromPaymentIntent(loaded) : "";
  if (fromLoaded) return fromLoaded;
  const chargeId = !loaded
    ? null
    : typeof loaded.latest_charge === "string"
      ? loaded.latest_charge
      : loaded.latest_charge?.id;
  if (!chargeId) return "";
  try {
    return cardLast4FromCharge(await stripe.charges.retrieve(chargeId));
  } catch {
    return "";
  }
}

async function paymentRecordLast4(stripe: CardLast4Client, recordId: string): Promise<string> {
  if (!stripe.paymentRecords) return "";
  try {
    return cardLast4FromPaymentRecord(await stripe.paymentRecords.retrieve(recordId));
  } catch {
    return "";
  }
}

async function last4FromInvoicePayments(
  stripe: CardLast4Client,
  payments: Stripe.InvoicePayment[] | undefined,
): Promise<string> {
  for (const payment of payments || []) {
    const inline =
      cardLast4FromPaymentIntent(payment.payment?.payment_intent) ||
      cardLast4FromCharge(payment.payment?.charge) ||
      cardLast4FromPaymentRecord(payment.payment?.payment_record);
    if (inline) return inline;
    const intent = payment.payment?.payment_intent;
    if (intent) {
      const found = await paymentIntentLast4(stripe, intent);
      if (found) return found;
    }
    const charge = payment.payment?.charge;
    if (typeof charge === "string") {
      try {
        const found = cardLast4FromCharge(await stripe.charges.retrieve(charge));
        if (found) return found;
      } catch {
        // The next payment on the invoice may still have a card.
      }
    }
    const record = payment.payment?.payment_record;
    if (typeof record === "string") {
      const found = await paymentRecordLast4(stripe, record);
      if (found) return found;
    }
  }
  return "";
}

async function invoiceLast4(stripe: CardLast4Client, invoice: Stripe.Invoice | string): Promise<string> {
  const direct = cardLast4FromInvoice(invoice);
  if (direct) return direct;
  const id = typeof invoice === "string" ? invoice : invoice.id;
  if (!id) return "";
  let loaded: Stripe.Invoice | null = null;
  try {
    loaded = await stripe.invoices.retrieve(id, {
      expand: [
        "payments.data.payment.payment_intent",
        "payments.data.payment.charge",
        "payments.data.payment.payment_record",
      ],
    });
  } catch {
    try {
      loaded = await stripe.invoices.retrieve(id, { expand: ["payments"] });
    } catch {
      loaded = null;
    }
  }
  const fromLoaded = loaded ? await last4FromInvoicePayments(stripe, loaded.payments?.data) : "";
  if (fromLoaded) return fromLoaded;
  try {
    const listed = await stripe.invoicePayments.list({
      invoice: id,
      expand: ["data.payment.payment_intent", "data.payment.charge", "data.payment.payment_record"],
    });
    return last4FromInvoicePayments(stripe, listed.data);
  } catch {
    return "";
  }
}

async function subscriptionLast4(
  stripe: CardLast4Client,
  subscription: Stripe.Subscription | string,
): Promise<string> {
  const direct = cardLast4FromSubscription(subscription);
  if (direct) return direct;
  const id = typeof subscription === "string" ? subscription : subscription.id;
  if (!id) return "";
  try {
    const loaded = await stripe.subscriptions.retrieve(id, { expand: ["default_payment_method"] });
    return cardLast4FromSubscription(loaded);
  } catch {
    return "";
  }
}

async function lookupCardLast4(stripe: CardLast4Client, session: Stripe.Checkout.Session): Promise<string> {
  if (session.payment_intent) {
    const found = await paymentIntentLast4(stripe, session.payment_intent);
    if (found) return found;
  }
  if (session.invoice) {
    const found = await invoiceLast4(stripe, session.invoice);
    if (found) return found;
  }
  if (session.subscription) {
    const found = await subscriptionLast4(stripe, session.subscription);
    if (found) return found;
  }
  if (!session.id) return "";
  let full: Stripe.Checkout.Session;
  try {
    full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: [
        "payment_intent.latest_charge.payment_method_details",
        "payment_intent.payment_method",
        "invoice.payments",
        "subscription.default_payment_method",
      ],
    });
  } catch {
    return "";
  }
  const fromObjects =
    cardLast4FromPaymentIntent(full.payment_intent) ||
    cardLast4FromInvoice(full.invoice) ||
    cardLast4FromSubscription(full.subscription);
  if (fromObjects) return fromObjects;
  if (full.payment_intent) {
    const found = await paymentIntentLast4(stripe, full.payment_intent);
    if (found) return found;
  }
  if (full.invoice) {
    const found = await invoiceLast4(stripe, full.invoice);
    if (found) return found;
  }
  if (full.subscription) {
    return subscriptionLast4(stripe, full.subscription);
  }
  return "";
}

/** Last4 from the Checkout payment, or "" when Stripe does not return one. */
export async function cardLast4ForCheckout(
  session: Stripe.Checkout.Session,
  stripeClient?: CardLast4Client | null,
): Promise<string> {
  const onSession =
    cardLast4FromPaymentIntent(session.payment_intent) ||
    cardLast4FromInvoice(session.invoice) ||
    cardLast4FromSubscription(session.subscription);
  if (onSession) return onSession;
  const stripe = stripeClient === undefined ? (process.env.STRIPE_SECRET_KEY ? getStripe() : null) : stripeClient;
  if (!stripe) return "";
  try {
    return await lookupCardLast4(stripe, session);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "agreement_last4_unavailable",
        message: error instanceof Error ? error.message : "failed",
      }),
    );
    return "";
  }
}
