import assert from 'node:assert/strict';

import { NextRequest } from 'next/server';

import { loadPremortemLocalEnv } from '../load-local-env.mjs';
import { GET as startGitLabOAuth } from '../../apps/web/app/api/auth/[provider]/route.ts';
import { POST as logout } from '../../apps/web/app/api/auth/logout/route.ts';
import { GET as startGitLabIntegration } from '../../apps/web/app/api/integrations/connect/gitlab/route.ts';
import { GET as authCallback } from '../../apps/web/app/auth/callback/route.ts';
import {
  getCanonicalLoopbackOrigin,
  getPublicAppOrigin,
  gitlabOAuthRedirectUri
} from '../../apps/web/src/lib/runtime-config.ts';

loadPremortemLocalEnv();

const requestOrigin = 'http://localhost:13000';
const configuredOrigin = 'http://127.0.0.1:13000';
const turnstileTestSiteKey = '1x00000000000000000000AA';
const turnstileTestSecretKey = '1x0000000000000000000000000000000AA';
const turnstileTestToken = 'XXXX.DUMMY.TOKEN.XXXX';

function withTurnstileTestEnv() {
  const previous = {
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    secretKey: process.env.TURNSTILE_SECRET_KEY
  };

  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = turnstileTestSiteKey;
  process.env.TURNSTILE_SECRET_KEY = turnstileTestSecretKey;

  return () => {
    if (previous.siteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = previous.siteKey;
    }

    if (previous.secretKey === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = previous.secretKey;
    }
  };
}

function makeRequest(url, init = {}) {
  const requestUrl = new URL(url);
  const headers = new Headers(init.headers ?? {});
  headers.set('host', requestUrl.host);
  return new NextRequest(url, { ...init, headers });
}

async function assertRedirect(request, handler, expectedPrefix, message) {
  const response = await handler(request);
  assert.ok(
    response.status === 303 || response.status === 307,
    `${message}: status ${response.status}`
  );
  const location = response.headers.get('location');
  assert.ok(location, `${message}: location`);
  assert.ok(location.startsWith(expectedPrefix), `${message}: unexpected location ${location}`);
  return location;
}

const restoreTurnstileEnv = withTurnstileTestEnv();
const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

try {
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  assert.equal(
    getPublicAppOrigin(requestOrigin),
    requestOrigin,
    'live request origin should win over configured origin during auth flows'
  );
  assert.equal(
    getCanonicalLoopbackOrigin(requestOrigin),
    configuredOrigin,
    'localhost auth flows should be canonicalized to 127.0.0.1 before OAuth handoff'
  );
  assert.equal(
    gitlabOAuthRedirectUri(requestOrigin),
    `${requestOrigin}/api/integrations/callback/gitlab`,
    'live request origin should drive the GitLab redirect URI'
  );

  const buildAuthFormData = () => {
    const formData = new FormData();
    formData.set('cf-turnstile-response', turnstileTestToken);
    return formData;
  };

  const canonicalAuthRedirect = await assertRedirect(
    makeRequest(`${requestOrigin}/api/auth/gitlab?mode=login&next=%2Fapp`, {
      method: 'POST',
      body: buildAuthFormData()
    }),
    (request) => startGitLabOAuth(request, { params: Promise.resolve({ provider: 'gitlab' }) }),
    `${configuredOrigin}/api/auth/gitlab?mode=login&next=%2Fapp`,
    'start auth should canonicalize loopback host before OAuth handoff'
  );

  await assertRedirect(
    makeRequest(canonicalAuthRedirect, {
      method: 'POST',
      body: buildAuthFormData()
    }),
    (request) => startGitLabOAuth(request, { params: Promise.resolve({ provider: 'gitlab' }) }),
    'https://yiemjguwvbnoglnzyptz.supabase.co/auth/v1/authorize?provider=gitlab',
    'canonical auth request should yield Supabase authorize URL'
  );

  const authLocation = await startGitLabOAuth(
    makeRequest(canonicalAuthRedirect, {
      method: 'POST',
      body: buildAuthFormData()
    }),
    { params: Promise.resolve({ provider: 'gitlab' }) }
  ).then((response) => response.headers.get('location'));
  const authUrl = new URL(authLocation ?? '');
  assert.equal(
    authUrl.searchParams.get('redirect_to'),
    `${configuredOrigin}/auth/callback?next=%2Fapp&mode=login`
  );

  await assertRedirect(
    makeRequest(`${requestOrigin}/api/integrations/connect/gitlab?next=%2Fapp`),
    startGitLabIntegration,
    `${configuredOrigin}/api/integrations/connect/gitlab?next=%2Fapp`,
    'integration connect should canonicalize loopback auth origin before OAuth'
  );

  await assertRedirect(
    makeRequest(`${requestOrigin}/auth/callback?next=%2Fapp&mode=login&code=sample`),
    authCallback,
    `${configuredOrigin}/auth/callback?next=%2Fapp&mode=login&code=sample`,
    'auth callback should canonicalize loopback origin before exchange'
  );
} finally {
  if (previousAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  }
  restoreTurnstileEnv();
}

await assertRedirect(
  makeRequest(`${requestOrigin}/api/auth/logout`, {
    method: 'POST'
  }),
  logout,
  `${requestOrigin}/login`,
  'logout should preserve public origin on redirect'
);

console.log('auth loopback regression passed');
