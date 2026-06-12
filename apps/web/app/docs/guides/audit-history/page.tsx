import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { auditHistoryGuideDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Audit history | Premortem Docs',
  description: auditHistoryGuideDoc.lead
};

export default function AuditHistoryDocPage() {
  return <MarketingStructuredDocPage doc={auditHistoryGuideDoc} />;
}
