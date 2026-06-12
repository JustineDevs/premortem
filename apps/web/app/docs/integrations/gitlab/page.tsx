import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { gitlabIntegrationDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'GitLab integration | Premortem Docs',
  description: gitlabIntegrationDoc.lead,
  canonical: '/docs/integrations/gitlab',
  keywords: canonicalDocsKeywords
});

export default function GitlabIntegrationDocPage() {
  return <MarketingStructuredDocPage doc={gitlabIntegrationDoc} />;
}
