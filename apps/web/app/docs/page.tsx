import { MarketingDocHub } from '@/components/landing/blocks';
import { MarketingParagraph } from '@/components/landing/marketing-content';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { docsHubCards } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Documentation | Premortem',
  description: 'Premortem documentation hub for setup, architecture, integrations, and releases.'
};

export default function DocsHubPage() {
  return (
    <MarketingPageLayout
      title="Documentation"
      description="Setup guides, product flows, architecture, GitLab integration, and release notes, aligned with the Premortem landing and product shell."
    >
      <MarketingParagraph>
        Start with getting started for local development, then explore product flows and architecture. External contributors can also read the repository README on GitHub.
      </MarketingParagraph>
      <MarketingDocHub cards={docsHubCards} />
    </MarketingPageLayout>
  );
}
