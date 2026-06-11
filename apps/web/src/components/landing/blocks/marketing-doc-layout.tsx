import type { ReactNode } from 'react';

import { docsNavSections } from '@/content/marketing/docs-index';
import { marketingLinks } from '@/lib/marketing-links';

import { MarketingDocToc, type DocTocItem } from './marketing-doc-article';
import { DocsNavLink } from '../nav-link-button';
import { body14, label14 } from '../text-styles';
import { LandingShell } from '../landing-shell';
import { mainPanelBorder } from '../landing-panel-border';
import { MarketingPageBody, MarketingPageHeader } from '../marketing-content';

type MarketingDocLayoutProps = {
  title: string;
  description?: string;
  toc?: readonly DocTocItem[];
  children: ReactNode;
};

export function MarketingDocLayout({ title, description, toc = [], children }: MarketingDocLayoutProps) {
  return (
    <LandingShell>
      <div className="framer-1vn47iw landing-route-panel landing-doc-panel" data-border="true" style={mainPanelBorder}>
        <div className="landing-doc-layout">
          <MarketingDocNav />
          <div className="landing-doc-main">
            <MarketingPageHeader title={title} description={description} />
            <div className="landing-doc-content-row">
              <MarketingPageBody>{children}</MarketingPageBody>
              <MarketingDocToc items={toc} />
            </div>
          </div>
        </div>
      </div>
    </LandingShell>
  );
}

function MarketingDocNav() {
  return (
    <nav className="landing-doc-nav" aria-label="Documentation">
      {docsNavSections.map((section) => (
        <details key={section.title} className="landing-doc-nav__section" open>
          <summary className="landing-doc-nav__section-title" style={label14}>
            {section.title}
          </summary>
          <ul className="landing-doc-nav__list">
            {section.items.map((item) => (
              <li key={item.href}>
                <DocsNavLink href={item.href} matchPrefix={item.href !== marketingLinks.docs}>
                  <span className="landing-doc-nav__label">{item.label}</span>
                  {item.description ? (
                    <span className="landing-doc-nav__desc" style={body14}>
                      {item.description}
                    </span>
                  ) : null}
                </DocsNavLink>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </nav>
  );
}
