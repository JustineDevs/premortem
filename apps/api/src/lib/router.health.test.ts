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
