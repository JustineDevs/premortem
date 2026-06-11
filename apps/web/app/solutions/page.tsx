import {
  MarketingCallout,
  MarketingEcosystemStrip,
  MarketingFeatureList,
  MarketingLinkGrid,
  MarketingPersonaCards,
  MarketingScreenshot
} from '@/components/landing/blocks';
import { MarketingSectionHeading } from '@/components/landing/marketing-content';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { solutionsPage } from '@/content/marketing/solutions';
import { premortemFeatures } from '@/content/marketing/shared';
import { howItWorksPage } from '@/content/marketing/how-it-works';
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
              <MarketingFeatureList items={premortemFeatures} />
            </div>
            <div className="landing-solutions-mid__col">
              <MarketingSectionHeading>Console preview</MarketingSectionHeading>
              <MarketingScreenshot
                src={howItWorksPage.screenshot.src}
                alt={howItWorksPage.screenshot.alt}
                crop="preview"
                caption="Reviewer console: approve structured findings before GitLab sync."
              />
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
