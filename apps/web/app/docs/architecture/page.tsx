import { MarketingDocLayout } from '@/components/landing/blocks';
import { MarketingBulletList, MarketingSectionHeading } from '@/components/landing/marketing-content';
import { architectureDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Architecture | Premortem Docs',
  description: 'Core stack and supporting services for Premortem.'
};

export default function ArchitectureDocPage() {
  return (
    <MarketingDocLayout title={architectureDoc.title} description={architectureDoc.description}>
      <MarketingSectionHeading>Core stack</MarketingSectionHeading>
      <MarketingBulletList items={architectureDoc.coreStack} />

      <MarketingSectionHeading>Supporting services (next)</MarketingSectionHeading>
      <MarketingBulletList items={architectureDoc.supportingNext} />
    </MarketingDocLayout>
  );
}
