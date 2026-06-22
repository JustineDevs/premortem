import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { aiPlaygroundGuideDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Code analysis',
  description: aiPlaygroundGuideDoc.lead,
  canonical: '/docs/guides/ai-playground',
  keywords: canonicalDocsKeywords
});

export default function AiPlaygroundDocPage() {
  return <MarketingStructuredDocPage doc={aiPlaygroundGuideDoc} />;
}
