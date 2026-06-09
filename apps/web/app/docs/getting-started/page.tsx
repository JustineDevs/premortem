import { MarketingDocLayout } from '@/components/landing/blocks';
import { MarketingBulletList, MarketingSectionHeading } from '@/components/landing/marketing-content';
import { gettingStartedDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Getting started | Premortem Docs',
  description: 'Install and run the Premortem local stack.'
};

export default function GettingStartedDocPage() {
  return (
    <MarketingDocLayout title={gettingStartedDoc.title} description={gettingStartedDoc.description}>
      {gettingStartedDoc.sections.map((section) => (
        <div key={section.heading}>
          <MarketingSectionHeading>{section.heading}</MarketingSectionHeading>
          <MarketingBulletList items={section.bullets} />
        </div>
      ))}
    </MarketingDocLayout>
  );
}
