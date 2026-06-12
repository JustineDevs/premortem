import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { billingPlansReferenceDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Billing & plan limits | Premortem Docs',
  description: billingPlansReferenceDoc.lead
};

export default function BillingPlansDocPage() {
  return <MarketingStructuredDocPage doc={billingPlansReferenceDoc} />;
}
