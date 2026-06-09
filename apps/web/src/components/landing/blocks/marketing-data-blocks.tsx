import Link from 'next/link';

import type { ScopeStatus } from '@/content/marketing/shared';

import { body14, label14 } from '../text-styles';

const statusLabels: Record<ScopeStatus, string> = {
  included: 'Included',
  scaffold: 'Scaffold',
  soon: 'Soon'
};

type MarketingScopeTableProps = {
  rows: readonly { feature: string; status: ScopeStatus }[];
};

export function MarketingScopeTable({ rows }: MarketingScopeTableProps) {
  return (
    <div className="landing-block-scope-table" role="table" aria-label="Product scope">
      <div className="landing-block-scope-table__head" role="row">
        <span role="columnheader" style={label14}>
          Capability
        </span>
        <span role="columnheader" style={label14}>
          Status
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.feature} className="landing-block-scope-table__row" role="row">
          <span role="cell" style={body14}>
            {row.feature}
          </span>
          <span
            role="cell"
            className={`landing-block-scope-table__badge landing-block-scope-table__badge--${row.status}`}
          >
            {statusLabels[row.status]}
          </span>
        </div>
      ))}
    </div>
  );
}

type Persona = {
  id: string;
  title: string;
  outcomes: readonly string[];
};

export function MarketingPersonaCards({ personas }: { personas: readonly Persona[] }) {
  return (
    <div className="landing-block-persona-grid">
      {personas.map((persona) => (
        <article key={persona.id} className="landing-block-persona-card" data-border="true">
          <h3 className="landing-block-persona-card__title" style={label14}>
            {persona.title}
          </h3>
          <ul className="landing-block-persona-card__list">
            {persona.outcomes.map((outcome) => (
              <li key={outcome} style={body14}>
                {outcome}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

type MarketingCalloutProps = {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
  external?: boolean;
};

export function MarketingCallout({ title, body, href, hrefLabel, external = false }: MarketingCalloutProps) {
  return (
    <aside className="landing-block-callout" data-border="true">
      <h3 className="landing-block-callout__title" style={label14}>
        {title}
      </h3>
      <p className="landing-block-callout__body" style={body14}>
        {body}
      </p>
      {href && hrefLabel ? (
        external ? (
          <a className="landing-route-link" href={href} target="_blank" rel="noopener noreferrer">
            {hrefLabel}
          </a>
        ) : (
          <Link className="landing-route-link" href={href}>
            {hrefLabel}
          </Link>
        )
      ) : null}
    </aside>
  );
}

type StepDetail = {
  id: string;
  heading: string;
  body: string;
  links?: readonly { label: string; href: string; external?: boolean }[];
};

export function MarketingStepDetails({ steps }: { steps: readonly StepDetail[] }) {
  return (
    <div className="landing-block-step-details">
      {steps.map((step) => (
        <section key={step.id} id={step.id} className="landing-block-step-details__item" data-border="true">
          <h2 className="landing-block-step-details__heading" style={label14}>
            {step.heading}
          </h2>
          <p style={body14}>{step.body}</p>
          {step.links && step.links.length > 0 ? (
            <div className="landing-block-step-details__links">
              {step.links.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    className="landing-route-link"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.href} className="landing-route-link" href={link.href}>
                    {link.label}
                  </Link>
                )
              )}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
