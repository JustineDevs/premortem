import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { environmentReferenceDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Environment variables | Premortem Docs',
  description: environmentReferenceDoc.lead
};

export default function EnvironmentReferencePage() {
  return <MarketingStructuredDocPage doc={environmentReferenceDoc} />;
}
