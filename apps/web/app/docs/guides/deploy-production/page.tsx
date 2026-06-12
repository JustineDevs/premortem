import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { deployProductionGuideDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Deploy to production | Premortem Docs',
  description: deployProductionGuideDoc.lead,
  canonical: '/docs/guides/deploy-production',
  keywords: canonicalDocsKeywords
});

export default function DeployProductionDocPage() {
  return <MarketingStructuredDocPage doc={deployProductionGuideDoc} />;
}
