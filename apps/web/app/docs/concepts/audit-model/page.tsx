import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { auditModelConceptDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Audit model | Premortem Docs',
  description: auditModelConceptDoc.lead
};

export default function AuditModelConceptPage() {
  return <MarketingStructuredDocPage doc={auditModelConceptDoc} />;
}
