import type { ReactNode } from 'react';

import { MarketingDocToc, type DocTocItem } from './marketing-doc-article';
import { MarketingPageBody, MarketingPageHeader } from '../marketing-content';

type MarketingDocLayoutProps = {
  title: string;
  description?: string;
  toc?: readonly DocTocItem[];
  children: ReactNode;
};

/** Main doc column only; shell and sidebar live in app/docs/layout.tsx. */
export function MarketingDocLayout({ title, description, toc = [], children }: MarketingDocLayoutProps) {
  return (
    <>
      <MarketingPageHeader title={title} description={description} />
      <div className="landing-doc-content-row">
        <MarketingPageBody>{children}</MarketingPageBody>
        <MarketingDocToc items={toc} />
      </div>
    </>
  );
}
