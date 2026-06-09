import type { ReactNode } from 'react';

import { LandingShell } from './landing-shell';
import { mainPanelBorder } from './landing-panel-border';
import { MarketingPageBody, MarketingPageHeader } from './marketing-content';

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
  const panelClass =
    variant === 'solutions'
      ? 'framer-1vn47iw landing-route-panel landing-route-panel--solutions'
      : variant === 'auth'
        ? 'framer-1vn47iw landing-route-panel landing-route-panel--auth'
        : 'framer-1vn47iw landing-route-panel';

  return (
    <LandingShell>
      <div className={panelClass} data-border="true" style={mainPanelBorder}>
        {variant !== 'auth' && title ? (
          <MarketingPageHeader title={title} description={description} />
        ) : null}
        <MarketingPageBody>{children}</MarketingPageBody>
      </div>
    </LandingShell>
  );
}
