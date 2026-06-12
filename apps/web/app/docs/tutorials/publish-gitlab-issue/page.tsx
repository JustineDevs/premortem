import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { publishGitlabTutorialDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Tutorial: publish to GitLab | Premortem Docs',
  description: publishGitlabTutorialDoc.lead
};

export default function PublishGitlabTutorialPage() {
  return <MarketingStructuredDocPage doc={publishGitlabTutorialDoc} />;
}
