import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { enterpriseReadinessDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';

export const metadata = buildSeoMetadata({
  title: 'Enterprise readiness | Premortem',
  description: enterpriseReadinessDoc.lead,
  canonical: '/docs/architecture/enterprise-readiness',
  keywords: canonicalDocsKeywords
});

export default function EnterpriseReadinessDocPage() {
  return <MarketingStructuredDocPage doc={enterpriseReadinessDoc} />;
}
