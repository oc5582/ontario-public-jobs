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
import { ensureCheckoutProfile, sendMembershipSignIn } from "@/lib/checkout-signin";
import { loadCheckoutReturn } from "@/lib/checkout-return";
import {
  CheckoutProfileError,
  isCheckoutEmail,
  isCheckoutSessionId,
  normalizeCheckoutEmail,
} from "@/lib/guest-checkout";
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
    });
    url = session.url;
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) redirect("/pricing/?notice=stripe");
    if (error instanceof AlreadySubscribedError) redirect("/account/");
    throw error;
  }
  redirect(url);
}

function pricingNotice(notice: string, email: string): never {
  const valid = isCheckoutEmail(email) ? `&email=${encodeURIComponent(email)}` : "";
  redirect(`/pricing/?notice=${notice}${valid}#plans`);
}

export async function startGuestCheckout(formData: FormData) {
  const viewer = await getViewer();
  if (viewer.email) return startCheckout(formData);
  const email = normalizeCheckoutEmail(String(formData.get("email") || ""));
  const plan = String(formData.get("plan") || "");
  if (!isCheckoutEmail(email)) pricingNotice("email", "");
  if (!isPlan(plan)) pricingNotice("plan", email);
  if (formData.get("agree") !== plan) pricingNotice("terms", email);
  const province = String(formData.get("province") || "");
  if (!isProvinceCode(province)) pricingNotice("province", email);
  let url = "";
  try {
    const origin = await requestOrigin();
    const profile = await ensureCheckoutProfile(email, origin);
    const session = await createCheckoutSession({
      profileId: profile.id,
      email: profile.email,
      plan,
      origin,
      province,
      guestCheckout: true,
      guestSignInSent: profile.signInSent,
    });
    url = session.url;
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) pricingNotice("stripe", email);
    if (error instanceof AlreadySubscribedError) pricingNotice("subscribed", email);
    if (error instanceof CheckoutProfileError) pricingNotice(error.notice, email);
    throw error;
  }
  redirect(url);
}

export async function resendCheckoutSignIn(formData: FormData) {
  const sessionId = String(formData.get("session_id") || "");
  if (!isCheckoutSessionId(sessionId)) redirect("/checkout/return/?notice=missing");
  const paid = await loadCheckoutReturn(sessionId);
  if (!paid.ok) redirect(`/checkout/return/?session_id=${encodeURIComponent(sessionId)}&notice=${paid.reason}`);
  const origin = await requestOrigin();
  const result = await sendMembershipSignIn(paid.email, origin);
  const notice = result === "sent" ? "sent" : result === "rate" ? "rate" : "send";
  redirect(`/checkout/return/?session_id=${encodeURIComponent(sessionId)}&notice=${notice}`);
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
