export const dynamic = "force-dynamic";

/**
 * Stripe is not connected. This route refuses every request, including
 * unsigned ones. When Stripe is added, verify STRIPE_WEBHOOK_SECRET and then
 * update profiles only from these events:
 *   checkout.session.completed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.paid
 * Membership status must not be taken from the browser.
 */
export async function POST() {
  return Response.json({ error: "Stripe webhook is not connected yet." }, { status: 501 });
}
