import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingDocAudienceCards, MarketingDocHub, MarketingDocLayout, MarketingDocSearch } from '@/components/landing/blocks';
import { MarketingParagraph } from '@/components/landing/marketing-content';
import { label14, body14 } from '@/components/landing/text-styles';
import { docsHubCards } from '@/content/marketing/docs-index';
import { marketingLinks } from '@/lib/marketing-links';
import { buildSeoMetadata } from '@/lib/seo-metadata';

const recoveryCards = [
  {
    href: marketingLinks.docs,
    title: 'Open docs hub',
    description: 'Start from the docs index and choose tutorials, guides, or reference.',
    tag: 'Docs'
  },
  {
    href: marketingLinks.docsGettingStarted,
    title: 'Get started',
    description: 'Install the repo, configure env vars, and verify the stack locally.',
    tag: 'Tutorial'
  },
  {
    href: marketingLinks.docsTroubleshooting,
    title: 'Troubleshooting',
    description: 'Fix auth loops, missing env vars, and publish drift.',
    tag: 'Support'
  }
] as const;

export const metadata: Metadata = buildSeoMetadata({
  title: 'Documentation not found | Premortem',
  description: 'The docs route was not recognized. Search the docs or jump back to the hub.',
  canonical: '/docs/not-found',
  noIndex: true,
  includeCanonicalSiteKeywords: false
});

export default function DocsNotFoundPage() {
  return (
    <MarketingDocLayout
      title="Documentation route not found"
      description="The docs section only exposes published pages. Search below, or jump back to the hub and choose the right path."
    >
      <div className="landing-doc-article">
        <div className="landing-doc-article__meta">
          <span className="landing-doc-article__meta-label" style={body14}>
            Route unavailable
          </span>
          <p className="landing-doc-article__lead" style={label14}>
            404
          </p>
        </div>

        <MarketingParagraph>
          If you followed an old link or typed the path manually, use the docs hub, search, or a
          nearby guide to get back on track.
        </MarketingParagraph>

        <MarketingDocSearch />

        <MarketingDocAudienceCards cards={recoveryCards} />

        <section className="landing-doc-section" aria-label="Popular docs">
          <h2 className="landing-route-section-heading" style={label14}>
            Popular docs
          </h2>
          <MarketingDocHub cards={docsHubCards} />
        </section>

        <p className="landing-doc-article__related-desc" style={body14}>
          The docs hub stays up to date with the current product structure, including the GitLab
          integration, workflow canvas, and runtime guides.
        </p>

        <p>
          <Link href={marketingLinks.docs} className="landing-route-link">
            Return to docs hub
          </Link>
        </p>
      </div>
    </MarketingDocLayout>
  );
}
