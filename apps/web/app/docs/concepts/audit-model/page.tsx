import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { auditModelConceptDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Audit model | Premortem Docs',
  description: auditModelConceptDoc.lead,
  canonical: '/docs/concepts/audit-model',
  keywords: canonicalDocsKeywords
});

export default function AuditModelConceptPage() {
  return <MarketingStructuredDocPage doc={auditModelConceptDoc} />;
}
