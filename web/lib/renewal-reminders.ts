import { query } from "./db";
import { LEGAL } from "./legal-config";
import { renewalEmail } from "./legal-copy";
import { sendTransactional } from "./transactional-email";
import { planPriceLine, type PlanId } from "./site";

export type ReminderKind = "year_30" | "quarter_7";

export function reminderKind(plan: string, periodEnd: Date, now = new Date()): ReminderKind | null {
  const days = (periodEnd.getTime() - now.getTime()) / 86_400_000;
  if (plan === "year" && days >= LEGAL.yearlyReminderDays - 1 && days < LEGAL.yearlyReminderDays + 1) return "year_30";
  if (plan === "quarter" && days >= LEGAL.quarterReminderDays - 1 && days < LEGAL.quarterReminderDays + 1) {
    return "quarter_7";
  }
  return null;
}

function planOf(value: string): PlanId | null {
  if (value === "month" || value === "quarter" || value === "year") return value;
  return null;
}

export async function sendDueRenewalReminders(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const rows = await query<{
    email: string;
    customer_name: string | null;
    plan: string;
    stripe_subscription_id: string;
    current_period_end: string;
  }>(
    `select email, customer_name, plan, stripe_subscription_id, current_period_end::text
     from profiles
     where membership_status = 'active'
       and cancel_at is null
       and stripe_subscription_id is not null
       and plan in ('quarter', 'year')
       and current_period_end is not null`,
  );
  let sent = 0;
  let skipped = 0;
  for (const row of rows) {
    const plan = planOf(row.plan);
    const periodEnd = new Date(row.current_period_end);
    if (!plan) continue;
    const kind = reminderKind(plan, periodEnd, now);
    if (!kind || !row.stripe_subscription_id) {
      skipped += 1;
      continue;
    }
    const claimed = await query<{ id: string }>(
      `insert into renewal_reminders (stripe_subscription_id, period_end, kind)
       values ($1, $2, $3)
       on conflict (stripe_subscription_id, period_end, kind) do nothing
       returning id`,
      [row.stripe_subscription_id, periodEnd.toISOString(), kind],
    );
    if (!claimed[0]) {
      skipped += 1;
      continue;
    }
    const renewsOn = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(periodEnd);
    const message = renewalEmail({
      customerName: row.customer_name || "there",
      plan,
      renewsOn,
      priceLabel: planPriceLine(plan),
      totalLabel: `${planPriceLine(plan)} plus GST/HST`,
      last4: "the card on file",
    });
    try {
      const result = await sendTransactional({
        to: row.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        idempotencyKey: `renewal/${row.stripe_subscription_id}/${periodEnd.toISOString()}/${kind}`,
      });
      if ("id" in result) {
        await query(`update renewal_reminders set email_id = $2 where id = $1`, [claimed[0].id, result.id]);
      }
      sent += 1;
    } catch (error) {
      await query(`delete from renewal_reminders where id = $1`, [claimed[0].id]);
      throw error;
    }
  }
  return { sent, skipped };
}
