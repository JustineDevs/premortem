import {
  MarketingDocAudienceCards,
  MarketingDocHub,
  MarketingStructuredDocPage
} from '@/components/landing/blocks';
import { MarketingParagraph } from '@/components/landing/marketing-content';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { docsHubCards, docsHubIntro } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Documentation | Premortem',
  description: docsHubIntro.lead
};

export default function DocsHubPage() {
  return (
    <MarketingPageLayout title="Documentation" description={docsHubIntro.lead}>
      <MarketingParagraph>
        Documentation is organized by intent: not by dashboard tabs. Pick a bucket below, or jump
        straight to your role.
      </MarketingParagraph>
      <MarketingDocAudienceCards cards={docsHubIntro.audiences} />
      <MarketingDocHub cards={docsHubIntro.diataxis} />
      <MarketingDocHub cards={docsHubCards} />
    </MarketingPageLayout>
  );
}
