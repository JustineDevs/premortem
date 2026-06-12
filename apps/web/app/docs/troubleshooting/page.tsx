import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { troubleshootingDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Troubleshooting | Premortem Docs',
  description: troubleshootingDoc.lead,
  canonical: '/docs/troubleshooting',
  keywords: canonicalDocsKeywords
});

export default function TroubleshootingPage() {
  return <MarketingStructuredDocPage doc={troubleshootingDoc} />;
}
