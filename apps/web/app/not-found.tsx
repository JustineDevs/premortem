import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';
import { marketingLinks } from '@/lib/marketing-links';
import { buildSeoMetadata } from '@/lib/seo-metadata';
import { body14, label14, sectionTitle } from '@/components/landing/text-styles';

export const metadata: Metadata = buildSeoMetadata({
  title: 'Page not found | Premortem',
  description: 'The requested Premortem page could not be found.',
  canonical: '/404',
  noIndex: true,
  includeCanonicalSiteKeywords: false
});

const recoveryActions = [
  {
    href: marketingLinks.home,
    title: 'Go home',
    copy: 'Return to the Premortem landing page.'
  },
  {
    href: marketingLinks.docs,
    title: 'Read docs',
    copy: 'Open the docs hub and find the right route.'
  },
  {
    href: authLinks.login,
    title: 'Log in',
    copy: 'Continue in the workspace if you already have access.'
  }
] as const;

export default function NotFound() {
  return (
    <MarketingPageLayout variant="auth">
      <div className="landing-not-found-shell">
        <div className="landing-auth-card landing-not-found-card" data-border="true">
          <div className="landing-not-found__grid">
            <header className="landing-not-found__header">
              <div className="landing-not-found__meta">
                <span className="landing-not-found__badge" style={label14}>
                  404
                </span>
                <span className="landing-not-found__eyebrow" style={label14}>
                  Route unavailable
                </span>
              </div>
              <h1 className="landing-auth-card__title" style={sectionTitle}>
                This page could not be found
              </h1>
              <p className="landing-auth-card__lead" style={body14}>
                The link may be outdated, the page may have moved, or the route may never have
                existed.
              </p>

              <div className="landing-not-found__route-map" aria-hidden="true">
                <div className="landing-not-found__route-row">
                  <span className="landing-not-found__route-index">01</span>
                  <span className="landing-not-found__route-step">Landing</span>
                </div>
                <div className="landing-not-found__route-row">
                  <span className="landing-not-found__route-index">02</span>
                  <span className="landing-not-found__route-step">Docs</span>
                </div>
                <div className="landing-not-found__route-row">
                  <span className="landing-not-found__route-index">03</span>
                  <span className="landing-not-found__route-step">Workspace</span>
                </div>
              </div>
            </header>

            <section className="landing-not-found__panel" aria-label="Recovery options">
              <div className="landing-not-found__panel-head">
                <p className="landing-not-found__panel-title" style={label14}>
                  What you can do next
                </p>
                <p className="landing-not-found__panel-copy" style={body14}>
                  Choose the path that gets you back into the product fastest.
                </p>
              </div>

              <div className="landing-not-found__actions">
                {recoveryActions.map((action) => (
                  <Link key={action.href} href={action.href} className="landing-not-found__action">
                    <span className="landing-not-found__action-body">
                      <span className="landing-not-found__action-title" style={label14}>
                        {action.title}
                      </span>
                      <span className="landing-not-found__action-copy" style={body14}>
                        {action.copy}
                      </span>
                    </span>
                    <span className="landing-not-found__action-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <footer className="landing-not-found__footer">
            <p className="landing-not-found__footer-copy" style={body14}>
              If you were expecting a workspace or audit page, sign in and continue from /app.
            </p>
          </footer>
        </div>
      </div>
    </MarketingPageLayout>
  );
}
