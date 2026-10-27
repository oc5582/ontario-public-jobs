import Stripe from "stripe";
import { getStripe } from "./billing";
import { query } from "./db";
import { isCheckoutSessionId } from "./guest-checkout";

export type CheckoutReturn =
  | { ok: false; reason: "missing" | "unpaid" | "unavailable" }
  | { ok: true; email: string; sessionId: string; signInAlreadySent: boolean };

function missingSession(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing";
}

export async function loadCheckoutReturn(sessionId: string): Promise<CheckoutReturn> {
  if (!isCheckoutSessionId(sessionId)) return { ok: false, reason: "missing" };
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, reason: "unavailable" };
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (missingSession(error)) return { ok: false, reason: "missing" };
    throw error;
  }
  if (session.mode && session.mode !== "subscription") return { ok: false, reason: "missing" };
  if (session.payment_status !== "paid") return { ok: false, reason: "unpaid" };
  const profileId = session.metadata?.profile_id || session.client_reference_id || "";
  let email = "";
  if (profileId) {
    const rows = await query<{ email: string }>(`select email from profiles where id = $1`, [profileId]);
    email = rows[0]?.email || "";
  }
  if (!email) email = session.customer_details?.email || session.customer_email || "";
  return {
    ok: true,
    email,
    sessionId: session.id,
    signInAlreadySent: session.metadata?.signin_link_sent === "1",
  };
}
