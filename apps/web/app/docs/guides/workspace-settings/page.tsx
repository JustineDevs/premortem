import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { workspaceSettingsGuideDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Workspace settings | Premortem Docs',
  description: workspaceSettingsGuideDoc.lead
};

export default function WorkspaceSettingsDocPage() {
  return <MarketingStructuredDocPage doc={workspaceSettingsGuideDoc} />;
}
