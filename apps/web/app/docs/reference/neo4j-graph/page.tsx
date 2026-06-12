import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { neo4jGraphReferenceDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Neo4j & graph store | Premortem Docs',
  description: neo4jGraphReferenceDoc.lead
};

export default function Neo4jGraphDocPage() {
  return <MarketingStructuredDocPage doc={neo4jGraphReferenceDoc} />;
}
