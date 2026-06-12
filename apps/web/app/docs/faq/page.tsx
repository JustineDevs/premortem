import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { faqDoc } from '@/content/marketing/docs-index';
import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';

export const metadata = buildSeoMetadata({
  title: 'FAQ | Premortem',
  description: faqDoc.lead,
  canonical: '/docs/faq',
  keywords: canonicalDocsKeywords
});

export default function FaqPage() {
  return <MarketingStructuredDocPage doc={faqDoc} />;
}
