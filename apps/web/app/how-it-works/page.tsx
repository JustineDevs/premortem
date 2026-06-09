import {
  MarketingCallout,
  MarketingLinkGrid,
  MarketingStepDetails,
  MarketingStepGrid
} from '@/components/landing/blocks';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { howItWorksPage } from '@/content/marketing/how-it-works';
import { marketingLinks } from '@/lib/marketing-links';

export const metadata = {
  title: 'How it works | Premortem',
  description: 'Connect GitLab, run a multi-lens Premortem audit, and review structured findings.'
};

export default function HowItWorksPage() {
  return (
    <MarketingPageLayout title={howItWorksPage.title} description={howItWorksPage.description}>
      <MarketingStepGrid />

      <MarketingStepDetails steps={howItWorksPage.stepDetails} />

      <MarketingCallout
        title={howItWorksPage.developerCallout.title}
        body={howItWorksPage.developerCallout.body}
        href={howItWorksPage.developerCallout.href}
        hrefLabel="Read getting started guide"
      />

      <MarketingLinkGrid
        items={[
          { href: marketingLinks.home, label: 'Landing page' },
          { href: marketingLinks.docsIntegrationsGitlab, label: 'GitLab integration' },
          { href: '/app', label: 'Open reviewer console' }
        ]}
      />
    </MarketingPageLayout>
  );
}
