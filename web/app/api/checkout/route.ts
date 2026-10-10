import { NextResponse } from "next/server";
import { BillingNotConfiguredError, billingProvider, type PlanCode } from "@/lib/billing";
import { memberState } from "@/lib/member";

const PLANS = new Set<PlanCode>(["monthly", "quarterly", "annual"]);

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const plan = String(form?.get("plan") || "");
  if (!PLANS.has(plan as PlanCode)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const member = await memberState();
  if (!member.email) {
    return NextResponse.redirect(new URL("/sign-in/", request.url), 303);
  }
  try {
    const session = await billingProvider().createCheckoutSession({
      plan: plan as PlanCode,
      userId: member.email,
      email: member.email,
      successUrl: new URL("/account/", request.url).toString(),
      cancelUrl: new URL("/pricing/", request.url).toString(),
    });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return NextResponse.json(
        { error: "Stripe Checkout is not connected yet. No charge was made." },
        { status: 501 },
      );
    }
    throw error;
  }
}
