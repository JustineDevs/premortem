import {
  MarketingDocAudienceCards,
  MarketingDocHub,
  MarketingDocLayout
} from '@/components/landing/blocks';
import { MarketingParagraph } from '@/components/landing/marketing-content';
import { docsHubCards, docsHubIntro } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Documentation | Premortem',
  description: docsHubIntro.lead
};

export default function DocsHubPage() {
  return (
    <MarketingDocLayout title="Documentation" description={docsHubIntro.lead}>
      <MarketingParagraph>{docsHubIntro.lead}</MarketingParagraph>
      <MarketingParagraph>
        Documentation is organized by intent: not by dashboard tabs. Pick a bucket below, or jump
        straight to your role.
      </MarketingParagraph>
      <MarketingDocAudienceCards cards={docsHubIntro.audiences} />
      <MarketingDocHub cards={docsHubIntro.diataxis} />
      <MarketingDocHub cards={docsHubCards} />
    </MarketingDocLayout>
  );
}
