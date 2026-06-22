import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { workflowCanvasGuideDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Workflow Canvas',
  description: workflowCanvasGuideDoc.lead,
  canonical: '/docs/guides/workflow-canvas',
  keywords: canonicalDocsKeywords
});

export default function WorkflowCanvasDocPage() {
  return <MarketingStructuredDocPage doc={workflowCanvasGuideDoc} />;
}
