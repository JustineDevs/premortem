import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { connectGitlabGuideDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Connect GitLab | Premortem Docs',
  description: connectGitlabGuideDoc.lead
};

export default function ConnectGitlabGuidePage() {
  return <MarketingStructuredDocPage doc={connectGitlabGuideDoc} />;
}
