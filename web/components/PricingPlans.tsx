"use client";

import { LEGAL } from "@/lib/legal-config";
import {
  pricingBilled,
  pricingPlans,
  pricingRenewalNote,
  type PlanId,
} from "@/lib/site";

function choosePlan(value: string): PlanId | null {
  if (value === "month" || value === "quarter" || value === "year") return value;
  return null;
}

export function PlanCards({ plan, onChange }: { plan: PlanId; onChange: (next: PlanId) => void }) {
  return (
    <div className="pricing-plans" role="radiogroup" aria-labelledby="plans-h">
      {pricingPlans().map((item) => {
        const billed = pricingBilled(item.id);
        return (
          <label key={item.id} className="pricing-plan">
            <input
              type="radio"
              name="plan"
              value={item.id}
              checked={plan === item.id}
              onChange={(event) => {
                const next = choosePlan(event.target.value);
                if (next) onChange(next);
              }}
            />
            <span className="pricing-plan-card">
              {item.badge ? (
                <span className={item.id === "year" ? "pricing-badge is-alt" : "pricing-badge"}>{item.badge}</span>
              ) : null}
              <span className="pricing-radio" aria-hidden="true" />
              <span className="pricing-plan-name">{item.name}</span>
              <span className="pricing-plan-price">
                {item.perMonth}
                <small>/mo</small>
              </span>
              <span className="pricing-plan-billed">
                {billed.text}
                {billed.savings ? (
                  <>
                    {" | "}
                    <span className="pricing-save">{billed.savings}</span>
                  </>
                ) : null}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function PricingTax() {
  return (
    <p className="pricing-tax">
      Prices in Canadian dollars, plus GST/HST. You see the total with tax before you pay.
    </p>
  );
}

export function PricingTrust() {
  return (
    <ul className="pricing-trust">
      <li>Full refund within {LEGAL.refundWindowDays} days</li>
      <li>Cancel online, anytime</li>
      <li>Secure payment by Stripe</li>
      <li>No trial that turns into a charge</li>
    </ul>
  );
}

export function PricingRenewal({ plan }: { plan: PlanId }) {
  return <p className="pricing-cta-note">{pricingRenewalNote(plan)}</p>;
}
