import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { workflowCanvasGuideDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Workflow Canvas | Premortem Docs',
  description: workflowCanvasGuideDoc.lead
};

export default function WorkflowCanvasDocPage() {
  return <MarketingStructuredDocPage doc={workflowCanvasGuideDoc} />;
}
