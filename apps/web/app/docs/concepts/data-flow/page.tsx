import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { dataFlowConceptDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Data flow',
  description: dataFlowConceptDoc.lead,
  canonical: '/docs/concepts/data-flow',
  keywords: canonicalDocsKeywords
});

export default function DataFlowConceptPage() {
  return <MarketingStructuredDocPage doc={dataFlowConceptDoc} />;
}
