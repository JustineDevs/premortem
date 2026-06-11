import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { firstAuditTutorialDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Tutorial: first audit | Premortem Docs',
  description: firstAuditTutorialDoc.lead
};

export default function FirstAuditTutorialPage() {
  return <MarketingStructuredDocPage doc={firstAuditTutorialDoc} />;
}
