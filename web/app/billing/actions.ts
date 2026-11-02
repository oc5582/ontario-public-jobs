"use server";

import { redirect } from "next/navigation";
import { getViewer, requestOrigin } from "@/lib/auth";
import { isProvinceCode } from "@/lib/ca-tax";
import { attributionForForm } from "@/lib/attribution-server";
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

function fromStart(formData: FormData): boolean {
  return String(formData.get("checkout_from") || "") === "start";
}

function startNotice(_formData: FormData, notice: string, email = ""): never {
  const params = new URLSearchParams();
  params.set("notice", notice);
  if (email && isCheckoutEmail(email)) params.set("email", email);
  redirect(`/start/?${params.toString()}`);
}

export async function startCheckout(formData: FormData) {
  const viewer = await getViewer();
  const quiz = fromStart(formData);
  if (!viewer.email || !viewer.profile) redirect(quiz ? "/login/?next=/start/" : "/login/?next=/pricing/");
  const plan = String(formData.get("plan") || "");
  if (!isPlan(plan)) {
    if (quiz) startNotice(formData, "plan");
    redirect("/pricing/?notice=plan");
  }
  if (formData.get("agree") !== plan) {
    if (quiz) startNotice(formData, "terms");
    redirect("/pricing/?notice=terms");
  }
  const province = String(formData.get("province") || "");
  if (!isProvinceCode(province)) {
    if (quiz) startNotice(formData, "province");
    redirect("/pricing/?notice=province");
  }
  let url = "";
  try {
    const origin = await requestOrigin();
    const session = await createCheckoutSession({
      profileId: viewer.profile.id,
      email: viewer.email,
      plan,
      origin,
      province,
      attribution: await attributionForForm(formData),
      cancelPath: quiz ? "/start/" : undefined,
    });
    url = session.url;
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      if (quiz) startNotice(formData, "stripe");
      redirect("/pricing/?notice=stripe");
    }
    if (error instanceof AlreadySubscribedError) redirect("/account/");
    throw error;
  }
  redirect(url);
}

function pricingNotice(notice: string, email: string, formData?: FormData): never {
  if (formData && fromStart(formData)) startNotice(formData, notice, email);
  const valid = isCheckoutEmail(email) ? `&email=${encodeURIComponent(email)}` : "";
  redirect(`/pricing/?notice=${notice}${valid}#plans`);
}

export async function startGuestCheckout(formData: FormData) {
  const viewer = await getViewer();
  if (viewer.email) return startCheckout(formData);
  const email = normalizeCheckoutEmail(String(formData.get("email") || ""));
  const plan = String(formData.get("plan") || "");
  const quiz = fromStart(formData);
  if (!isCheckoutEmail(email)) pricingNotice("email", "", formData);
  if (!isPlan(plan)) pricingNotice("plan", email, formData);
  if (formData.get("agree") !== plan) pricingNotice("terms", email, formData);
  const province = String(formData.get("province") || "");
  if (!isProvinceCode(province)) pricingNotice("province", email, formData);
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
      attribution: await attributionForForm(formData),
      cancelPath: quiz ? "/start/" : undefined,
    });
    url = session.url;
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) pricingNotice("stripe", email, formData);
    if (error instanceof AlreadySubscribedError) pricingNotice("subscribed", email, formData);
    if (error instanceof CheckoutProfileError) pricingNotice(error.notice, email, formData);
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
