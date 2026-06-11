import {
  MarketingDocArticle,
  MarketingDocLayout,
  MarketingDocSection
} from '@/components/landing/blocks';
import { MarketingBulletList } from '@/components/landing/marketing-content';
import { architectureDoc } from '@/content/marketing/docs-index';

export const metadata = {
  title: 'Architecture overview | Premortem Docs',
  description: architectureDoc.lead
};

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
      </MarketingDocArticle>
    </MarketingDocLayout>
  );
}
