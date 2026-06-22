import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { productFlowsDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Product flows',
  description: productFlowsDoc.lead,
  canonical: '/docs/product/flows',
  keywords: canonicalDocsKeywords
});

export default function ProductFlowsDocPage() {
  return <MarketingStructuredDocPage doc={productFlowsDoc} />;
}
