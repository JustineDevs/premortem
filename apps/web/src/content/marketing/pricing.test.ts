import test from 'node:test';
import assert from 'node:assert/strict';

import { marketingPricingTiers } from './pricing';

test('free plan does not advertise GitLab publish', () => {
  const freeTier = marketingPricingTiers.find((tier) => tier.id === 'free');
  assert.ok(freeTier);
  assert.deepEqual(freeTier?.limits, ['1 connected repo', '10 audits / month', '3 publishes / month']);
  assert.equal((freeTier?.features as readonly string[]).includes('GitLab publish'), false);
  assert.equal((freeTier?.features as readonly string[]).includes('Multi-lens mock audits'), false);
  assert.equal((freeTier?.features as readonly string[]).includes('Real specialist audits'), true);
});

test('pricing ladder includes repriced Growth and Scale tiers', () => {
  const growthTier = marketingPricingTiers.find((tier) => tier.id === 'team');
  const scaleTier = marketingPricingTiers.find((tier) => tier.id === 'scale');

  assert.ok(growthTier);
  assert.ok(scaleTier);
  assert.equal(growthTier?.priceMonthly, 149);
  assert.equal(growthTier?.priceAnnual, 119);
  assert.deepEqual(growthTier?.limits, ['30 connected repos', '300 audits / month', '1-year history']);
  assert.equal(scaleTier?.priceMonthly, 299);
  assert.equal(scaleTier?.priceAnnual, 239);
  assert.deepEqual(scaleTier?.limits, ['100 connected repos', '1,000 audits / month', 'Priority support']);
});
