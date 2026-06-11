import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { dataFlowConceptDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Data flow | Premortem Docs',
  description: dataFlowConceptDoc.lead
};

export default function DataFlowConceptPage() {
  return <MarketingStructuredDocPage doc={dataFlowConceptDoc} />;
}
