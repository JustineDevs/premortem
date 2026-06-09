import Link from 'next/link';

import { assets } from '../assets';
import { ecosystemCards } from '@/content/marketing/shared';
import { body14, learnMore } from '../text-styles';

const assetMap = {
  googleCloud: assets.googleCloud,
  gitlab: assets.gitlab,
  github: assets.github,
  geminiWordmark: assets.geminiWordmark,
  geminiIcon: assets.geminiIcon
} as const;

export function MarketingEcosystemStrip() {
  return (
    <div className="landing-block-ecosystem-strip" aria-label="Ecosystem integrations">
      {ecosystemCards.map((card) => (
        <article key={card.id} className="landing-block-ecosystem-strip__card" data-border="true">
          <div className="landing-block-ecosystem-strip__logo-row">
            {'icon' in card && card.icon ? (
              <img
                src={assetMap[card.icon]}
                alt=""
                width={26}
                height={26}
                aria-hidden
                className="landing-block-ecosystem-strip__icon"
              />
            ) : null}
            <img
              src={assetMap[card.logo]}
              alt={card.name}
              width={card.logoWidth}
              height={card.logoHeight}
              className="landing-block-ecosystem-strip__logo"
            />
          </div>
          <p style={body14}>{card.body}</p>
          <a
            href={card.href}
            style={learnMore}
            target="_blank"
            rel="noopener noreferrer"
            className="landing-block-ecosystem-strip__link"
          >
            {card.linkLabel}
          </a>
        </article>
      ))}
    </div>
  );
}

type LinkGridItem = {
  href: string;
  label: string;
  external?: boolean;
};

export function MarketingLinkGrid({ items }: { items: readonly LinkGridItem[] }) {
  return (
    <nav className="landing-block-link-grid" aria-label="Related pages">
      {items.map((item) =>
        item.external ? (
          <a
            key={item.href}
            href={item.href}
            className="landing-block-link-grid__item"
            data-border="true"
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.label}
          </a>
        ) : (
          <Link key={item.href} href={item.href} className="landing-block-link-grid__item" data-border="true">
            {item.label}
          </Link>
        )
      )}
    </nav>
  );
}

type DocHubCard = {
  href: string;
  title: string;
  description: string;
  tag: string;
};

export function MarketingDocHub({ cards }: { cards: readonly DocHubCard[] }) {
  return (
    <div className="landing-block-doc-hub">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="landing-block-doc-hub__card" data-border="true">
          <span className="landing-block-doc-hub__tag">{card.tag}</span>
          <h2 className="landing-block-doc-hub__title">{card.title}</h2>
          <p className="landing-block-doc-hub__description">{card.description}</p>
        </Link>
      ))}
    </div>
  );
}

export function MarketingFeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="landing-block-feature-list">
      {items.map((item) => (
        <li key={item} className="landing-block-feature-list__item">
          {item}
        </li>
      ))}
    </ul>
  );
}
