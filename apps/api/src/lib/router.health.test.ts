import assert from 'node:assert/strict';
import test from 'node:test';

import { appRouter } from './router.js';

async function readJson(response: Response) {
  return (await response.json()) as { ok?: boolean; service?: string };
}

test('root path returns a public health response', async () => {
  const response = await appRouter(new Request('https://api.jstn.site/'));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, service: 'premortem-api' });
});

test('/api/mcp/healthz returns a public MCP health response', async () => {
  const response = await appRouter(new Request('https://api.jstn.site/api/mcp/healthz'));
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { ok: true, service: 'premortem-mcp' });
});

test('/api/v1 routes normalize to the v1 API and stay non-deprecated', async () => {
  const response = await appRouter(new Request('https://api.jstn.site/api/v1/does-not-exist'));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-premortem-api-version'), 'v1');
  assert.equal(response.headers.get('Deprecation'), null);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});

test('legacy /api routes are marked deprecated and point to the v1 successor', async () => {
  const response = await appRouter(new Request('https://api.jstn.site/api/does-not-exist'));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-premortem-api-version'), 'v1');
  assert.equal(response.headers.get('Deprecation'), 'true');
  assert.match(response.headers.get('Link') ?? '', /\/api\/v1\/does-not-exist/);
});
