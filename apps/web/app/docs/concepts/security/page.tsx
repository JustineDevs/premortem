import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { securityConceptDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Security & trust boundaries | Premortem Docs',
  description: securityConceptDoc.lead
};

export default function SecurityConceptDocPage() {
  return <MarketingStructuredDocPage doc={securityConceptDoc} />;
}
