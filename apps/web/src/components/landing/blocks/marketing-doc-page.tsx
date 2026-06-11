import {
  MarketingBulletList,
  MarketingParagraph,
  MarketingTextLink
} from '../marketing-content';
import {
  MarketingDocArticle,
  MarketingDocSection,
  type DocTocItem
} from './marketing-doc-article';
import { MarketingDocLayout } from './marketing-doc-layout';
import type { StructuredDoc } from '@/content/marketing/docs-index';

export function MarketingStructuredDocPage({ doc }: { doc: StructuredDoc & { description?: string } }) {
  const toc = (doc.toc ?? []) as DocTocItem[];

  return (
    <MarketingDocLayout title={doc.title} description={doc.description ?? doc.lead} toc={toc}>
      <MarketingDocArticle
        lead={doc.lead}
        audience={doc.audience}
        prerequisites={doc.prerequisites}
        expectedResult={doc.expectedResult}
        relatedLinks={doc.relatedLinks}
        toc={toc}
      >
        {doc.sections?.map((section) => (
          <MarketingDocSection key={section.id} id={section.id} title={section.heading}>
            {section.bullets ? <MarketingBulletList items={section.bullets} /> : null}
            {section.body ? <MarketingParagraph>{section.body}</MarketingParagraph> : null}
            {section.externalHref ? (
              <p>
                <MarketingTextLink href={section.externalHref} external>
                  Official documentation
                </MarketingTextLink>
              </p>
            ) : null}
          </MarketingDocSection>
        ))}

        {doc.bullets ? <MarketingBulletList items={doc.bullets} /> : null}
      </MarketingDocArticle>
    </MarketingDocLayout>
  );
}
