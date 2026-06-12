import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { deployProductionGuideDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Deploy to production | Premortem Docs',
  description: deployProductionGuideDoc.lead
};

export default function DeployProductionDocPage() {
  return <MarketingStructuredDocPage doc={deployProductionGuideDoc} />;
}
