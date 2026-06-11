import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { apiReferenceDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'API routes | Premortem Docs',
  description: apiReferenceDoc.lead
};

export default function ApiReferencePage() {
  return <MarketingStructuredDocPage doc={apiReferenceDoc} />;
}
