import Link from 'next/link';
import type { ReactNode } from 'react';

import { body14, label14, sectionTitle } from './text-styles';

type MarketingPageHeaderProps = {
  title: string;
  description?: string;
};

export function MarketingPageHeader({ title, description }: MarketingPageHeaderProps) {
  return (
    <header className="landing-route-header">
      <h1 className="landing-route-title" style={sectionTitle}>
        {title}
      </h1>
      {description ? (
        <p className="landing-route-lead" style={body14}>
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function MarketingPageBody({ children }: { children: ReactNode }) {
  return <div className="landing-route-body">{children}</div>;
}

export function MarketingSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="landing-route-section-heading" style={label14}>
      {children}
    </h2>
  );
}

export function MarketingParagraph({ children }: { children: ReactNode }) {
  return (
    <p className="landing-route-paragraph" style={body14}>
      {children}
    </p>
  );
}

type MarketingBulletListProps = {
  items: readonly string[];
};

export function MarketingBulletList({ items }: MarketingBulletListProps) {
  return (
    <ul className="landing-route-list">
      {items.map((item) => (
        <li key={item} className="landing-route-list__item" style={body14}>
          {item}
        </li>
      ))}
    </ul>
  );
}

type MarketingTextLinkProps = {
  href: string;
  children: ReactNode;
  external?: boolean;
};

export function MarketingTextLink({ href, children, external = false }: MarketingTextLinkProps) {
  if (external) {
    return (
      <a className="landing-route-link" href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link className="landing-route-link" href={href}>
      {children}
    </Link>
  );
}
