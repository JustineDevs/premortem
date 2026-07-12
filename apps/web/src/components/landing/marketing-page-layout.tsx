import type { ReactNode } from 'react';

import { LandingShell } from './landing-shell';
import { MarketingPageFrame } from './marketing-page-frame';

type MarketingPageLayoutProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'solutions' | 'auth';
  children: ReactNode;
};

export function MarketingPageLayout({
  title,
  description,
  variant = 'default',
  children
}: MarketingPageLayoutProps) {
  return (
    <LandingShell>
      <MarketingPageFrame title={title} description={description} variant={variant}>
        {children}
      </MarketingPageFrame>
    </LandingShell>
  );
}
