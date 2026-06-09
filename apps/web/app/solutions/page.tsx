import {
  MarketingCallout,
  MarketingEcosystemStrip,
  MarketingLinkGrid,
  MarketingPersonaCards,
  MarketingStepGrid
} from '@/components/landing/blocks';
import { MarketingSectionHeading } from '@/components/landing/marketing-content';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { solutionsPage } from '@/content/marketing/solutions';
import { marketingLinks } from '@/lib/marketing-links';

export const metadata = {
  title: 'Solutions | Premortem',
  description: 'How teams use Premortem for predictive audits and structured issue delivery.'
};

export default function SolutionsPage() {
  return (
    <MarketingPageLayout
      variant="solutions"
      title={solutionsPage.title}
      description={solutionsPage.description}
    >
      <div className="landing-solutions-layout">
        <section className="landing-solutions-personas">
          <MarketingSectionHeading>Who it&apos;s for</MarketingSectionHeading>
          <MarketingPersonaCards personas={solutionsPage.personas} />
        </section>

        <div className="landing-solutions-main">
          <div className="landing-solutions-mid">
            <div className="landing-solutions-mid__col">
              <MarketingSectionHeading>Workflow</MarketingSectionHeading>
              <MarketingCallout title="Audit → Review → Publish" body={solutionsPage.workflowSummary} />
            </div>
            <div className="landing-solutions-mid__col">
              <MarketingSectionHeading>Three-step flow</MarketingSectionHeading>
              <MarketingStepGrid />
            </div>
          </div>

          <div className="landing-solutions-ecosystem">
            <MarketingSectionHeading>Ecosystem</MarketingSectionHeading>
            <MarketingEcosystemStrip />
          </div>
        </div>

        <section className="landing-solutions-bottom">
          <MarketingLinkGrid
            items={[
              { href: marketingLinks.products, label: 'Products' },
              { href: marketingLinks.howItWorks, label: 'How it works' },
              { href: marketingLinks.docsGettingStarted, label: 'Getting started' },
              { href: '/app', label: 'Reviewer console' }
            ]}
          />
        </section>
      </div>
    </MarketingPageLayout>
  );
}
