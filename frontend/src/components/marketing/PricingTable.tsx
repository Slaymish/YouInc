// frontend/src/components/marketing/PricingTable.tsx
//
// Full plan comparison table for the /pricing route (design-direction spec
// E4). Renders PRICING (tier headers, prices, CTAs) and PRICING_COMPARISON
// (feature rows) from config.ts — no price or feature copy is duplicated
// here as a literal. Semantic <table> with <caption> + <th scope>, wrapped
// in an overflow-x:auto container so a narrow viewport scrolls the table
// instead of the page.
import type { ReactNode } from "react";
import { BOOKING_URL, PRICING, PRICING_COMPARISON } from "./config";
import { StartFreeCta } from "./StartFreeCta";
import "./PricingTable.css";

function ComparisonCell({ value }: { value: boolean | string }): ReactNode {
  if (value === true) {
    return (
      <>
        <span className="pricing-table__yes" aria-hidden="true">
          ✓
        </span>
        <span className="visually-hidden">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <span className="pricing-table__no" aria-hidden="true">
          —
        </span>
        <span className="visually-hidden">Not included</span>
      </>
    );
  }
  return <span className="pricing-table__note">{value}</span>;
}

export function PricingTable() {
  return (
    <div className="pricing-table__scroll">
      <table className="pricing-table">
        <caption className="pricing-table__caption">
          Compare {PRICING.demo.name}, {PRICING.selfServe.name}, and{" "}
          {PRICING.concierge.name} feature by feature.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="pricing-table__corner">
              <span className="visually-hidden">Feature</span>
            </th>
            <th scope="col">
              <span className="pricing-table__tier-name">
                {PRICING.demo.name}
              </span>
              <span className="pricing-table__tier-price">
                {PRICING.demo.price}
              </span>
            </th>
            <th scope="col" className="pricing-table__featured">
              <span className="pricing-table__badge">Recommended</span>
              <span className="pricing-table__tier-name">
                {PRICING.selfServe.name}
              </span>
              <span className="pricing-table__tier-price">
                {PRICING.selfServe.price}
                <span className="pricing-table__cadence">
                  {PRICING.selfServe.cadence}
                </span>
              </span>
            </th>
            <th scope="col">
              <span className="pricing-table__tier-name">
                {PRICING.concierge.name}
              </span>
              <span className="pricing-table__tier-price">
                {PRICING.concierge.price}
                <span className="pricing-table__cadence">
                  {PRICING.concierge.cadence}
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="pricing-table__cta-row">
            <th scope="row">
              <span className="visually-hidden">Get started</span>
            </th>
            <td>
              <a className="mk-btn mk-btn--ghost" href="/demo">
                Open the demo →
              </a>
            </td>
            <td className="pricing-table__featured">
              <StartFreeCta source="pricing-table" />
            </td>
            <td>
              <a
                className="mk-btn mk-btn--primary"
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {PRICING.concierge.cta}
              </a>
            </td>
          </tr>
          {PRICING_COMPARISON.map((row) => (
            <tr key={row.feature}>
              <th scope="row">{row.feature}</th>
              <td>
                <ComparisonCell value={row.demo} />
              </td>
              <td className="pricing-table__featured">
                <ComparisonCell value={row.selfServe} />
              </td>
              <td>
                <ComparisonCell value={row.concierge} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
