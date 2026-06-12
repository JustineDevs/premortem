import {
  MarketingAutoplayDemo,
  MarketingAudioPlayer,
  MarketingCallout,
  MarketingLinkGrid,
  MarketingScreenshot,
  MarketingStepDetails,
  MarketingStepGrid
} from '@/components/landing/blocks';
import { MarketingSectionHeading } from '@/components/landing/marketing-content';
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
      <MarketingSectionHeading>Interactive demo</MarketingSectionHeading>
      <MarketingAutoplayDemo variant="how-it-works" />

      <MarketingSectionHeading>Listen</MarketingSectionHeading>
      <MarketingAudioPlayer
        src={howItWorksPage.audioBrief.src}
        title={howItWorksPage.audioBrief.title}
        description={howItWorksPage.audioBrief.description}
        durationLabel={howItWorksPage.audioBrief.durationLabel}
      />

      <MarketingSectionHeading>Three steps</MarketingSectionHeading>
      <MarketingStepGrid />

      <MarketingScreenshot
        src={howItWorksPage.screenshot.src}
        alt={howItWorksPage.screenshot.alt}
        crop="console"
        caption="Workflow panel from the landing page: same audit path powers /app."
      />

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
