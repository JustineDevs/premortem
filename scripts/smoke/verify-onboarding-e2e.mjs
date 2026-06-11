#!/usr/bin/env node
/**
 * End-to-end onboarding + operations stress smoke.
 * Requires local stack: pnpm run dev (web + API).
 *
 * Covers marketing pages, auth entrypoints, parallel audits, workspace/billing BFF,
 * and reviewer actions.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConsoleReviewAction, LOCAL_DEV_FIXTURE } from '@premortem/domain';

import { loadSmokeEnv } from './load-smoke-env.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadSmokeEnv();

const WEB_PORT = process.env.PREMORTEM_WEB_PORT ?? '13000';
const API_PORT = process.env.PREMORTEM_API_PORT ?? '18787';
const WEB_BASE = `http://127.0.0.1:${WEB_PORT}`;
const API_BASE = `http://127.0.0.1:${API_PORT}`;

async function waitForOk(url, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function expectHtmlRoute(pathname, label) {
  const response = await fetch(`${WEB_BASE}${pathname}`);
  assert.equal(response.status, 200, `${label} ${pathname}`);
  const html = await response.text();
  assert.ok(html.includes('<!DOCTYPE html') || html.includes('<html'), `${label} html shell`);
}

const started = performance.now();
await waitForOk(`${API_BASE}/api/projects`);
await waitForOk(`${WEB_BASE}/api/projects`);

const marketingRoutes = [
  '/',
  '/products',
  '/solutions',
  '/how-it-works',
  '/login',
  '/signup',
  '/docs',
  '/privacy',
  '/terms'
];

for (const route of marketingRoutes) {
  await expectHtmlRoute(route, 'marketing');
}

const authGitLab = await fetch(`${WEB_BASE}/api/auth/gitlab?mode=signup&next=/app`, {
  redirect: 'manual'
});
assert.ok([302, 307].includes(authGitLab.status), 'GitLab auth redirect');

const authGitHub = await fetch(`${WEB_BASE}/api/auth/github?mode=signup&next=/app`, {
  redirect: 'manual'
});
assert.ok([302, 307].includes(authGitHub.status), 'GitHub auth redirect');

const dbModule = await import('@premortem/db');
const orchestratorModule = await import('@premortem/orchestrator');
const { ensureLocalDevelopmentFixture, prisma } = dbModule;
const { buildWorkerRegisteredAgents, executeAuditJob, submitAudit } = orchestratorModule;

await ensureLocalDevelopmentFixture();

const parallelAudits = await Promise.all(
  [0, 1, 2].map(async (index) => {
    const submitted = await submitAudit({
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      projectId: LOCAL_DEV_FIXTURE.projectId,
      branch: 'main',
      commitSha: `e2e-stress-${Date.now()}-${index}`,
      triggeredById: LOCAL_DEV_FIXTURE.profileId
    });

    await executeAuditJob({
      job: submitted.job,
      rootDir: ROOT_DIR,
      registryAgents: buildWorkerRegisteredAgents()
    });

    return submitted.auditRunId;
  })
);

assert.equal(parallelAudits.length, 3, 'parallel audit count');

for (const auditRunId of parallelAudits) {
  const snapshotRes = await fetch(`${WEB_BASE}/api/audits/${auditRunId}`);
  assert.equal(snapshotRes.status, 200, `snapshot ${auditRunId}`);
  const payload = await snapshotRes.json();
  assert.ok(payload.snapshot?.graphSnapshot?.nodeCount > 0, 'graph nodes');
  assert.ok(payload.snapshot?.agentRuns?.length > 1, 'agent runs');
}

const workspaceRes = await fetch(`${WEB_BASE}/api/workspace`);
assert.equal(workspaceRes.status, 200, 'workspace');
const workspace = await workspaceRes.json();
assert.ok(workspace.workspace?.organization?.name, 'workspace org');
assert.equal(
  workspace.workspace?.runtime?.continuousAuditEnabled,
  false,
  'continuous audit off by default'
);

const checkoutRes = await fetch(`${WEB_BASE}/api/billing/checkout`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ plan: 'pro' })
});
assert.ok([200, 502, 503].includes(checkoutRes.status), 'billing checkout reachable');

const lastAuditId = parallelAudits.at(-1);
assert.ok(lastAuditId, 'last audit id');
const snapshotRes = await fetch(`${WEB_BASE}/api/audits/${lastAuditId}`);
const snapshotPayload = await snapshotRes.json();
const issueId = snapshotPayload.snapshot?.issueCandidates?.[0]?.id;

if (issueId) {
  const approveRes = await fetch(
    `${WEB_BASE}/api/audits/${lastAuditId}/issues/${issueId}/action`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: ConsoleReviewAction.CONFIRM })
    }
  );
  assert.equal(approveRes.status, 200, 'approve issue');

  const editRes = await fetch(`${WEB_BASE}/api/audits/${lastAuditId}/issues/${issueId}/edit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'E2E stress edited title' })
  });
  assert.equal(editRes.status, 200, 'edit issue');

  const publishRes = await fetch(`${WEB_BASE}/api/issues/${issueId}/publish`, { method: 'POST' });
  assert.equal(publishRes.status, 200, 'publish issue');
  const publishPayload = await publishRes.json();
  if (process.env.PREMORTEM_PUBLISH_DRY_RUN === '1') {
    assert.equal(publishPayload.dryRun, true, 'publish dry-run');
  } else {
    assert.match(publishPayload.publishedIssue?.url ?? '', /^https?:\/\//, 'published issue url');
    const refreshRes = await fetch(`${WEB_BASE}/api/audits/${lastAuditId}`);
    const refreshPayload = await refreshRes.json();
    assert.ok(
      refreshPayload.snapshot?.issueCandidates?.some(
        (row) => row.id === issueId && (row.publishedUrl || publishPayload.publishedIssue?.url)
      ),
      'publish persisted after refresh'
    );
  }
}

const blockedSandboxRes = await fetch(`${WEB_BASE}/api/audits/run`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    customSnippet: 'const token = process.env.API_KEY; eval(userInput);'
  })
});
assert.equal(blockedSandboxRes.status, 400, 'sandbox guardrail blocks eval snippet');

const sandboxRes = await fetch(`${WEB_BASE}/api/audits/run`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    customSnippet:
      'const q = "SELECT * FROM users WHERE id = " + userId; console.log("pw:", password);'
  })
});
assert.equal(sandboxRes.status, 200, 'sandbox scan');
const sandboxPayload = await sandboxRes.json();
assert.equal(sandboxPayload.success, true, 'sandbox success');

const elapsedMs = Math.round(performance.now() - started);

console.log(
  JSON.stringify(
    {
      ok: true,
      elapsedMs,
      webBase: WEB_BASE,
      marketingRoutes: marketingRoutes.length,
      parallelAuditIds: parallelAudits,
      workspacePlan: workspace.workspace?.billing?.plan ?? null,
      sandboxFindingCount: sandboxPayload.audit?.findings?.length ?? 0,
      approvedIssueId: issueId ?? null,
      continuousAuditDefaultOff: workspace.workspace?.runtime?.continuousAuditEnabled === false
    },
    null,
    2
  )
);

await prisma.$disconnect();
