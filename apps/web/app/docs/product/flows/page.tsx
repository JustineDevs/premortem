import { MarketingDocLayout } from '@/components/landing/blocks';
import { MarketingBulletList } from '@/components/landing/marketing-content';
import { productFlowsDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Product flows | Premortem Docs',
  description: 'Onboarding, review, publish, and traceability flows.'
};

export default function ProductFlowsDocPage() {
  return (
    <MarketingDocLayout title={productFlowsDoc.title} description={productFlowsDoc.description}>
      <MarketingBulletList items={productFlowsDoc.bullets} />
    </MarketingDocLayout>
  );
}
