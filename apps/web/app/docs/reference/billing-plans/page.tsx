import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { billingPlansReferenceDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Billing & plan limits',
  description: billingPlansReferenceDoc.lead,
  canonical: '/docs/reference/billing-plans',
  keywords: canonicalDocsKeywords
});

export default function BillingPlansDocPage() {
  return <MarketingStructuredDocPage doc={billingPlansReferenceDoc} />;
}
