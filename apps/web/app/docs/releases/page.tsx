import { MarketingDocLayout } from '@/components/landing/blocks';
import { MarketingBulletList, MarketingParagraph, MarketingSectionHeading, MarketingTextLink } from '@/components/landing/marketing-content';
import { releasesDoc } from '@/content/marketing/docs-index';
import { marketingLinks } from '@/lib/marketing-links';

export const metadata = {
  title: 'Release notes | Premortem Docs',
  description: 'Premortem v0.1.0 release notes and known limits.'
};

export default function ReleasesDocPage() {
  return (
    <MarketingDocLayout title={releasesDoc.title} description={releasesDoc.description}>
      <MarketingParagraph>{releasesDoc.summary}</MarketingParagraph>

      <MarketingSectionHeading>Included</MarketingSectionHeading>
      <MarketingBulletList items={releasesDoc.included} />

      <MarketingSectionHeading>Known limits</MarketingSectionHeading>
      <MarketingBulletList items={releasesDoc.limits} />

      <MarketingSectionHeading>Upgrade notes</MarketingSectionHeading>
      <MarketingBulletList items={releasesDoc.upgradeNotes} />

      <MarketingTextLink href={marketingLinks.releases} external>
        Read full release notes on GitHub
      </MarketingTextLink>
    </MarketingDocLayout>
  );
}
