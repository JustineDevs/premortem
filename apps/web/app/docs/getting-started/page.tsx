import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { gettingStartedDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Local setup | Premortem Docs',
  description: gettingStartedDoc.lead
};

export default function GettingStartedDocPage() {
  return <MarketingStructuredDocPage doc={gettingStartedDoc} />;
}
