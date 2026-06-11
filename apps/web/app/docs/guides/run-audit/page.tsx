import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { runAuditGuideDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Run an audit | Premortem Docs',
  description: runAuditGuideDoc.lead
};

export default function RunAuditGuidePage() {
  return <MarketingStructuredDocPage doc={runAuditGuideDoc} />;
}
