import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { apiReferenceDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'API routes | Premortem Docs',
  description: apiReferenceDoc.lead,
  canonical: '/docs/reference/api',
  keywords: canonicalDocsKeywords
});

export default function ApiReferencePage() {
  return <MarketingStructuredDocPage doc={apiReferenceDoc} />;
}
