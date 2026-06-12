import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { connectGitlabGuideDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Connect GitLab | Premortem Docs',
  description: connectGitlabGuideDoc.lead,
  canonical: '/docs/guides/connect-gitlab',
  keywords: canonicalDocsKeywords
});

export default function ConnectGitlabGuidePage() {
  return <MarketingStructuredDocPage doc={connectGitlabGuideDoc} />;
}
