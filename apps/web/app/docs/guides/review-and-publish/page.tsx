import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { reviewPublishGuideDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Review & publish | Premortem Docs',
  description: reviewPublishGuideDoc.lead
};

export default function ReviewPublishGuidePage() {
  return <MarketingStructuredDocPage doc={reviewPublishGuideDoc} />;
}
