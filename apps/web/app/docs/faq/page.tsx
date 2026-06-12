import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { faqDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'FAQ | Premortem',
  description: faqDoc.lead
};

export default function FaqPage() {
  return <MarketingStructuredDocPage doc={faqDoc} />;
}
