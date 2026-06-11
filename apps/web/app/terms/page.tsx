import {
  MarketingBulletList,
  MarketingParagraph,
  MarketingSectionHeading,
  MarketingTextLink
} from '@/components/landing/marketing-content';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { marketingLinks } from '@/lib/marketing-links';

export const metadata = {
  title: 'Terms | Premortem',
  description: 'Terms of service for Premortem.'
};

export default function TermsPage() {
  return (
    <MarketingPageLayout title="Terms of Service" description="Last updated: June 2026">
      <MarketingParagraph>
        By accessing or using Premortem, you agree to these terms. If you do not agree, do not use
        the service.
      </MarketingParagraph>
      <MarketingSectionHeading>Service description</MarketingSectionHeading>
      <MarketingParagraph>
        Premortem provides predictive repository audit tooling, structured issue synthesis, and
        reviewer workflows. Features may change as the product evolves.
      </MarketingParagraph>
      <MarketingSectionHeading>Acceptable use</MarketingSectionHeading>
      <MarketingBulletList
        items={[
          'Use Premortem only on repositories and accounts you are authorized to access.',
          'Do not attempt to disrupt, reverse engineer, or abuse the service or connected APIs.',
          'Review automated findings before treating them as production-ready decisions.'
        ]}
      />
      <MarketingSectionHeading>Integrations</MarketingSectionHeading>
      <MarketingParagraph>
        Third-party services (GitLab, cloud LLM providers, and others) are subject to their own
        terms. You are responsible for tokens, permissions, and billing with those providers.
      </MarketingParagraph>
      <MarketingSectionHeading>Disclaimer</MarketingSectionHeading>
      <MarketingParagraph>
        Premortem is provided &quot;as is&quot; without warranties. Audit output is assistive and
        requires human review. See the{' '}
        <MarketingTextLink href={marketingLinks.license} external>
          MIT License
        </MarketingTextLink>{' '}
        for software licensing terms.
      </MarketingParagraph>
      <MarketingSectionHeading>Contact</MarketingSectionHeading>
      <MarketingParagraph>
        For terms questions, contact{' '}
        <MarketingTextLink href={marketingLinks.contactEmail}>
          justinedevs@jstn.site
        </MarketingTextLink>
        . Read our <MarketingTextLink href={marketingLinks.privacy}>Privacy Policy</MarketingTextLink>.
      </MarketingParagraph>
    </MarketingPageLayout>
  );
}
