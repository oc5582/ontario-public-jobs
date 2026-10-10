import { handleStripeWebhook } from "@/lib/stripe-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe signs the raw body. The app uses trailingSlash, so the live endpoint
 * is POST /api/stripe/webhook/ (the slash form is served, not redirected).
 * Vercel Authentication may add ?x-vercel-protection-bypass=... The query
 * string is ignored. Membership is updated only after the signature matches.
 */
export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
