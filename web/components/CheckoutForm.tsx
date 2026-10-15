"use client";

import { useRef, useState } from "react";
import { checkoutCheckboxText } from "@/lib/legal-copy";
import { trackMeta } from "@/lib/meta-pixel";
import { PLANS, planPixel, type PlanId } from "@/lib/site";

function consentParts(plan: PlanId): { before: string; after: string } {
  const text = checkoutCheckboxText(plan);
  const at = text.indexOf("Terms");
  if (at < 0) return { before: text, after: "" };
  return { before: text.slice(0, at), after: text.slice(at + "Terms".length) };
}

function cardNote(id: PlanId, detail: string): string | null {
  if (id === "month") return null;
  return detail;
}

type ProvinceOption = { code: string; label: string };

export function CheckoutForm({
  action,
  provinces,
}: {
  action: (formData: FormData) => void | Promise<void>;
  provinces: ProvinceOption[];
}) {
  const [plan, setPlan] = useState<PlanId>("month");
  const agreeRef = useRef<HTMLInputElement>(null);
  const consent = consentParts(plan);

  function choose(next: PlanId) {
    setPlan(next);
    if (agreeRef.current) agreeRef.current.checked = false;
  }

  return (
    <form
      className="checkout-form"
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
      <div className="checkout-fields">
        <label className="checkout-name" htmlFor="checkout-province">
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
      </div>
      <fieldset>
        <legend>Select a plan</legend>
        <div className="plan-cards">
          {PLANS.map((item) => {
            const note = cardNote(item.id, item.detail);
            return (
              <label key={item.id} className="plan-card">
                <input
                  type="radio"
                  name="plan"
                  value={item.id}
                  checked={plan === item.id}
                  onChange={() => choose(item.id)}
                />
                <span className="plan-card-copy">
                  <span className="plan-card-name">{item.name}</span>
                  <span className="plan-card-price">
                    {item.price}
                    {item.id === "month" ? <span className="plan-card-unit">/month</span> : null}
                  </span>
                  {note ? <span className="plan-card-note">{note}</span> : null}
                  <span className="plan-card-tax">plus applicable GST/HST</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="checkbox terms-ack">
        <input ref={agreeRef} id="checkout-agree" type="checkbox" name="agree" value={plan} required />
        <span>
          <label htmlFor="checkout-agree">{consent.before}</label>
          <a href="/terms/">Terms</a>
          <label htmlFor="checkout-agree">{consent.after}</label>
        </span>
      </div>
      <button className="apply-btn" type="submit">
        Continue to secure payment
      </button>
    </form>
  );
}
