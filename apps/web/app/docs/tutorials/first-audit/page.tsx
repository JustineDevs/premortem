import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { firstAuditTutorialDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Tutorial: first audit',
  description: firstAuditTutorialDoc.lead,
  canonical: '/docs/tutorials/first-audit',
  keywords: canonicalDocsKeywords
});

export default function FirstAuditTutorialPage() {
  return <MarketingStructuredDocPage doc={firstAuditTutorialDoc} />;
}
