'use client';

import Link from 'next/link';
import { useState } from 'react';

import { marketingPricingTiers } from '@/content/marketing/pricing';

import { body14, label14 } from '../text-styles';

export function MarketingPricingTable() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="landing-block-pricing">
      <div className="landing-block-pricing__toggle" role="group" aria-label="Billing cycle">
        <button
          type="button"
          className={`landing-block-pricing__toggle-btn${annual ? '' : ' landing-block-pricing__toggle-btn--active'}`}
          onClick={() => setAnnual(false)}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`landing-block-pricing__toggle-btn${annual ? ' landing-block-pricing__toggle-btn--active' : ''}`}
          onClick={() => setAnnual(true)}
        >
          Annual
        </button>
      </div>

      <div className="landing-block-pricing__grid">
        {marketingPricingTiers.map((tier) => {
          const price =
            tier.priceMonthly === null
              ? 'Custom'
              : tier.priceMonthly === 0
                ? '$0'
                : `$${annual ? tier.priceAnnual : tier.priceMonthly}`;

          const external = tier.ctaHref.startsWith('mailto:');

          return (
            <article
              key={tier.id}
              className={`landing-block-pricing__card${tier.highlighted ? ' landing-block-pricing__card--highlight' : ''}`}
              data-border="true"
            >
              {tier.highlighted ? (
                <span className="landing-block-pricing__badge">Most popular</span>
              ) : null}
              <h3 className="landing-block-pricing__name" style={label14}>
                {tier.name}
              </h3>
              <p className="landing-block-pricing__price">
                {price}
                {tier.priceMonthly !== null && tier.priceMonthly > 0 ? (
                  <span className="landing-block-pricing__period">/mo</span>
                ) : null}
              </p>
              <p className="landing-block-pricing__desc" style={body14}>
                {tier.description}
              </p>
              <ul className="landing-block-pricing__limits">
                {tier.limits.map((item) => (
                  <li key={item} style={body14}>
                    {item}
                  </li>
                ))}
              </ul>
              <ul className="landing-block-pricing__features">
                {tier.features.map((item) => (
                  <li key={item} style={body14}>
                    {item}
                  </li>
                ))}
              </ul>
              {external ? (
                <a className="landing-block-pricing__cta" href={tier.ctaHref}>
                  {tier.cta}
                </a>
              ) : (
                <Link className="landing-block-pricing__cta" href={tier.ctaHref}>
                  {tier.cta}
                </Link>
              )}
            </article>
          );
        })}
      </div>
      <p className="landing-block-pricing__note" style={body14}>
        Demo pricing mirrors in-app Settings → Billing. Stripe Checkout applies for paid tiers when configured.
      </p>
    </div>
  );
}
