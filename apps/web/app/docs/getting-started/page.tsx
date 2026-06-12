import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { gettingStartedDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Local setup | Premortem Docs',
  description: gettingStartedDoc.lead,
  canonical: '/docs/getting-started',
  keywords: canonicalDocsKeywords
});

export default function GettingStartedDocPage() {
  return <MarketingStructuredDocPage doc={gettingStartedDoc} />;
}
