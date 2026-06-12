import {
  MarketingDocArticle,
  MarketingDocGithubSource,
  MarketingDocLayout,
  MarketingDocSection
} from '@/components/landing/blocks';
import { MarketingBulletList } from '@/components/landing/marketing-content';
import { architectureDoc } from '@/content/marketing/docs-index';

import { buildSeoMetadata, canonicalDocsKeywords } from '@/lib/seo-metadata';
export const metadata = buildSeoMetadata({
  title: 'Architecture overview | Premortem Docs',
  description: architectureDoc.lead,
  canonical: '/docs/architecture',
  keywords: canonicalDocsKeywords
});

export default function ArchitectureDocPage() {
  return (
    <MarketingDocLayout
      title={architectureDoc.title}
      description={architectureDoc.lead}
      toc={architectureDoc.toc}
    >
      <MarketingDocArticle
        lead={architectureDoc.lead}
        audience={architectureDoc.audience}
        relatedLinks={architectureDoc.relatedLinks}
        toc={architectureDoc.toc}
      >
        <MarketingDocSection id="core" title="Core stack">
          <MarketingBulletList items={architectureDoc.coreStack} />
        </MarketingDocSection>
        <MarketingDocSection id="supporting" title="Supporting services (next)">
          <MarketingBulletList items={architectureDoc.supportingNext} />
        </MarketingDocSection>
        {architectureDoc.sections?.map((section) => (
          <MarketingDocSection key={section.id} id={section.id} title={section.heading}>
            {section.bullets ? <MarketingBulletList items={section.bullets} /> : null}
          </MarketingDocSection>
        ))}
        {architectureDoc.githubSource ? (
          <MarketingDocGithubSource href={architectureDoc.githubSource} />
        ) : null}
      </MarketingDocArticle>
    </MarketingDocLayout>
  );
}
