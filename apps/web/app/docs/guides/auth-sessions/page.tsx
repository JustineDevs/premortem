import { MarketingStructuredDocPage } from '@/components/landing/blocks';
import { authSessionsGuideDoc } from '@/content/marketing/docs-additional-content';

export const metadata = {
  title: 'Auth & sessions | Premortem Docs',
  description: authSessionsGuideDoc.lead
};

export default function AuthSessionsDocPage() {
  return <MarketingStructuredDocPage doc={authSessionsGuideDoc} />;
}
