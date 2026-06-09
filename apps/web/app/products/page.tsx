import {
  MarketingFeatureList,
  MarketingLinkGrid,
  MarketingProductMap,
  MarketingScopeTable
} from '@/components/landing/blocks';
import {
  MarketingParagraph,
  MarketingSectionHeading
} from '@/components/landing/marketing-content';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { productsPage } from '@/content/marketing/products';
import { premortemFeatures, productMapTiles } from '@/content/marketing/shared';
import { marketingLinks } from '@/lib/marketing-links';

export const metadata = {
  title: 'Products | Premortem',
  description: 'Premortem products for predictive repository audits.'
};

export default function ProductsPage() {
  return (
    <MarketingPageLayout title={productsPage.title} description={productsPage.description}>
      <MarketingParagraph>{productsPage.intro}</MarketingParagraph>

      <MarketingSectionHeading>Product map</MarketingSectionHeading>
      <MarketingProductMap tiles={productMapTiles} />

      <MarketingSectionHeading>Core capabilities</MarketingSectionHeading>
      <MarketingFeatureList items={productsPage.capabilities} />

      <MarketingSectionHeading>Features</MarketingSectionHeading>
      <MarketingFeatureList items={premortemFeatures} />

      <MarketingSectionHeading>v0.1.0 scope</MarketingSectionHeading>
      <MarketingScopeTable rows={productsPage.scopeRows} />

      <MarketingLinkGrid
        items={[
          { href: marketingLinks.howItWorks, label: 'How it works' },
          { href: marketingLinks.docs, label: 'Documentation' },
          { href: marketingLinks.releases, label: 'Release notes', external: true }
        ]}
      />
    </MarketingPageLayout>
  );
}
