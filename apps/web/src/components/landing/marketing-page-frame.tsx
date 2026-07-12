import type { ReactNode } from 'react';

import { mainPanelBorder } from './landing-panel-border';
import { MarketingPageBody, MarketingPageHeader } from './marketing-content';

type MarketingPageFrameProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'solutions' | 'auth' | 'docs';
  children: ReactNode;
};

export function MarketingPageFrame({
  title,
  description,
  variant = 'default',
  children
}: MarketingPageFrameProps) {
  const panelClass =
    variant === 'solutions'
      ? 'framer-1vn47iw landing-route-panel landing-route-panel--solutions'
      : variant === 'auth'
        ? 'framer-1vn47iw landing-route-panel landing-route-panel--auth'
        : variant === 'docs'
          ? 'framer-1vn47iw landing-route-panel landing-doc-panel'
          : 'framer-1vn47iw landing-route-panel';

  return (
    <div className={panelClass} data-border="true" style={mainPanelBorder}>
      {variant !== 'auth' && title ? <MarketingPageHeader title={title} description={description} /> : null}
      <MarketingPageBody>{children}</MarketingPageBody>
    </div>
  );
}
