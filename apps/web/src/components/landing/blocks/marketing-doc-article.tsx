import Link from 'next/link';
import type { ReactNode } from 'react';

import type { DocNavItem } from '@/content/marketing/docs-index';

import {
  MarketingBulletList,
  MarketingParagraph,
  MarketingSectionHeading,
  MarketingTextLink
} from '../marketing-content';
import { body14, label14 } from '../text-styles';
import { MarketingDocFeedback } from './marketing-doc-feedback';

export type DocTocItem = {
  id: string;
  label: string;
};

export type DocArticleProps = {
  lead: string;
  audience?: string;
  prerequisites?: readonly string[];
  children: ReactNode;
  expectedResult?: string;
  relatedLinks?: readonly DocNavItem[];
  toc?: readonly DocTocItem[];
};

export function MarketingDocArticle({
  lead,
  audience,
  prerequisites,
  children,
  expectedResult,
  relatedLinks,
  toc = []
}: DocArticleProps) {
  return (
    <div className="landing-doc-article">
      <p className="landing-doc-article__lead" style={label14}>
        {lead}
      </p>

      {audience ? (
        <div className="landing-doc-article__meta">
          <span className="landing-doc-article__meta-label" style={body14}>
            Who this is for
          </span>
          <p style={body14}>{audience}</p>
        </div>
      ) : null}

      {prerequisites && prerequisites.length > 0 ? (
        <div className="landing-doc-article__meta">
          <span className="landing-doc-article__meta-label" style={body14}>
            Prerequisites
          </span>
          <MarketingBulletList items={prerequisites} />
        </div>
      ) : null}

      {toc.length > 0 ? (
        <nav className="landing-doc-article__mobile-toc" aria-label="On this page">
          <p className="landing-doc-article__meta-label" style={body14}>
            On this page
          </p>
          <ul className="landing-doc-toc__list">
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="landing-doc-toc__link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="landing-doc-article__body">{children}</div>

      {expectedResult ? (
        <div className="landing-doc-article__result" id="expected-result">
          <MarketingSectionHeading>Expected result</MarketingSectionHeading>
          <MarketingParagraph>{expectedResult}</MarketingParagraph>
        </div>
      ) : null}

      {relatedLinks && relatedLinks.length > 0 ? (
        <div className="landing-doc-article__related">
          <MarketingSectionHeading>Related links</MarketingSectionHeading>
          <ul className="landing-doc-article__related-list">
            {relatedLinks.map((link, index) => (
              <li key={`${link.href}:${link.label}:${index}`}>
                <MarketingTextLink href={link.href} external={link.href.startsWith('http')}>
                  {link.label}
                </MarketingTextLink>
                {link.description ? (
                  <span className="landing-doc-article__related-desc" style={body14}>
                    {link.description}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <MarketingDocFeedback />
    </div>
  );
}

export function MarketingDocSection({
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="landing-doc-section">
      <MarketingSectionHeading>{title}</MarketingSectionHeading>
      {children}
    </section>
  );
}

export function MarketingDocToc({ items }: { items: readonly DocTocItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="landing-doc-toc" aria-label="Table of contents">
      <p className="landing-doc-toc__title" style={label14}>
        On this page
      </p>
      <ul className="landing-doc-toc__list">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="landing-doc-toc__link">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MarketingDocAudienceCards({
  cards
}: {
  cards: readonly { title: string; description: string; href: string }[];
}) {
  return (
    <div className="landing-doc-audience-grid">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="landing-doc-audience-card" data-border="true">
          <h3 style={label14}>{card.title}</h3>
          <p style={body14}>{card.description}</p>
        </Link>
      ))}
    </div>
  );
}
