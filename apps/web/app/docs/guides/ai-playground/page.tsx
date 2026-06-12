import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { aiPlaygroundGuideDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'AI Code Playground | Premortem Docs',
  description: aiPlaygroundGuideDoc.lead
};

export default function AiPlaygroundDocPage() {
  return <MarketingStructuredDocPage doc={aiPlaygroundGuideDoc} />;
}
