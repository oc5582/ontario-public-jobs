"use client";

import { useRef, useState } from "react";
import { PlanCards, PricingRenewal, PricingTax, PricingTrust } from "@/components/PricingPlans";
import { checkoutCheckboxText } from "@/lib/legal-copy";
import { trackMeta } from "@/lib/meta-pixel";
import { planPixel, type PlanId } from "@/lib/site";

function consentParts(plan: PlanId): { before: string; after: string } {
  const text = checkoutCheckboxText(plan);
  const at = text.indexOf("Terms");
  if (at < 0) return { before: text, after: "" };
  return { before: text.slice(0, at), after: text.slice(at + "Terms".length) };
}

type ProvinceOption = { code: string; label: string };

export function CheckoutForm({
  action,
  provinces,
  initialPlan,
  collectEmail = false,
  defaultEmail = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  provinces: ProvinceOption[];
  initialPlan: PlanId;
  collectEmail?: boolean;
  defaultEmail?: string;
}) {
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const agreeRef = useRef<HTMLInputElement>(null);
  const consent = consentParts(plan);

  function choose(next: PlanId) {
    setPlan(next);
    if (agreeRef.current) agreeRef.current.checked = false;
  }

  return (
    <form
      className="pricing-checkout"
      action={action}
      onSubmit={(event) => {
        const selectedPlan = new FormData(event.currentTarget).get("plan");
        if (agreeRef.current && typeof selectedPlan === "string") agreeRef.current.value = selectedPlan;
        if (typeof selectedPlan !== "string") return;
        const pixel = planPixel(selectedPlan);
        if (!pixel) return;
        trackMeta("track", "InitiateCheckout", {
          value: pixel.value,
          currency: "CAD",
          content_name: pixel.contentName,
        });
      }}
    >
      <PlanCards plan={plan} onChange={choose} />
      <PricingTax />
      {collectEmail ? (
        <label className="pricing-province" htmlFor="checkout-email">
          Email
          <input
            id="checkout-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            placeholder="you@example.com"
            spellCheck={false}
            defaultValue={defaultEmail}
          />
        </label>
      ) : null}
      <label className="pricing-province" htmlFor="checkout-province">
        Billing province
        <select id="checkout-province" name="province" required defaultValue="">
          <option value="" disabled>
            Select a province or territory
          </option>
          {provinces.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="checkbox terms-ack">
        <input ref={agreeRef} id="checkout-agree" type="checkbox" name="agree" value={plan} required />
        <span>
          <label htmlFor="checkout-agree">{consent.before}</label>
          <a href="/terms/">Terms</a>
          <label htmlFor="checkout-agree">{consent.after}</label>
        </span>
      </div>
      <button className="pricing-cta" type="submit">
        Start my weekly matches
      </button>
      <PricingRenewal plan={plan} />
      {collectEmail ? (
        <p className="pricing-cta-note">Enter your email on this page, then pay on Stripe.</p>
      ) : null}
      <PricingTrust />
    </form>
  );
}
