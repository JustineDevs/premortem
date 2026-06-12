import {
  MarketingBulletList,
  MarketingParagraph,
  MarketingSectionHeading,
  MarketingTextLink
} from '@/components/landing/marketing-content';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { marketingLinks } from '@/lib/marketing-links';
import { buildSeoMetadata, canonicalLegalKeywords } from '@/lib/seo-metadata';

export const metadata = buildSeoMetadata({
  title: 'Privacy | Premortem',
  description: 'Privacy policy for Premortem.',
  canonical: '/privacy',
  keywords: canonicalLegalKeywords
});

export default function PrivacyPage() {
  return (
    <MarketingPageLayout title="Privacy Policy" description="Last updated: June 2026">
      <MarketingParagraph>
        Premortem processes repository metadata, CI configuration, and code context needed to run
        predictive audits and generate structured findings. This policy describes what we collect
        and how it is used.
      </MarketingParagraph>
      <MarketingSectionHeading>Information we process</MarketingSectionHeading>
      <MarketingBulletList
        items={[
          'GitLab authorization tokens and project identifiers you connect.',
          'Repository files, pipeline data, and configuration needed for audit runs.',
          'Audit run outputs, findings, issue candidates, and reviewer actions.',
          'Basic service telemetry required to operate and secure the platform.'
        ]}
      />
      <MarketingSectionHeading>How we use information</MarketingSectionHeading>
      <MarketingBulletList
        items={[
          'Run audits, synthesize findings, and support publish/reconcile workflows.',
          'Improve reliability, security, and product quality.',
          'Respond to support requests and enforce our terms.'
        ]}
      />
      <MarketingSectionHeading>Sharing</MarketingSectionHeading>
      <MarketingParagraph>
        We do not sell personal data. Connected integrations (for example GitLab, Gemini, or cloud
        providers) receive only the data required to perform the actions you authorize.
      </MarketingParagraph>
      <MarketingSectionHeading>Your choices</MarketingSectionHeading>
      <MarketingParagraph>
        You can disconnect GitLab integrations and request deletion of associated audit data
        subject to operational retention requirements.
      </MarketingParagraph>
      <MarketingParagraph>
        Questions: contact{' '}
        <MarketingTextLink href={marketingLinks.contactEmail}>
          justinedevs@jstn.site
        </MarketingTextLink>
        . See also our <MarketingTextLink href={marketingLinks.terms}>Terms</MarketingTextLink>.
      </MarketingParagraph>
    </MarketingPageLayout>
  );
}
