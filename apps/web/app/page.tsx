export const dynamic = 'force-dynamic';

import { LandingPage } from '@/components/landing/landing-page';
import { buildSeoMetadata, canonicalLandingKeywords } from '@/lib/seo-metadata';

export const metadata = buildSeoMetadata({
  title: 'Premortem | Predictive repository audits for GitLab teams',
  description:
    'Predictive repository audits, swarm analysis, and GitLab issue synthesis for software delivery risk.',
  canonical: '/',
  keywords: canonicalLandingKeywords
});

export default function MarketingLandingPage() {
  return <LandingPage />;
}
