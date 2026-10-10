import { NextResponse } from "next/server";

/**
 * TODO(stripe): verify the Stripe-Signature header with STRIPE_WEBHOOK_SECRET,
 * then update public.profiles with the service role:
 * membership_status, stripe_customer_id, stripe_subscription_id,
 * plan_code, current_period_end.
 * Do not trust the browser for membership.
 */
export async function POST() {
  return NextResponse.json({ error: "Stripe webhook is not connected yet." }, { status: 501 });
}
