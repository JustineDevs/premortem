import { MarketingDocLayout } from '@/components/landing/blocks';
import { MarketingParagraph, MarketingSectionHeading, MarketingTextLink } from '@/components/landing/marketing-content';
import { gitlabIntegrationDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'GitLab integration | Premortem Docs',
  description: 'Connect GitLab for repository context, CI data, and issue publishing.'
};

export default function GitlabIntegrationDocPage() {
  return (
    <MarketingDocLayout title={gitlabIntegrationDoc.title} description={gitlabIntegrationDoc.description}>
      {gitlabIntegrationDoc.sections.map((section) => (
        <div key={section.heading}>
          <MarketingSectionHeading>{section.heading}</MarketingSectionHeading>
          <MarketingParagraph>{section.body}</MarketingParagraph>
          {'externalHref' in section && section.externalHref ? (
            <MarketingTextLink href={section.externalHref} external>
              Official GitLab MCP documentation
            </MarketingTextLink>
          ) : null}
        </div>
      ))}
    </MarketingDocLayout>
  );
}
