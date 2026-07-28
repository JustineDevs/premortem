import assert from 'node:assert/strict';
import test from 'node:test';

import { authProviderHref, getCanonicalBrowserAppOrigin } from './auth-links';

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

test('production auth links prefer the canonical app origin', () => {
  withEnv(
    {
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://premortem.jstn.site'
    },
    () => {
      assert.equal(getCanonicalBrowserAppOrigin(), 'https://premortem.jstn.site');
      assert.equal(
        authProviderHref('gitlab', 'login', '/app?tab=projects'),
        'https://premortem.jstn.site/api/auth/gitlab?mode=login&next=%2Fapp%3Ftab%3Dprojects'
      );
    }
  );
});

