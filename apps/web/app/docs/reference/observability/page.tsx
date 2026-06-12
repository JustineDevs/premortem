import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { observabilityReferenceDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Observability | Premortem Docs',
  description: observabilityReferenceDoc.lead,
  canonical: '/docs/reference/observability',
  keywords: canonicalDocsKeywords
});

export default function ObservabilityDocPage() {
  return <MarketingStructuredDocPage doc={observabilityReferenceDoc} />;
}
