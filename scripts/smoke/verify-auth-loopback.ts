import assert from 'node:assert/strict';

import { NextRequest } from 'next/server';

import { loadPremortemLocalEnv } from '../load-local-env.ts';
import { GET as startGitLabOAuth } from '../../apps/web/app/api/auth/[provider]/route.ts';
import { POST as logout } from '../../apps/web/app/api/auth/logout/route.ts';
import { GET as startGitLabIntegration } from '../../apps/web/app/api/integrations/connect/gitlab/route.ts';
import { GET as authCallback } from '../../apps/web/app/auth/callback/route.ts';
import {
  getCanonicalLoopbackOrigin,
  getPublicAppOrigin,
  gitlabOAuthRedirectUri
} from '../../apps/web/src/lib/runtime-config.ts';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  createCsrfToken
} from '../../apps/web/src/lib/csrf.ts';

loadPremortemLocalEnv();

async function main() {
  const requestOrigin = 'http://localhost:13000';
  const configuredOrigin = 'http://127.0.0.1:13000';

  function makeRequest(url, init = {}) {
    const requestUrl = new URL(url);
    const headers = new Headers(init.headers ?? {});
    headers.set('host', requestUrl.host);
    return new NextRequest(url, { ...init, headers });
  }

  function withCsrf(request) {
    const csrfToken = createCsrfToken();
    request.headers.set('cookie', `${CSRF_COOKIE_NAME}=${csrfToken}`);
    request.headers.set(CSRF_HEADER_NAME, csrfToken);
    return request;
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

  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercelEnv = process.env.VERCEL_ENV;

  try {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    assert.ok(supabaseOrigin, 'supabase origin must be configured for auth smoke');
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    assert.equal(getPublicAppOrigin(requestOrigin), 'https://example.com');
    process.env.NODE_ENV = previousNodeEnv;
    process.env.VERCEL_ENV = previousVercelEnv;
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
      formData.set('termsAccepted', '1');
      return formData;
    };

    const canonicalAuthRedirect = await assertRedirect(
      withCsrf(makeRequest(`${requestOrigin}/api/auth/gitlab?mode=login&next=%2Fapp`, {
        method: 'POST',
        body: buildAuthFormData()
      })),
      (request) => startGitLabOAuth(request, { params: Promise.resolve({ provider: 'gitlab' }) }),
      `${configuredOrigin}/api/auth/gitlab?mode=login&next=%2Fapp`,
      'start auth should canonicalize loopback host before OAuth handoff'
    );

    await assertRedirect(
      withCsrf(makeRequest(canonicalAuthRedirect, {
        method: 'POST',
        body: buildAuthFormData()
      })),
      (request) => startGitLabOAuth(request, { params: Promise.resolve({ provider: 'gitlab' }) }),
      `${supabaseOrigin.replace(/\/$/, '')}/auth/v1/authorize?provider=gitlab`,
      'canonical auth request should yield Supabase authorize URL'
    );

    const authLocation = await startGitLabOAuth(
      withCsrf(makeRequest(canonicalAuthRedirect, {
        method: 'POST',
        body: buildAuthFormData()
      })),
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
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnv;
    }
  }

    await assertRedirect(
      withCsrf(makeRequest(`${requestOrigin}/api/auth/logout`, {
        method: 'POST'
      })),
      logout,
      `${requestOrigin}/login`,
      'logout should preserve public origin on redirect'
  );

  console.log('auth loopback regression passed');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
