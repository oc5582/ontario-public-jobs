"use server";

import { redirect } from "next/navigation";
import { getViewer, requestOrigin } from "@/lib/auth";
import { isProvinceCode } from "@/lib/ca-tax";
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
  if (formData.get("agree") !== plan) redirect("/pricing/?notice=terms");
  const customerName = String(formData.get("customer_name") || "").trim();
  if (customerName.length < 2 || customerName.length > 120) redirect("/pricing/?notice=name");
  const province = String(formData.get("province") || "");
  if (!isProvinceCode(province)) redirect("/pricing/?notice=province");
  let url = "";
  try {
    const origin = await requestOrigin();
    const session = await createCheckoutSession({
      profileId: viewer.profile.id,
      email: viewer.email,
      plan,
      origin,
      province,
      customerName,
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
