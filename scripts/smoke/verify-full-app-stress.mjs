#!/usr/bin/env node
/**
 * Full-application route stress: marketing, docs, auth, BFF, billing, workspace, audits.
 * Requires local stack: pnpm run dev (web + API).
 *
 * Uses fixture dry-run defaults unless PREMORTEM_PRODUCTION_MODE=1.
 * Mints a Supabase bearer session when the running web app requires auth.
 */

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConsoleReviewAction, LOCAL_DEV_FIXTURE } from '@premortem/domain';

import { loadSmokeEnv } from './load-smoke-env.mjs';
import { createSupabaseSmokeSession } from './smoke-supabase-session.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

if (process.env.PREMORTEM_PRODUCTION_MODE !== '1') {
  process.env.PREMORTEM_SMOKE_USE_FIXTURE ??= '1';
  process.env.PREMORTEM_AUTH_DISABLED ??= '1';
  process.env.PREMORTEM_PUBLISH_DRY_RUN ??= '1';
  process.env.PREMORTEM_RECONCILE_DRY_RUN ??= '1';
}

const { productionMode, fixtureMode } = loadSmokeEnv();

const WEB_PORT = process.env.PREMORTEM_WEB_PORT ?? '13000';
const API_PORT = process.env.PREMORTEM_API_PORT ?? '18787';
const WEB_BASE = `http://127.0.0.1:${WEB_PORT}`;
const API_BASE = `http://127.0.0.1:${API_PORT}`;

const results = {
  passed: [],
  failed: [],
  skipped: []
};

function pass(label) {
  results.passed.push(label);
}

function fail(label, detail) {
  results.failed.push({ label, detail });
}

function skip(label, reason) {
  results.skipped.push({ label, reason });
}

async function waitForOk(url, init, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function authHeaders(token) {
  return token
    ? {
        authorization: `Bearer ${token}`,
        accept: 'application/json'
      }
    : { accept: 'application/json' };
}

async function expectHtml(pathname, label, allowedStatuses = [200]) {
  const response = await fetch(`${WEB_BASE}${pathname}`, { redirect: 'manual' });
  if (!allowedStatuses.includes(response.status)) {
    fail(label, `${pathname} status ${response.status}`);
    return;
  }
  if (response.status === 200) {
    const html = await response.text();
    if (!html.includes('<!DOCTYPE html') && !html.includes('<html')) {
      fail(label, `${pathname} missing html shell`);
      return;
    }
  }
  pass(label);
}

async function expectJson(method, pathname, label, options = {}) {
  const { status = 200, headers = {}, body, allowedStatuses } = options;
  const response = await fetch(`${WEB_BASE}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  const allowed = allowedStatuses ?? [status];
  if (!allowed.includes(response.status)) {
    const text = await response.text().catch(() => '');
    fail(label, `${method} ${pathname} → ${response.status} ${text.slice(0, 160)}`);
    return null;
  }
  pass(label);
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function expectRedirect(pathname, label, allowed = [302, 307, 308]) {
  const response = await fetch(`${WEB_BASE}${pathname}`, { redirect: 'manual' });
  if (!allowed.includes(response.status)) {
    fail(label, `${pathname} status ${response.status}`);
    return;
  }
  pass(label);
}

const started = performance.now();
await waitForOk(`${API_BASE}/health`);
await waitForOk(`${WEB_BASE}/api/health`);

const dbModule = await import('@premortem/db');
const orchestratorModule = await import('@premortem/orchestrator');
const { ensureLocalDevelopmentFixture, prisma } = dbModule;
const { buildWorkerRegisteredAgents, executeAuditJob, submitAudit } = orchestratorModule;

await ensureLocalDevelopmentFixture();

/** @type {string | null} */
let bearerToken = null;

const workspaceProbe = await fetch(`${WEB_BASE}/api/workspace`);
const needsBearer =
  workspaceProbe.status === 401 ||
  workspaceProbe.status === 502 ||
  (!workspaceProbe.ok && !productionMode);

if (needsBearer || productionMode) {
  try {
    const password = randomBytes(18).toString('base64url');
    const session = await createSupabaseSmokeSession({
      userId: LOCAL_DEV_FIXTURE.profileId,
      email: LOCAL_DEV_FIXTURE.email,
      password,
      fullName: 'Stress Smoke',
      username: 'stress-smoke'
    });
    bearerToken = session.accessToken;
    pass('auth: minted Supabase bearer for BFF');
  } catch (error) {
    if (workspaceProbe.ok) {
      pass('auth: BFF accessible without bearer (auth bypass or open dev)');
    } else {
      fail('auth: mint Supabase bearer', error instanceof Error ? error.message : String(error));
    }
  }
} else if (workspaceProbe.ok) {
  pass('auth: BFF accessible without bearer (auth bypass or open dev)');
} else {
  fail('auth: workspace probe', `status ${workspaceProbe.status}`);
}

const headers = authHeaders(bearerToken);

const marketingRoutes = [
  '/',
  '/products',
  '/solutions',
  '/how-it-works',
  '/login',
  '/signup',
  '/privacy',
  '/terms'
];

const docsRoutes = [
  '/docs',
  '/docs/getting-started',
  '/docs/architecture',
  '/docs/releases',
  '/docs/troubleshooting',
  '/docs/product/flows',
  '/docs/concepts/audit-model',
  '/docs/concepts/data-flow',
  '/docs/guides/connect-gitlab',
  '/docs/guides/run-audit',
  '/docs/guides/review-and-publish',
  '/docs/tutorials/first-audit',
  '/docs/integrations/gitlab',
  '/docs/reference/api',
  '/docs/reference/environment'
];

await Promise.all(
  marketingRoutes.map((route) => expectHtml(route, `marketing ${route}`))
);
await Promise.all(docsRoutes.map((route) => expectHtml(route, `docs ${route}`)));

await expectRedirect('/reviews', 'legacy /reviews → /app', [307, 308, 302]);

const appResponse = await fetch(`${WEB_BASE}/app`, { redirect: 'manual' });
if (appResponse.status === 200) {
  pass('console /app renders');
} else if ([302, 307, 308].includes(appResponse.status)) {
  pass('console /app auth gate (redirect to login)');
} else {
  fail('console /app', `status ${appResponse.status}`);
}

await expectRedirect('/api/auth/gitlab?mode=login&next=/app', 'auth GitLab OAuth');
await expectRedirect('/api/auth/github?mode=signup&next=/app', 'auth GitHub OAuth');
await expectJson('GET', '/api/auth/status', 'auth status');

const logoutRes = await fetch(`${WEB_BASE}/api/auth/logout`, {
  method: 'POST',
  redirect: 'manual'
});
if ([200, 302, 307, 303].includes(logoutRes.status)) {
  pass('auth logout route');
} else {
  fail('auth logout route', `status ${logoutRes.status}`);
}

await expectRedirect(
  '/api/integrations/connect/gitlab?next=/app%3Ftab%3Dprojects',
  'integration GitLab connect'
);
await expectRedirect('/api/integrations/connect/github?next=/app', 'integration GitHub connect');

const bffGets = [
  '/api/health',
  '/api/projects',
  '/api/audits',
  '/api/audits?hydrate=1&limit=5',
  '/api/workspace',
  '/api/reconciliation',
  '/api/auth/status'
];

await Promise.all(
  bffGets.map((route) =>
    expectJson('GET', route, `BFF GET ${route}`, { headers, allowedStatuses: [200] })
  )
);

const stressBurst = await Promise.all(
  Array.from({ length: 12 }, () => fetch(`${WEB_BASE}/api/projects`, { headers }))
);
if (stressBurst.every((response) => response.status === 200)) {
  pass('stress: 12 parallel GET /api/projects');
} else {
  fail('stress: parallel projects', `${stressBurst.filter((r) => r.status !== 200).length} failures`);
}

const parallelAudits = [];
for (const index of [0, 1]) {
  const submitted = await submitAudit({
    organizationId: LOCAL_DEV_FIXTURE.organizationId,
    projectId: LOCAL_DEV_FIXTURE.projectId,
    branch: 'main',
    commitSha: `full-stress-${Date.now()}-${index}-${randomBytes(4).toString('hex')}`,
    triggeredById: LOCAL_DEV_FIXTURE.profileId
  });

  await executeAuditJob({
    job: submitted.job,
    rootDir: ROOT_DIR,
    registryAgents: buildWorkerRegisteredAgents()
  });

  parallelAudits.push(submitted.auditRunId);
}
pass('stress: two sequential audit runs completed');

for (const auditRunId of parallelAudits) {
  const snapshot = await expectJson('GET', `/api/audits/${auditRunId}`, `audit snapshot ${auditRunId}`, {
    headers
  });
  if (snapshot?.snapshot?.graphSnapshot?.nodeCount > 0) {
    pass(`audit graph nodes ${auditRunId}`);
  } else {
    fail(`audit graph nodes ${auditRunId}`, 'empty graph');
  }

  await expectJson('GET', `/api/audits/${auditRunId}/graph`, `audit graph BFF ${auditRunId}`, {
    headers,
    allowedStatuses: [200, 404]
  });
}

const lastAuditId = parallelAudits.at(-1);
const snapshotPayload = await expectJson('GET', `/api/audits/${lastAuditId}`, 'last audit snapshot', {
  headers
});
const issueId = snapshotPayload?.snapshot?.issueCandidates?.[0]?.id;

if (issueId) {
  await expectJson(
    'POST',
    `/api/audits/${lastAuditId}/issues/${issueId}/action`,
    'review approve',
    {
      headers,
      body: { action: ConsoleReviewAction.CONFIRM }
    }
  );

  await expectJson('POST', `/api/audits/${lastAuditId}/issues/${issueId}/edit`, 'review edit', {
    headers,
    body: { title: 'Full stress edited title', whyItMatters: 'Stress test edit' }
  });

  const publishPayload = await expectJson('POST', `/api/issues/${issueId}/publish`, 'publish issue', {
    headers,
    allowedStatuses: [200, 403, 502]
  });
  if (publishPayload?.dryRun || publishPayload?.ok) {
    pass('publish issue flow');
  } else if (publishPayload?.publishedIssue?.url) {
    pass('publish live issue');
  } else if (publishPayload?.error) {
    skip('publish', publishPayload.error);
  }

  await expectJson('POST', `/api/issues/reconcile`, 'issues reconcile', { headers });
}

await expectJson('PATCH', '/api/workspace/runtime', 'runtime continuous off', {
  headers,
  body: { continuousAuditEnabled: false }
});

await expectJson('PATCH', '/api/workspace/runtime', 'runtime continuous on', {
  headers,
  body: { continuousAuditEnabled: true }
});

await expectJson('PATCH', '/api/workspace/policies', 'workspace policies patch', {
  headers,
  body: {
    policies: [{ id: 'transport-ssl', name: 'SSL', description: 'stress', active: true }]
  },
  allowedStatuses: [200, 400]
});

await expectJson('PATCH', '/api/workspace/notifications', 'workspace notifications patch', {
  headers,
  body: { alertEmails: 'ops@example.com', alertSeverity: 'high' },
  allowedStatuses: [200, 400]
});

await expectJson('PATCH', '/api/workspace/llm', 'workspace llm patch', {
  headers,
  body: { temperature: 0.2, maxTokens: 4096 },
  allowedStatuses: [200, 400]
});

await expectJson('PATCH', '/api/workspace/billing', 'workspace billing patch', {
  headers,
  body: { plan: 'free' },
  allowedStatuses: [200, 400, 402, 403]
});

await expectJson('POST', '/api/billing/checkout', 'billing checkout', {
  headers,
  body: { plan: 'pro', interval: 'monthly' },
  allowedStatuses: [200, 400, 502, 503]
});

const stripeWebhook = await fetch(`${WEB_BASE}/api/webhooks/stripe`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'ping' })
});
if ([400, 401, 403, 500].includes(stripeWebhook.status)) {
  pass('stripe webhook rejects unsigned payload');
} else {
  fail('stripe webhook guard', `status ${stripeWebhook.status}`);
}

await expectJson('POST', '/api/audits/run', 'sandbox blocked eval', {
  headers,
  body: { customSnippet: 'eval(userInput);' },
  allowedStatuses: [400]
});

const sandboxPayload = await expectJson('POST', '/api/audits/run', 'sandbox scan', {
  headers,
  body: {
    customSnippet:
      'const q = "SELECT * FROM users WHERE id = " + userId; console.log("pw:", password);'
  }
});
if (sandboxPayload?.success) {
  pass('sandbox findings');
} else {
  fail('sandbox scan', 'no success flag');
}

const registerPayload = await expectJson('POST', '/api/projects', 'register project', {
  headers,
  body: {
    name: `Stress Project ${Date.now()}`,
    repoUrl: `https://gitlab.com/example/stress-${Date.now()}`,
    branch: 'main',
    provider: 'gitlab'
  },
  allowedStatuses: [200, 403]
});
if (registerPayload?.code === 'repo_limit') {
  pass('billing: free plan repo limit enforced');
}

await expectJson('PATCH', '/api/workspace/runtime', 'runtime reset off', {
  headers,
  body: { continuousAuditEnabled: false }
});

const elapsedMs = Math.round(performance.now() - started);
const ok = results.failed.length === 0;

console.log(
  JSON.stringify(
    {
      ok,
      elapsedMs,
      mode: productionMode ? 'production' : fixtureMode ? 'fixture' : 'configured',
      summary: {
        passed: results.passed.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      parallelAuditIds: parallelAudits,
      failures: results.failed,
      skipped: results.skipped
    },
    null,
    2
  )
);

await prisma.$disconnect();

if (!ok) {
  process.exitCode = 1;
}
