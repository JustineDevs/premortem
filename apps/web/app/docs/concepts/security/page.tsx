import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { securityConceptDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Security & trust boundaries | Premortem Docs',
  description: securityConceptDoc.lead,
  canonical: '/docs/concepts/security',
  keywords: canonicalDocsKeywords
});

export default function SecurityConceptDocPage() {
  return <MarketingStructuredDocPage doc={securityConceptDoc} />;
}
