import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { publishGitlabTutorialDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Tutorial: publish to GitLab',
  description: publishGitlabTutorialDoc.lead,
  canonical: '/docs/tutorials/publish-gitlab-issue',
  keywords: canonicalDocsKeywords
});

export default function PublishGitlabTutorialPage() {
  return <MarketingStructuredDocPage doc={publishGitlabTutorialDoc} />;
}
