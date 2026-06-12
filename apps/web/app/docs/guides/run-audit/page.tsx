import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { runAuditGuideDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Run an audit | Premortem Docs',
  description: runAuditGuideDoc.lead,
  canonical: '/docs/guides/run-audit',
  keywords: canonicalDocsKeywords
});

export default function RunAuditGuidePage() {
  return <MarketingStructuredDocPage doc={runAuditGuideDoc} />;
}
