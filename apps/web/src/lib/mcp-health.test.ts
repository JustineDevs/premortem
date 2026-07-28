import assert from 'node:assert/strict';
import test from 'node:test';

import { isLikelyMcpHealthProbe } from './mcp-health.js';

function makeRequest(
  pathname: string,
  init: { method?: string; headers?: Record<string, string> } = {}
) {
  return {
    method: init.method ?? 'GET',
    headers: new Headers(init.headers),
    nextUrl: {
      pathname,
      search: '',
      host: 'premortem.jstn.site',
      protocol: 'https:'
    }
  } as Parameters<typeof isLikelyMcpHealthProbe>[0];
}

test('plain GET /mcp is treated as a monitor probe', () => {
  assert.equal(isLikelyMcpHealthProbe(makeRequest('/mcp')), true);
});

test('event-stream GET /mcp is treated as a real MCP request', () => {
  assert.equal(
    isLikelyMcpHealthProbe(makeRequest('/mcp', { headers: { accept: 'text/event-stream' } })),
    false
  );
});

test('GET /mcp/healthz is always treated as a monitor probe', () => {
  assert.equal(isLikelyMcpHealthProbe(makeRequest('/mcp/healthz')), true);
});
