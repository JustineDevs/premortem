import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { authSessionsGuideDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Auth & sessions | Premortem Docs',
  description: authSessionsGuideDoc.lead,
  canonical: '/docs/guides/auth-sessions',
  keywords: canonicalDocsKeywords
});

export default function AuthSessionsDocPage() {
  return <MarketingStructuredDocPage doc={authSessionsGuideDoc} />;
}
