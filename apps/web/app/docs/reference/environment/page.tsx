import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { environmentReferenceDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Environment variables',
  description: environmentReferenceDoc.lead,
  canonical: '/docs/reference/environment',
  keywords: canonicalDocsKeywords
});

export default function EnvironmentReferencePage() {
  return <MarketingStructuredDocPage doc={environmentReferenceDoc} />;
}
