import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { reviewPublishGuideDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Review & publish',
  description: reviewPublishGuideDoc.lead,
  canonical: '/docs/guides/review-and-publish',
  keywords: canonicalDocsKeywords
});

export default function ReviewPublishGuidePage() {
  return <MarketingStructuredDocPage doc={reviewPublishGuideDoc} />;
}
