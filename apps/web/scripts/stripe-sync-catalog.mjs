#!/usr/bin/env node

import Stripe from 'stripe';

import { loadPremortemLocalEnv } from '../../../scripts/load-local-env.mjs';

const repoRoot = loadPremortemLocalEnv();

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.error('Missing STRIPE_SECRET_KEY in .env.local');
  process.exit(1);
}

const catalog = [
  {
    tier: 'starter',
    plan: 'pro',
    productName: 'Premortem Starter',
    productDescription:
      'For teams shipping weekly with GitLab publish, audit reconciliation, and a single-tenant review workflow.',
    monthly: {
      priceId: process.env.STRIPE_PRICE_PRO?.trim(),
      nickname: 'Starter Monthly',
      lookupKey: 'premortem-starter-monthly'
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_PRO_ANNUAL?.trim(),
      nickname: 'Starter Annual',
      lookupKey: 'premortem-starter-annual'
    },
    productMetadata: {
      tier: 'starter',
      plan: 'pro',
      connected_repos: '10',
      audits_per_month: '100',
      can_publish: 'true'
    },
    priceMetadata: {
      tier: 'starter',
      plan: 'pro',
      connected_repos: '10',
      audits_per_month: '100',
      can_publish: 'true'
    },
    marketingFeatures: [
      { name: '10 connected repos' },
      { name: '100 audits / month' },
      { name: 'GitLab publish + reconcile' }
    ]
  },
  {
    tier: 'growth',
    plan: 'team',
    productName: 'Premortem Growth',
    productDescription:
      'For larger teams with more repositories, higher audit volume, and priority reconciliation.',
    monthly: {
      priceId: process.env.STRIPE_PRICE_TEAM?.trim(),
      nickname: 'Growth Monthly',
      lookupKey: 'premortem-growth-monthly'
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_TEAM_ANNUAL?.trim(),
      nickname: 'Growth Annual',
      lookupKey: 'premortem-growth-annual'
    },
    productMetadata: {
      tier: 'growth',
      plan: 'team',
      connected_repos: '50',
      audits_per_month: '500',
      can_publish: 'true'
    },
    priceMetadata: {
      tier: 'growth',
      plan: 'team',
      connected_repos: '50',
      audits_per_month: '500',
      can_publish: 'true'
    },
    marketingFeatures: [
      { name: '50 connected repos' },
      { name: '500 audits / month' },
      { name: 'Priority reconciliation' }
    ]
  }
];

const stripe = new Stripe(secretKey, {
  apiVersion: '2026-05-27.dahlia'
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requirePriceId(value, label) {
  if (!value) fail(`Missing ${label} in .env.local`);
  return value;
}

async function syncTier(entry) {
  const monthlyPriceId = requirePriceId(entry.monthly.priceId, `${entry.tier} monthly Stripe price`);
  const annualPriceId = requirePriceId(entry.annual.priceId, `${entry.tier} annual Stripe price`);

  const monthlyPrice = await stripe.prices.retrieve(monthlyPriceId, { expand: ['product'] });
  const annualPrice = await stripe.prices.retrieve(annualPriceId, { expand: ['product'] });

  const monthlyProductId =
    typeof monthlyPrice.product === 'string' ? monthlyPrice.product : monthlyPrice.product.id;
  const annualProductId =
    typeof annualPrice.product === 'string' ? annualPrice.product : annualPrice.product.id;

  if (monthlyProductId !== annualProductId) {
    fail(
      [
        `${entry.productName} has mismatched products for monthly and annual prices.`,
        `monthly=${monthlyProductId}`,
        `annual=${annualProductId}`
      ].join(' ')
    );
  }

  const productId = monthlyProductId;
  const updatedProduct = await stripe.products.update(productId, {
    active: true,
    name: entry.productName,
    description: entry.productDescription,
    default_price: monthlyPriceId,
    marketing_features: entry.marketingFeatures,
    metadata: entry.productMetadata
  });

  const [updatedMonthlyPrice, updatedAnnualPrice] = await Promise.all([
    stripe.prices.update(monthlyPriceId, {
      active: true,
      nickname: entry.monthly.nickname,
      lookup_key: entry.monthly.lookupKey,
      metadata: {
        ...entry.priceMetadata,
        interval: 'month',
        product_id: productId
      }
    }),
    stripe.prices.update(annualPriceId, {
      active: true,
      nickname: entry.annual.nickname,
      lookup_key: entry.annual.lookupKey,
      metadata: {
        ...entry.priceMetadata,
        interval: 'year',
        product_id: productId
      }
    })
  ]);

  return {
    tier: entry.tier,
    product: {
      id: updatedProduct.id,
      name: updatedProduct.name,
      defaultPrice: updatedProduct.default_price
    },
    monthly: {
      id: updatedMonthlyPrice.id,
      lookupKey: updatedMonthlyPrice.lookup_key,
      nickname: updatedMonthlyPrice.nickname
    },
    annual: {
      id: updatedAnnualPrice.id,
      lookupKey: updatedAnnualPrice.lookup_key,
      nickname: updatedAnnualPrice.nickname
    }
  };
}

async function main() {
  const results = [];
  for (const entry of catalog) {
    results.push(await syncTier(entry));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        repoRoot,
        catalog: results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
