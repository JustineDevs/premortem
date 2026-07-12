import type { ReactNode } from 'react';

import { LandingShell } from '../landing-shell';
import { MarketingPageFrame } from '../marketing-page-frame';
import { MarketingDocSidebar } from './marketing-doc-sidebar';

type MarketingDocsRouteLayoutProps = {
  children: ReactNode;
};

/** Persistent docs shell: sidebar survives client navigations between /docs/* routes. */
export function MarketingDocsRouteLayout({ children }: MarketingDocsRouteLayoutProps) {
  return (
    <LandingShell>
      <MarketingPageFrame variant="docs">
        <div className="landing-doc-layout">
          <MarketingDocSidebar />
          <div className="landing-doc-main">{children}</div>
        </div>
      </MarketingPageFrame>
    </LandingShell>
  );
}
