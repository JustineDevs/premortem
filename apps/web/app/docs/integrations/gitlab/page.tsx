import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { gitlabIntegrationDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'GitLab integration | Premortem Docs',
  description: gitlabIntegrationDoc.lead
};

export default function GitlabIntegrationDocPage() {
  return <MarketingStructuredDocPage doc={gitlabIntegrationDoc} />;
}
