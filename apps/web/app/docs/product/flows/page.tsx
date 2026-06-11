import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { productFlowsDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Product flows | Premortem Docs',
  description: productFlowsDoc.lead
};

export default function ProductFlowsDocPage() {
  return <MarketingStructuredDocPage doc={productFlowsDoc} />;
}
