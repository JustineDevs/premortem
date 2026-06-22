import {
  MarketingDocArticle,
  MarketingDocCodeBlock,
  MarketingDocLayout,
  MarketingDocSection
} from '@/components/landing/blocks';
import { MarketingBulletList, MarketingParagraph } from '@/components/landing/marketing-content';
import { releasesDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Release notes',
  description: releasesDoc.lead,
  canonical: '/docs/releases',
  keywords: canonicalDocsKeywords
});

export default function ReleasesDocPage() {
  return (
    <MarketingDocLayout title={releasesDoc.title} description={releasesDoc.lead} toc={releasesDoc.toc}>
      <MarketingDocArticle lead={releasesDoc.lead} relatedLinks={releasesDoc.relatedLinks} toc={releasesDoc.toc}>
        <MarketingDocSection id="summary" title="Summary">
          <MarketingParagraph>{releasesDoc.summary}</MarketingParagraph>
        </MarketingDocSection>
        <MarketingDocSection id="included" title="Included">
          <MarketingBulletList items={releasesDoc.included} />
        </MarketingDocSection>
        <MarketingDocSection id="limits" title="Known limits">
          <MarketingBulletList items={releasesDoc.limits} />
        </MarketingDocSection>
        <MarketingDocSection id="upgrade" title="Upgrade notes">
          <MarketingBulletList items={releasesDoc.upgradeNotes} />
        </MarketingDocSection>
        <MarketingDocSection id="verify" title="Verification (2026-06-11)">
          <MarketingBulletList
            items={[
              'pnpm run smoke:production-readiness: public onboarding, publish flow, and Neo4j graph checks.',
              'pnpm run smoke:full-app-stress: marketing, docs, auth, billing guards, and audits.',
              'Stripe test catalog wired (Premortem Starter / Premortem Growth price IDs).'
            ]}
          />
          <MarketingDocCodeBlock
            title="Local verification"
            code={'pnpm run dev\npnpm run smoke:full-app-stress'}
          />
        </MarketingDocSection>
      </MarketingDocArticle>
    </MarketingDocLayout>
  );
}
