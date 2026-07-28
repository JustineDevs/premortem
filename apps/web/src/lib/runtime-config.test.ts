import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getApiBaseUrl,
  getAuthRedirectOrigin,
  getCanonicalLoopbackOrigin,
  getMcpUpstreamUrl,
  getPublicAppOrigin
} from './runtime-config';

function withEnv<T>(values: Record<string, string | undefined>, fn: () => T): T {
  const keys = Object.keys(values);
  const previous = new Map<string, string | undefined>();

  for (const key of keys) {
    previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('production api and mcp config ignore localhost fallbacks', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      PREMORTEM_API_BASE_URL: 'http://127.0.0.1:18787',
      MCP_UPSTREAM_URL: 'http://localhost:18787/api/mcp',
      PREMORTEM_SITE_URL: 'https://premortem.jstn.site',
      NEXT_PUBLIC_APP_URL: 'https://premortem.jstn.site'
    },
    () => {
      assert.equal(getApiBaseUrl(), 'https://api.jstn.site');
      assert.equal(getMcpUpstreamUrl(), 'https://api.jstn.site/api/mcp');
      assert.equal(getPublicAppOrigin('http://localhost:3000'), 'https://premortem.jstn.site');
      assert.equal(getAuthRedirectOrigin('http://127.0.0.1:3000'), 'https://premortem.jstn.site');
      assert.equal(getCanonicalLoopbackOrigin('http://127.0.0.1:3000'), null);
    }
  );
});

test('development can still use loopback origins', () => {
  withEnv(
    {
      NODE_ENV: 'development',
      VERCEL_ENV: 'development',
      PREMORTEM_API_BASE_URL: undefined,
      MCP_UPSTREAM_URL: undefined,
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:13000'
    },
    () => {
      assert.equal(getAuthRedirectOrigin('http://localhost:13000'), 'http://localhost:13000');
      assert.equal(getCanonicalLoopbackOrigin('http://localhost:13000'), 'http://127.0.0.1:13000');
    }
  );
});
