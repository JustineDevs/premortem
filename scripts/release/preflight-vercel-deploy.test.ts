import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChecks, verificationStepEnv } from './preflight-vercel-deploy.ts';

test('freeze-safe preflight can be selected without eval loop pressure', () => {
  const env = verificationStepEnv({ TURBO_CONCURRENCY: '1' });
  assert.equal(env.CI, '1');
  assert.equal(env.TURBO_CONCURRENCY, '1');
  assert.equal(env.TURBO_TELEMETRY_DISABLED, '1');

  const names = buildChecks({ freezeSafe: true }).map((step) => step.name);
  assert.ok(names.includes('pnpm run lint'));
  assert.ok(names.includes('pnpm run typecheck'));
  assert.ok(names.includes('pnpm run build'));
  assert.ok(names.includes('pnpm run verify:env'));
  assert.ok(!names.includes('pnpm run eval:prompts'));
});
