import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { observabilityReferenceDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Observability | Premortem Docs',
  description: observabilityReferenceDoc.lead
};

export default function ObservabilityDocPage() {
  return <MarketingStructuredDocPage doc={observabilityReferenceDoc} />;
}
