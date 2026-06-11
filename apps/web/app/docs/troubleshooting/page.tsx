import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { troubleshootingDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Troubleshooting | Premortem Docs',
  description: troubleshootingDoc.lead
};

export default function TroubleshootingPage() {
  return <MarketingStructuredDocPage doc={troubleshootingDoc} />;
}
