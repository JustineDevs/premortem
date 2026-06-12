import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { auditHistoryGuideDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Audit history | Premortem Docs',
  description: auditHistoryGuideDoc.lead,
  canonical: '/docs/guides/audit-history',
  keywords: canonicalDocsKeywords
});

export default function AuditHistoryDocPage() {
  return <MarketingStructuredDocPage doc={auditHistoryGuideDoc} />;
}
