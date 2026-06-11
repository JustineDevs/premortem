import {
  MarketingDocArticle,
  MarketingDocLayout,
  MarketingDocSection
} from '@/components/landing/blocks';
import { MarketingBulletList, MarketingParagraph } from '@/components/landing/marketing-content';
import { releasesDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Release notes | Premortem Docs',
  description: releasesDoc.lead
};

export default function ReleasesDocPage() {
  return (
    <MarketingDocLayout title={releasesDoc.title} description={releasesDoc.lead} toc={releasesDoc.toc}>
      <MarketingDocArticle lead={releasesDoc.lead} relatedLinks={releasesDoc.relatedLinks} toc={releasesDoc.toc}>
        <MarketingDocSection id="summary" title="Summary">
          <MarketingParagraph>{releasesDoc.summary}</MarketingParagraph>
        </MarketingDocSection>
        <MarketingDocSection id="included" title="Included">
          <MarketingBulletList items={releasesDoc.included} />
        </MarketingDocSection>
        <MarketingDocSection id="limits" title="Known limits">
          <MarketingBulletList items={releasesDoc.limits} />
        </MarketingDocSection>
        <MarketingDocSection id="upgrade" title="Upgrade notes">
          <MarketingBulletList items={releasesDoc.upgradeNotes} />
        </MarketingDocSection>
      </MarketingDocArticle>
    </MarketingDocLayout>
  );
}
