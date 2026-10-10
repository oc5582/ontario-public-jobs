"use server";

import { redirect } from "next/navigation";
import { getViewer, requestOrigin } from "@/lib/auth";
import {
  AlreadySubscribedError,
  BillingNotConfiguredError,
  createCheckoutSession,
  createPortalSession,
} from "@/lib/billing";
import type { PlanId } from "@/lib/site";

function isPlan(value: string): value is PlanId {
  return value === "month" || value === "quarter" || value === "year";
}

export async function startCheckout(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer.email || !viewer.profile) redirect("/login/?next=/pricing/");
  const plan = String(formData.get("plan") || "");
  if (!isPlan(plan)) redirect("/pricing/?notice=plan");
  if (formData.get("agree") !== "yes") redirect("/pricing/?notice=terms");
  let url = "";
  try {
    const origin = await requestOrigin();
    const session = await createCheckoutSession({
      profileId: viewer.profile.id,
      email: viewer.email,
      plan,
      origin,
    });
    url = session.url;
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) redirect("/pricing/?notice=stripe");
    if (error instanceof AlreadySubscribedError) redirect("/account/");
    throw error;
  }
  redirect(url);
}

export async function openPortal() {
  const viewer = await getViewer();
  if (!viewer.email) redirect("/login/?next=/account/");
  const customer = viewer.profile?.stripe_customer_id;
  if (!customer) redirect("/account/?notice=portal");
  let url = "";
  try {
    const origin = await requestOrigin();
    const session = await createPortalSession({ stripeCustomerId: customer, origin });
    url = session.url;
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) redirect("/account/?notice=stripe");
    throw error;
  }
  redirect(url);
}
