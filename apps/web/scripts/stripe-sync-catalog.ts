#!/usr/bin/env node

import Stripe from 'stripe';

import { loadPremortemLocalEnv } from '../../../scripts/load-local-env.ts';

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
      lookupKey: 'premortem-starter-monthly',
      unitAmount: 4900
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_PRO_ANNUAL?.trim(),
      nickname: 'Starter Annual',
      lookupKey: 'premortem-starter-annual',
      unitAmount: 3900
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
      lookupKey: 'premortem-growth-monthly',
      unitAmount: 14900
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_TEAM_ANNUAL?.trim(),
      nickname: 'Growth Annual',
      lookupKey: 'premortem-growth-annual',
      unitAmount: 11900
    },
    productMetadata: {
      tier: 'growth',
      plan: 'team',
      connected_repos: '30',
      audits_per_month: '300',
      can_publish: 'true'
    },
    priceMetadata: {
      tier: 'growth',
      plan: 'team',
      connected_repos: '30',
      audits_per_month: '300',
      can_publish: 'true'
    },
    marketingFeatures: [
      { name: '30 connected repos' },
      { name: '300 audits / month' },
      { name: 'Webhook alerts' },
      { name: 'Team usage dashboards' },
      { name: 'Graphiti memory' }
    ]
  },
  {
    tier: 'scale',
    plan: 'scale',
    productName: 'Premortem Scale',
    productDescription:
      'For teams that have outgrown Growth and need higher throughput before enterprise sales.',
    monthly: {
      priceId: process.env.STRIPE_PRICE_SCALE?.trim(),
      nickname: 'Scale Monthly',
      lookupKey: 'premortem-scale-monthly',
      unitAmount: 29900
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_SCALE_ANNUAL?.trim(),
      nickname: 'Scale Annual',
      lookupKey: 'premortem-scale-annual',
      unitAmount: 23900
    },
    productMetadata: {
      tier: 'scale',
      plan: 'scale',
      connected_repos: '100',
      audits_per_month: '1000',
      can_publish: 'true'
    },
    priceMetadata: {
      tier: 'scale',
      plan: 'scale',
      connected_repos: '100',
      audits_per_month: '1000',
      can_publish: 'true'
    },
    marketingFeatures: [
      { name: '100 connected repos' },
      { name: '1,000 audits / month' },
      { name: 'Priority support' },
      { name: 'Skill marketplace access' }
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
  let monthlyPriceId = entry.monthly.priceId ?? null;
  let annualPriceId = entry.annual.priceId ?? null;

  let monthlyPrice = monthlyPriceId
    ? await stripe.prices.retrieve(monthlyPriceId, { expand: ['product'] })
    : null;
  let annualPrice = annualPriceId
    ? await stripe.prices.retrieve(annualPriceId, { expand: ['product'] })
    : null;

  let productId = monthlyPrice
    ? typeof monthlyPrice.product === 'string'
      ? monthlyPrice.product
      : monthlyPrice.product.id
    : annualPrice
      ? typeof annualPrice.product === 'string'
        ? annualPrice.product
        : annualPrice.product.id
      : null;

  if (!productId) {
    const createdProduct = await stripe.products.create({
      active: true,
      name: entry.productName,
      description: entry.productDescription,
      marketing_features: entry.marketingFeatures,
      metadata: entry.productMetadata
    });
    productId = createdProduct.id;
  }

  if (monthlyPrice && annualPrice) {
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
    productId = monthlyProductId;
  }

  let updatedProduct = await stripe.products.update(productId, {
    active: true,
    name: entry.productName,
    description: entry.productDescription,
    default_price: monthlyPriceId,
    marketing_features: entry.marketingFeatures,
    metadata: entry.productMetadata
  });

  if (!monthlyPrice) {
    monthlyPrice = await stripe.prices.create({
      active: true,
      currency: 'usd',
      unit_amount: entry.monthly.unitAmount,
      recurring: {
        interval: 'month'
      },
      product: productId,
      nickname: entry.monthly.nickname,
      lookup_key: entry.monthly.lookupKey,
      metadata: {
        ...entry.priceMetadata,
        interval: 'month',
        product_id: productId
      }
    });
    monthlyPriceId = monthlyPrice.id;
    updatedProduct = await stripe.products.update(productId, {
      active: true,
      name: entry.productName,
      description: entry.productDescription,
      default_price: monthlyPriceId,
      marketing_features: entry.marketingFeatures,
      metadata: entry.productMetadata
    });
  }

  if (!annualPrice) {
    annualPrice = await stripe.prices.create({
      active: true,
      currency: 'usd',
      unit_amount: entry.annual.unitAmount,
      recurring: {
        interval: 'year'
      },
      product: productId,
      nickname: entry.annual.nickname,
      lookup_key: entry.annual.lookupKey,
      metadata: {
        ...entry.priceMetadata,
        interval: 'year',
        product_id: productId
      }
    });
    annualPriceId = annualPrice.id;
  }

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

async function createPaymentLinkIfMissing(priceId, label) {
  if (!priceId) {
    fail(`Missing price for ${label}`);
  }

  const existingUrl = process.env[`STRIPE_PAYMENT_LINK_${label.toUpperCase()}`]?.trim();
  if (existingUrl) {
    return existingUrl;
  }

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      label
    }
  });

  return link.url;
}

async function main() {
  const results = [];
  for (const entry of catalog) {
    const synced = await syncTier(entry);
    results.push({
      ...synced,
      paymentLinks: {
        monthly: await createPaymentLinkIfMissing(synced.monthly.id, `${entry.tier}_monthly`),
        yearly: await createPaymentLinkIfMissing(synced.annual.id, `${entry.tier}_annual`)
      }
    });
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
