import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { workspaceSettingsGuideDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Workspace settings',
  description: workspaceSettingsGuideDoc.lead,
  canonical: '/docs/guides/workspace-settings',
  keywords: canonicalDocsKeywords
});

export default function WorkspaceSettingsDocPage() {
  return <MarketingStructuredDocPage doc={workspaceSettingsGuideDoc} />;
}
