import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConsoleReviewAction, LOCAL_DEV_FIXTURE } from '../../packages/domain/src/index.ts';
import { loadSmokeEnv } from './load-smoke-env.ts';
import { createSupabaseSmokeSession } from './smoke-supabase-session.ts';
import { smokeReviewEditPayload } from './smoke-review-edit.ts';
import { randomBytes } from 'node:crypto';
import { resolveDevLlmRuntimeState } from '../lib/local-llm-runtime.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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

async function main() {
  console.log('[verify-web-bff] start');
  const { configuredMode, fixtureMode } = loadSmokeEnv();
  if (!configuredMode && !fixtureMode) {
    const { hasRealLlm } = await resolveDevLlmRuntimeState();
    process.env.PREMORTEM_INGEST_LOCAL ??= '1';
    process.env.PREMORTEM_FORCE_LOCAL_INGEST ??= '1';
    process.env.PREMORTEM_EXECUTOR ??= hasRealLlm ? 'llm' : 'mock';
  }
  if (fixtureMode) {
    process.env.PREMORTEM_AUTH_DISABLED ??= '1';
  }

  await waitForOk(`${API_BASE}/health`);
  await waitForOk(`${WEB_BASE}/api/health`);
  console.log('[verify-web-bff] health ready');

  /** @type {Record<string, string>} */
  let bffHeaders = { accept: 'application/json' };

  function bffFetch(path, init = {}) {
    return fetch(`${WEB_BASE}${path}`, {
      ...init,
      headers: {
        ...bffHeaders,
        ...(init.headers ?? {})
      }
    });
  }

  const projectsProbe = await fetch(`${WEB_BASE}/api/projects`, { headers: bffHeaders });
  if (projectsProbe.status === 401) {
    console.log('[verify-web-bff] creating smoke session');
    const password = randomBytes(18).toString('base64url');
    const session = await createSupabaseSmokeSession({
      userId: LOCAL_DEV_FIXTURE.profileId,
      email: LOCAL_DEV_FIXTURE.email,
      password,
      fullName: 'BFF Smoke',
      username: 'bff-smoke'
    });
    bffHeaders = {
      accept: 'application/json',
      authorization: `Bearer ${session.accessToken}`
    };
  }
  console.log('[verify-web-bff] auth ready');

  const projectsRes = await bffFetch('/api/projects');
  if (projectsRes.status !== 200) {
    console.error('[verify-web-bff] /api/projects body', await projectsRes.text());
  }
  assert.equal(projectsRes.status, 200, 'GET /api/projects');
  const projectsPayload = (await projectsRes.json()) as {
    projects?: Array<{ id: string }>;
    nextCursor?: string | null;
  };
  assert.ok(Array.isArray(projectsPayload.projects) && projectsPayload.projects.length > 0, 'projects list');

  const auditsRes = await bffFetch(`/api/audits`);
  assert.equal(auditsRes.status, 200, 'GET /api/audits');
  const auditsPayload = (await auditsRes.json()) as {
    auditRuns?: Array<{ id: string }>;
  };
  assert.ok(Array.isArray(auditsPayload.auditRuns), 'audits list');
  console.log('[verify-web-bff] project and audit lists loaded');

  const dbModule = await import('../../packages/db/src/index.ts');
  const orchestratorModule = await import('../../services/orchestrator/src/index.ts');

  const { pauseAuditRun, prisma } = dbModule;
  const { ensureLocalDevelopmentFixture } = await import('../../packages/db/src/dev-fixtures.ts');
  const { buildWorkerRegisteredAgents, executeAuditJob, submitAudit } = orchestratorModule;

  await ensureLocalDevelopmentFixture();
  console.log('[verify-web-bff] fixture ensured');

  console.log('[verify-web-bff] submitting audit');
  const submitted = await submitAudit({
    organizationId: LOCAL_DEV_FIXTURE.organizationId,
    projectId: LOCAL_DEV_FIXTURE.projectId,
    branch: 'main',
    commitSha: `web-bff-${Date.now()}`,
    triggeredById: LOCAL_DEV_FIXTURE.profileId
  });
  console.log('[verify-web-bff] audit submitted');

  console.log('[verify-web-bff] executing audit');
  await executeAuditJob({
    job: submitted.job,
    rootDir: ROOT_DIR,
    registryAgents: buildWorkerRegisteredAgents(ROOT_DIR)
  });
  console.log('[verify-web-bff] audit executed');

  const snapshotRes = await bffFetch(`/api/audits/${submitted.auditRunId}`);
  assert.equal(snapshotRes.status, 200, 'GET /api/audits/:id snapshot');
  const snapshotPayload = await snapshotRes.json();
  assert.ok(snapshotPayload.snapshot, 'snapshot payload');
  assert.ok(snapshotPayload.snapshot.graphSnapshot?.nodeCount > 0, 'graph snapshot in BFF');
  assert.ok(snapshotPayload.snapshot.agentRuns?.length > 1, 'parallel agent runs in BFF');
  assert.ok(snapshotPayload.snapshot.lineage?.length > 0, 'lineage in BFF');
  console.log('[verify-web-bff] snapshot verified');

  const pauseRes = await bffFetch(`/api/audits/${submitted.auditRunId}/pause`, {
  method: 'POST'
});
  assert.equal(pauseRes.status, 400, 'pause completed audit should fail');

  const pauseQueued = await submitAudit({
    organizationId: LOCAL_DEV_FIXTURE.organizationId,
    projectId: LOCAL_DEV_FIXTURE.projectId,
    branch: `pause-resume-${Date.now()}`,
    commitSha: `pause-${Date.now()}`,
    triggeredById: LOCAL_DEV_FIXTURE.profileId
  });

  await pauseAuditRun(pauseQueued.auditRunId, 'smoke pause before execution');
  console.log('[verify-web-bff] pause applied');
  const pausedRes = await bffFetch(`/api/audits/${pauseQueued.auditRunId}`);
  const pausedPayload = await pausedRes.json();
  assert.equal(pausedPayload.snapshot?.runStatus, 'paused', 'paused audit snapshot');
  assert.ok(pausedPayload.snapshot?.summary?.checkpoint?.phase, 'checkpoint saved on pause');

  const resumeRes = await bffFetch(`/api/audits/${pauseQueued.auditRunId}/resume`, {
  method: 'POST'
});
  assert.equal(resumeRes.status, 202, 'POST /api/audits/:id/resume');
  const resumePayload = await resumeRes.json();
  assert.equal(resumePayload.ok, true, 'resume ok');
  console.log('[verify-web-bff] resume requested');

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const resumedSnapshotRes = await bffFetch(`/api/audits/${pauseQueued.auditRunId}`);
  const resumedSnapshot = await resumedSnapshotRes.json();
  assert.ok(
    ['running', 'completed', 'queued'].includes(resumedSnapshot.snapshot?.runStatus),
    'resumed audit progressed'
  );
  console.log('[verify-web-bff] resume progressed');

  const workspaceRes = await bffFetch(`/api/workspace`);
  assert.equal(workspaceRes.status, 200, 'GET /api/workspace');
  const workspacePayload = await workspaceRes.json();
  assert.ok(workspacePayload.workspace?.organization?.name, 'workspace organization');
  assert.ok(Array.isArray(workspacePayload.workspace?.integrations), 'workspace integrations');
  assert.ok(Array.isArray(workspacePayload.workspace?.policies), 'workspace policies');
  assert.equal(workspacePayload.workspace?.usage?.scans?.limit, 100, 'business-model audit quota');
  assert.equal(workspacePayload.workspace?.billing?.canPublish, true, 'pro plan can publish');
  assert.equal(workspacePayload.workspace?.usage?.repos?.limit, 10, 'starter repo limit');
  if (workspacePayload.workspace?.runtime?.continuousAuditEnabled !== false) {
    const normalizeRuntimeRes = await bffFetch(`/api/workspace/runtime`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ continuousAuditEnabled: false })
    });
    assert.equal(normalizeRuntimeRes.status, 200, 'PATCH /api/workspace/runtime normalize off');
    const normalizedWorkspaceRes = await bffFetch(`/api/workspace`);
    const normalizedWorkspacePayload = await normalizedWorkspaceRes.json();
    assert.equal(
      normalizedWorkspacePayload.workspace?.runtime?.continuousAuditEnabled,
      false,
      'continuous audit normalized off'
    );
  } else {
    assert.equal(
      workspacePayload.workspace?.runtime?.continuousAuditEnabled,
      false,
      'continuous audit defaults off'
    );
  }
  console.log('[verify-web-bff] workspace verified');

const runtimeOffRes = await bffFetch(`/api/workspace/runtime`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ continuousAuditEnabled: false })
});
  assert.equal(runtimeOffRes.status, 200, 'PATCH /api/workspace/runtime off');
const runtimeOffPayload = await runtimeOffRes.json();
assert.equal(runtimeOffPayload.ok, true, 'runtime patch off ok');

const runtimeOnRes = await bffFetch(`/api/workspace/runtime`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ continuousAuditEnabled: true })
});
  assert.equal(runtimeOnRes.status, 200, 'PATCH /api/workspace/runtime on');

const workspaceAfterRes = await bffFetch(`/api/workspace`);
const workspaceAfterPayload = await workspaceAfterRes.json();
  assert.equal(
    workspaceAfterPayload.workspace?.runtime?.continuousAuditEnabled,
    true,
    'continuous audit enabled in workspace bundle'
  );
  console.log('[verify-web-bff] runtime toggled');

const workItemAttrRes = await bffFetch(`/api/workspace/work-item-attributes`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    workItemAttributes: {
      autoApply: true,
      labelPrefix: 'premortem',
      includeSeverity: true,
      includeCategory: true,
      includePriority: true,
      includeAuditRef: true,
      includeConfidenceBand: true,
      gitlab: { ensureProjectLabels: true },
      github: { ensureRepositoryLabels: true }
    }
  })
});
  assert.equal(workItemAttrRes.status, 200, 'PATCH /api/workspace/work-item-attributes');

const workspaceAttrsRes = await bffFetch(`/api/workspace`);
const workspaceAttrsPayload = await workspaceAttrsRes.json();
  assert.equal(
    workspaceAttrsPayload.workspace?.workItemAttributes?.autoApply,
    true,
    'work item attributes persisted'
  );
  console.log('[verify-web-bff] work item attributes verified');

const reconcileRes = await bffFetch(`/api/issues/reconcile`, { method: 'POST' });
  assert.equal(reconcileRes.status, 200, 'POST /api/issues/reconcile');
const reconcilePayload = await reconcileRes.json();
assert.equal(reconcilePayload.ok, true, 'reconcile ok');

const corsOrigin = (process.env.CORS_ORIGIN ?? 'https://premortem.jstn.site').replace(/\/$/, '');
process.env.CORS_ORIGIN = corsOrigin;
const preflightRequest = new Request(`${WEB_BASE}/api/workspace`, {
  method: 'OPTIONS',
  headers: {
    Origin: corsOrigin,
    'Access-Control-Request-Method': 'GET'
  }
});
const preflightResponse = await fetch(preflightRequest);
assert.equal(preflightResponse.status, 204, 'CORS preflight handler');
  assert.equal(
    preflightResponse.headers.get('access-control-allow-origin'),
    corsOrigin,
    'CORS allow origin'
  );
  console.log('[verify-web-bff] cors verified');

const issueId = snapshotPayload.snapshot.issueCandidates?.[0]?.id;
const issueCandidate = snapshotPayload.snapshot.issueCandidates?.[0];
  if (issueId) {
  const approveRes = await bffFetch(
    `/api/audits/${submitted.auditRunId}/issues/${issueId}/action`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: ConsoleReviewAction.CONFIRM })
    }
  );
  assert.equal(approveRes.status, 200, 'POST approve issue');

  const editRes = await bffFetch(
    `/api/audits/${submitted.auditRunId}/issues/${issueId}/edit`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(smokeReviewEditPayload(issueCandidate))
    }
  );
    assert.equal(editRes.status, 200, 'POST edit issue');
  }
  console.log('[verify-web-bff] review workflow verified');

const hydratedRes = await bffFetch(`/api/audits?hydrate=1&limit=3`);
assert.equal(hydratedRes.status, 200, 'GET /api/audits?hydrate=1');
const hydratedPayload = await hydratedRes.json();
const hydratedAudits = hydratedPayload.auditRuns ?? hydratedPayload.audits;
assert.ok(Array.isArray(hydratedAudits), 'hydrated audits array');
assert.ok(
  hydratedAudits.some((audit) => typeof audit.findingCount === 'number' && typeof audit.latestEventType === 'string'),
  'hydrated audits include summary counts and latest event'
);
  console.log('[verify-web-bff] hydrated audits verified');

const sandboxRes = await bffFetch(`/api/audits/sandbox`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    customSnippet: 'const q = "SELECT * FROM users WHERE id = " + userId;'
  })
});
assert.equal(sandboxRes.status, 200, 'POST sandbox scan');
const sandboxPayload = await sandboxRes.json();
assert.equal(sandboxPayload.success, true, 'sandbox success');
assert.ok(Array.isArray(sandboxPayload.findings) && sandboxPayload.findings.length > 0, 'sandbox findings');
  console.log('[verify-web-bff] sandbox audit verified');

const gitlabExternalProjectId =
  process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim() || 'jstn-studio/meta-architect';
const registerRepoUrl =
  process.env.PREMORTEM_INGEST_LOCAL === '1'
    ? `https://gitlab.com/example/smoke-repo-${Date.now()}`
    : `https://gitlab.com/${gitlabExternalProjectId}`;

const registerRes = await bffFetch(`/api/projects`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    name: `Smoke Project ${Date.now()}`,
    repoUrl: registerRepoUrl,
    branch: 'main',
    provider: 'gitlab'
  })
});
assert.equal(registerRes.status, 200, 'POST /api/projects register');
const registered = await registerRes.json();
  assert.ok(registered.id, 'registered project id');
  console.log('[verify-web-bff] project registration verified');

  await bffFetch(`/api/workspace/runtime`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ continuousAuditEnabled: false })
});

  console.log(
  JSON.stringify(
    {
      ok: true,
      webBase: WEB_BASE,
      auditRunId: submitted.auditRunId,
      projectCount: projectsPayload.projects?.length ?? 0,
      auditListCount: auditsPayload.auditRuns?.length ?? 0,
      hydratedAuditCount: hydratedAudits.length,
      sandboxFindingCount: sandboxPayload.findings?.length ?? 0,
      registeredProjectId: registered?.id ?? null,
      reconcileDryRun: reconcilePayload.dryRun ?? false,
      corsOrigin,
      graphNodeCount: snapshotPayload.snapshot.graphSnapshot.nodeCount,
      agentRunCount: snapshotPayload.snapshot.agentRuns.length,
      lineageCount: snapshotPayload.snapshot.lineage.length,
      approvedIssueId: issueId ?? null
    },
    null,
    2
  )
  );
  console.log('[verify-web-bff] complete');

  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
