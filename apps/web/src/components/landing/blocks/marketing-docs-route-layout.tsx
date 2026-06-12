import type { ReactNode } from 'react';

import { LandingShell } from '../landing-shell';
import { mainPanelBorder } from '../landing-panel-border';
import { MarketingDocSidebar } from './marketing-doc-sidebar';

type MarketingDocsRouteLayoutProps = {
  children: ReactNode;
};

/** Persistent docs shell: sidebar survives client navigations between /docs/* routes. */
export function MarketingDocsRouteLayout({ children }: MarketingDocsRouteLayoutProps) {
  return (
    <LandingShell>
      <div
        className="framer-1vn47iw landing-route-panel landing-doc-panel"
        data-border="true"
        style={mainPanelBorder}
      >
        <div className="landing-doc-layout">
          <MarketingDocSidebar />
          <div className="landing-doc-main">{children}</div>
        </div>
      </div>
    </LandingShell>
  );
}
