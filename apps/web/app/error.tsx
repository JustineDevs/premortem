'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';
import { marketingLinks } from '@/lib/marketing-links';
import { body14, sectionTitle } from '@/components/landing/text-styles';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <MarketingPageLayout variant="auth">
      <div className="landing-auth-shell">
        <div className="landing-auth-card" data-border="true">
          <header className="landing-auth-card__header">
            <h1 className="landing-auth-card__title" style={sectionTitle}>
              Something went wrong
            </h1>
            <p className="landing-auth-card__lead" style={body14}>
              The page hit an unexpected error. You can retry, or go back to a known route.
            </p>
          </header>

          <div className="landing-auth-form">
            <button type="button" className="landing-auth-submit" data-border="true" onClick={reset}>
              <span style={{ fontFamily: 'var(--font-inter), Inter, sans-serif', fontWeight: 500, letterSpacing: '0.16px', color: 'rgb(255, 255, 255)' }}>
                Retry
              </span>
            </button>
            <div className="landing-auth-card__footer-links">
              <Link href={marketingLinks.home} className="landing-route-link">
                Home
              </Link>
              <Link href={marketingLinks.docs} className="landing-route-link">
                Documentation
              </Link>
              <Link href={authLinks.login} className="landing-route-link">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MarketingPageLayout>
  );
}
