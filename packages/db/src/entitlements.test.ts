import test from 'node:test';
import assert from 'node:assert/strict';

import { countConnectedProjects, PLAN_LIMITS } from './entitlements';

test('connected projects only count active repositories', () => {
  assert.equal(
    countConnectedProjects([
      { status: 'active' },
      { status: 'archived' },
      { status: 'disconnected' },
      { status: null },
      {}
    ]),
    1
  );
});

test('free tier keeps the documented repo and publish limits', () => {
  assert.equal(PLAN_LIMITS.free.maxRepos, 1);
  assert.equal(PLAN_LIMITS.free.auditsPerMonth, 10);
  assert.equal(PLAN_LIMITS.free.publishesPerMonth, 3);
  assert.equal(PLAN_LIMITS.free.canPublish, true);
  assert.equal(PLAN_LIMITS.pro.publishesPerMonth, null);
  assert.equal(PLAN_LIMITS.team.maxRepos, 30);
  assert.equal(PLAN_LIMITS.team.auditsPerMonth, 300);
  assert.equal(PLAN_LIMITS.team.skillMarketplace, false);
  assert.equal(PLAN_LIMITS.scale.maxRepos, 100);
  assert.equal(PLAN_LIMITS.scale.auditsPerMonth, 1000);
  assert.equal(PLAN_LIMITS.scale.skillMarketplace, true);
  assert.equal(PLAN_LIMITS.team.graphitiMemory, true);
});
