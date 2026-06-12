import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { neo4jGraphReferenceDoc } from '@/content/marketing/docs-additional-content';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Neo4j & graph store | Premortem Docs',
  description: neo4jGraphReferenceDoc.lead,
  canonical: '/docs/reference/neo4j-graph',
  keywords: canonicalDocsKeywords
});

export default function Neo4jGraphDocPage() {
  return <MarketingStructuredDocPage doc={neo4jGraphReferenceDoc} />;
}
