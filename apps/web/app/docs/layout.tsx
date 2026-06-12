import type { Metadata } from 'next';

import { MarketingDocsRouteLayout } from '@/components/landing/blocks/marketing-docs-route-layout';

export const metadata: Metadata = {
  title: {
    template: '%s | Premortem Docs',
    default: 'Documentation | Premortem Docs'
  }
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <MarketingDocsRouteLayout>{children}</MarketingDocsRouteLayout>;
}
