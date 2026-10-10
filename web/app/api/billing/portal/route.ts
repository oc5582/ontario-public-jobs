import { NextResponse } from "next/server";
import { BillingNotConfiguredError, billingProvider } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    // TODO(stripe): look up profiles.stripe_customer_id for the signed-in user.
    const session = await billingProvider().createPortalSession({
      stripeCustomerId: "",
      returnUrl: new URL("/account/", request.url).toString(),
    });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return NextResponse.json(
        { error: "Stripe customer portal is not connected yet. Cancel will be self-serve there." },
        { status: 501 },
      );
    }
    throw error;
  }
}
