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
import {
  MarketingDocCallout,
  MarketingDocCodeBlock,
  MarketingDocGithubSource,
  MarketingDocScreenshot
} from './marketing-doc-primitives';
import type { StructuredDoc } from '@/content/marketing/docs-types';

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
        {doc.callouts?.map((callout, index) => (
          <MarketingDocCallout key={`doc-callout-${index}`} {...callout} />
        ))}

        {doc.screenshot ? <MarketingDocScreenshot {...doc.screenshot} /> : null}

        {doc.codeBlocks?.map((block, index) => (
          <MarketingDocCodeBlock key={block.id ?? `doc-code-${index}`} {...block} />
        ))}

        {doc.sections?.map((section) => (
          <MarketingDocSection key={section.id} id={section.id} title={section.heading}>
            {section.bullets ? <MarketingBulletList items={section.bullets} /> : null}
            {section.body ? <MarketingParagraph>{section.body}</MarketingParagraph> : null}
            {section.callouts?.map((callout, index) => (
              <MarketingDocCallout key={`${section.id}-callout-${index}`} {...callout} />
            ))}
            {section.screenshot ? <MarketingDocScreenshot {...section.screenshot} /> : null}
            {section.codeBlocks?.map((block, index) => (
              <MarketingDocCodeBlock key={block.id ?? `${section.id}-code-${index}`} {...block} />
            ))}
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

        {doc.githubSource ? <MarketingDocGithubSource href={doc.githubSource} /> : null}
      </MarketingDocArticle>
    </MarketingDocLayout>
  );
}
