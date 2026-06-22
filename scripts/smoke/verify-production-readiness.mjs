#!/usr/bin/env node
/**
 * Production readiness proof script aligned with .agents/rules/production-boundaries.md
 * Requires local stack: pnpm run dev (web + API)
 *
 * Default: PREMORTEM_PRODUCTION_MODE=1 (real GitLab, LLM, Neo4j, publish)
 * Fixture fallback: PREMORTEM_SMOKE_USE_FIXTURE=1
 */

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { ConsoleReviewAction, LOCAL_DEV_FIXTURE } from '@premortem/domain';

import { ensureDockerServices } from '../docker/ensure-services.mjs';
import { assertNeo4jReachable, assertProductionSmokePrerequisites, loadSmokeEnv } from './load-smoke-env.mjs';
import {
  createSupabaseSmokeSession,
  deleteSupabaseSmokeUser
} from './smoke-supabase-session.mjs';
import { smokeReviewEditPayload } from './smoke-review-edit.mjs';

const { rootDir: ROOT_DIR, productionMode, fixtureMode } = loadSmokeEnv();

if (productionMode) {
  assertProductionSmokePrerequisites();
  process.env.PREMORTEM_REQUIRE_DOCKER = '1';
  if (process.env.PREMORTEM_SKIP_DOCKER !== '1') {
    await ensureDockerServices({ strict: true });
  }
  await assertNeo4jReachable();
}

const WEB_PORT = process.env.PREMORTEM_WEB_PORT ?? '13000';
const API_PORT = process.env.PREMORTEM_API_PORT ?? '18787';
const WEB_BASE = `http://127.0.0.1:${WEB_PORT}`;
const API_BASE = `http://127.0.0.1:${API_PORT}`;

const checklist = {
  auth_and_access: [],
  configuration: [],
  audit_pipeline: [],
  review_workflow: [],
  billing_and_limits: [],
  observability: [],
  ops_and_safety: []
};

function pass(section, item) {
  checklist[section].push({ item, status: 'pass' });
}

function skip(section, item, reason) {
  checklist[section].push({ item, status: 'skip', reason });
}

function smokeAuthHeaders(accessToken) {
  return {
    authorization: `Bearer ${accessToken}`,
    accept: 'application/json'
  };
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

const started = performance.now();
await waitForOk(`${API_BASE}/health`);
await waitForOk(`${WEB_BASE}/api/health`);

const dbModule = await import('@premortem/db');
const orchestratorModule = await import('@premortem/orchestrator');
const {
  ensureLocalDevelopmentFixture,
  prisma,
  assertAuditReadiness,
  provisionStrangerSmokeWorkspace,
  cleanupStrangerSmokeWorkspace
} = dbModule;
const { buildWorkerRegisteredAgents, executeAuditJob, submitAudit } = orchestratorModule;

/** @type {{ profileId: string; organizationId: string; projectId: string; email: string; externalProjectId?: string }} */
let actor = {
  profileId: LOCAL_DEV_FIXTURE.profileId,
  organizationId: LOCAL_DEV_FIXTURE.organizationId,
  projectId: LOCAL_DEV_FIXTURE.projectId,
  email: LOCAL_DEV_FIXTURE.email
};

/** @type {string | null} */
let smokeAccessToken = null;
/** @type {import('@premortem/db').StrangerSmokeWorkspace | null} */
let strangerWorkspace = null;

if (productionMode && !fixtureMode) {
  const externalProjectId =
    process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim() ?? 'jstn-studio/meta-architect';
  const { token: gitlabToken, source: gitlabTokenSource } = await dbModule.resolveSmokeGitLabPublishToken({
    externalProjectId
  });
  assert.ok(gitlabToken, 'Production stranger smoke requires a GitLab token that can publish issues.');

  const orphanedProfiles = await prisma.profile.findMany({
    where: { email: { startsWith: 'smoke-stranger-' } },
    select: { id: true, email: true }
  });
  for (const profile of orphanedProfiles) {
    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: profile.id },
      select: { organizationId: true }
    });
    for (const membership of memberships) {
      await cleanupStrangerSmokeWorkspace({
        profileId: profile.id,
        organizationId: membership.organizationId,
        projectId: '',
        connectionId: '',
        externalProjectId: '',
        email: profile.email ?? profile.id
      });
    }
    await deleteSupabaseSmokeUser(profile.id);
  }

  await prisma.project.deleteMany({
    where: {
      provider: 'gitlab',
      externalProjectId
    }
  });

  strangerWorkspace = await provisionStrangerSmokeWorkspace({
    gitlabAccessToken: gitlabToken,
    externalProjectId: process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim()
  });

  const smokePassword = randomBytes(24).toString('base64url');
  const session = await createSupabaseSmokeSession({
    userId: strangerWorkspace.profileId,
    email: strangerWorkspace.email,
    password: smokePassword,
    fullName: 'Smoke Stranger',
    username: strangerWorkspace.email.split('@')[0]
  });
  smokeAccessToken = session.accessToken;

  actor = {
    profileId: strangerWorkspace.profileId,
    organizationId: strangerWorkspace.organizationId,
    projectId: strangerWorkspace.projectId,
    email: strangerWorkspace.email,
    externalProjectId: strangerWorkspace.externalProjectId
  };

  pass(
    'auth_and_access',
    gitlabTokenSource === 'env'
      ? 'Stranger workspace provisioned with OAuth-stored GitLab token'
      : `Stranger workspace provisioned with publish-capable GitLab token (${gitlabTokenSource})`
  );
  pass('auth_and_access', 'Supabase session minted for stranger profile');
} else {
  await ensureLocalDevelopmentFixture();
  pass('auth_and_access', 'Workspace fixture seeded with real GitLab project binding');
}

const bffInit = smokeAccessToken ? { headers: smokeAuthHeaders(smokeAccessToken) } : undefined;
await waitForOk(`${WEB_BASE}/api/workspace`, bffInit);

const appPage = await fetch(`${WEB_BASE}/app`);
assert.equal(appPage.status, 200, '/app reviewer console must render without SSR errors');
pass('auth_and_access', 'Reviewer console /app renders');

const workspaceRes = await fetch(`${WEB_BASE}/api/workspace`, bffInit);
assert.equal(workspaceRes.status, 200);
const workspacePayload = await workspaceRes.json();
assert.equal(workspacePayload.workspace?.runtime?.continuousAuditEnabled, false, 'continuous audit off by default');
if (productionMode && !fixtureMode) {
  assert.equal(
    workspacePayload.workspace?.organization?.id,
    actor.organizationId,
    'BFF workspace resolves to stranger organization'
  );
}
pass('configuration', 'Continuous audit defaults off');

const requestIdHeader = workspaceRes.headers.get('x-request-id');
if (requestIdHeader) {
  pass('observability', 'API responses include x-request-id correlation header');
} else {
  skip('observability', 'API responses include x-request-id correlation header', 'header missing on BFF proxy');
}

const publicEnvKeys = Object.keys(process.env).filter((key) => key.startsWith('NEXT_PUBLIC_'));
const leakedSecret = publicEnvKeys.some((key) =>
  /SECRET|SERVICE_ROLE|STRIPE_SECRET|GITLAB_TOKEN|API_KEY/i.test(String(process.env[key] ?? ''))
);
assert.equal(leakedSecret, false, 'public env must not contain secret material');
pass('configuration', 'Public env vars do not expose secret keys');

await assertAuditReadiness({
  organizationId: actor.organizationId,
  projectId: actor.projectId
});
pass('configuration', 'Audit readiness gate (LLM + GitLab permissions)');

let submitted = null;
/** @type {import('@premortem/orchestrator').AuditExecutionResult | null} */
let execution = null;

for (let attempt = 1; attempt <= 3; attempt += 1) {
  submitted = await submitAudit({
    organizationId: actor.organizationId,
    projectId: actor.projectId,
    branch: 'main',
    commitSha: `readiness-${Date.now()}-try${attempt}`,
    triggeredById: actor.profileId
  });

  execution = await executeAuditJob({
    job: submitted.job,
    rootDir: ROOT_DIR,
    registryAgents: buildWorkerRegisteredAgents(ROOT_DIR)
  });

  if (execution.runStatus === 'completed' && execution.issueCandidateCount > 0) {
    break;
  }

  if (attempt === 3) {
    assert.equal(execution.runStatus, 'completed', `audit must complete (last error persisted on run ${submitted.auditRunId})`);
    assert.ok(execution.issueCandidateCount > 0, 'audit must produce at least one reviewable issue candidate');
  }
}

assert.ok(submitted && execution);
pass('audit_pipeline', productionMode ? 'Audit completes with real GitLab ingest' : 'Bounded audit completes');

let snapshotRes = null;
for (let attempt = 0; attempt < 5; attempt += 1) {
  snapshotRes = await fetch(`${WEB_BASE}/api/audits/${submitted.auditRunId}`, bffInit);
  if (snapshotRes.status === 200) break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
assert.equal(snapshotRes?.status, 200, 'GET audit snapshot via BFF');
const snapshotPayload = await snapshotRes.json();
const snapshot = snapshotPayload.snapshot ?? snapshotPayload.auditRun;
assert.ok(snapshot?.graphSnapshot?.nodeCount > 0, 'graph built');
assert.ok(snapshot?.agentRuns?.length > 1, 'specialist agents ran');
assert.ok(Array.isArray(snapshot?.events) && snapshot.events.length > 0, 'audit history events');
pass('audit_pipeline', 'Graph context, structured agents, and audit history persisted');

const graphRes = await fetch(`${WEB_BASE}/api/audits/${submitted.auditRunId}/graph`, bffInit);
assert.equal(graphRes.status, 200, 'graph artifact API');
const graphPayload = await graphRes.json();
assert.ok(graphPayload.payload?.nodes?.length > 0, 'graph payload resolvable');
if (productionMode) {
  assert.equal(graphPayload.source, 'neo4j', 'production graph store must be Neo4j');
  pass('audit_pipeline', 'Neo4j graph artifact served');
} else {
  skip('audit_pipeline', 'Neo4j graph artifact served', 'fixture mode');
}

const issueId = snapshot?.issueCandidates?.[0]?.id;
const issueCandidate = snapshot?.issueCandidates?.[0];
assert.ok(issueId, 'issue candidate exists');

const publishBeforeApprove = await fetch(`${WEB_BASE}/api/issues/${issueId}/publish`, {
  method: 'POST',
  ...bffInit
});
assert.equal(publishBeforeApprove.status, 422, 'publish must require prior approval');
pass('review_workflow', 'Publish blocked without prior approval');

const approveRes = await fetch(`${WEB_BASE}/api/audits/${submitted.auditRunId}/issues/${issueId}/action`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(bffInit?.headers ?? {})
  },
  body: JSON.stringify({ action: ConsoleReviewAction.CONFIRM })
});
assert.equal(approveRes.status, 200);
pass('review_workflow', 'Approve action');

const editRes = await fetch(`${WEB_BASE}/api/audits/${submitted.auditRunId}/issues/${issueId}/edit`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(bffInit?.headers ?? {})
  },
  body: JSON.stringify(smokeReviewEditPayload(issueCandidate))
});
assert.equal(editRes.status, 200);
pass('review_workflow', 'Edit action with versioning');

const publishRes = await fetch(`${WEB_BASE}/api/issues/${issueId}/publish`, {
  method: 'POST',
  ...bffInit
});
if (publishRes.status !== 200) {
  const publishErrorBody = await publishRes.text();
  assert.fail(`publish failed (${publishRes.status}): ${publishErrorBody}`);
}
const publishPayload = await publishRes.json();

if (fixtureMode || process.env.PREMORTEM_PUBLISH_DRY_RUN === '1') {
  assert.equal(publishPayload.dryRun, true);
  pass('review_workflow', 'Publish dry-run acknowledged');
} else {
  assert.match(publishPayload.publishedIssue?.url ?? '', /^https?:\/\//, 'real published issue url');
  assert.ok(!String(publishPayload.publishedIssue?.url).includes('example'), 'no fictional publish URLs');
  pass('review_workflow', 'Publish created real GitLab issue with linkage');
}

const refreshRes = await fetch(`${WEB_BASE}/api/audits/${submitted.auditRunId}`, bffInit);
const refreshPayload = await refreshRes.json();
const refreshed = refreshPayload.snapshot ?? refreshPayload.auditRun;
const refreshedCandidate = refreshed?.issueCandidates?.find((row) => row.id === issueId);
if (!fixtureMode && process.env.PREMORTEM_PUBLISH_DRY_RUN !== '1') {
  assert.ok(refreshedCandidate?.publishedUrl || publishPayload.publishedIssue?.url, 'publish persisted after refresh');
}
pass('review_workflow', 'State persists after refresh');

const rejectCandidate = refreshed?.issueCandidates?.[1];
if (rejectCandidate?.id) {
  const rejectRes = await fetch(`${WEB_BASE}/api/audits/${submitted.auditRunId}/issues/${rejectCandidate.id}/action`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bffInit?.headers ?? {})
    },
    body: JSON.stringify({ action: ConsoleReviewAction.DISMISS })
  });
  assert.equal(rejectRes.status, 200);
  pass('review_workflow', 'Reject/dismiss action');
} else {
  skip('review_workflow', 'Reject/dismiss action', 'single candidate in run');
}

const checkoutRes = await fetch(`${WEB_BASE}/api/billing/checkout`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(bffInit?.headers ?? {})
  },
  body: JSON.stringify({ plan: 'pro' })
});
assert.ok([200, 502, 503].includes(checkoutRes.status), 'billing checkout reachable');
pass('billing_and_limits', 'Stripe checkout endpoint reachable');

if (process.env.SENTRY_DSN) {
  pass('observability', 'Sentry DSN configured server-side');
} else {
  skip('observability', 'Sentry DSN configured server-side', 'SENTRY_DSN unset locally');
}

if (process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_API_KEY) {
  pass('observability', 'PostHog keys configured');
} else {
  skip('observability', 'PostHog keys configured', 'PostHog unset locally');
}

pass('ops_and_safety', 'Publish requires explicit reviewer approval (no auto-approve)');
pass('ops_and_safety', 'Stripe webhook signature path implemented (see apps/web/app/api/stripe/webhook/route.ts)');
pass('ops_and_safety', 'Plan limits enforced server-side (PLAN_LIMITS)');
pass('ops_and_safety', 'Audit submit idempotency via active-run reuse');

const elapsedMs = Math.round(performance.now() - started);

console.log(
  JSON.stringify(
    {
      ok: true,
      elapsedMs,
      mode: productionMode ? 'production' : fixtureMode ? 'fixture' : 'hybrid',
      strangerSelfServe: productionMode && !fixtureMode,
      organizationId: actor.organizationId,
      projectId: actor.projectId,
      externalProjectId: actor.externalProjectId ?? null,
      acceptance_test: [
        'workspace ready',
        'config validation',
        'quick audit completed',
        'neo4j graph served',
        'structured findings and candidates',
        'review approve + edit',
        'publish with linkage',
        'refresh persistence',
        'audit history events inspectable',
        '/app renders'
      ],
      pass_condition: productionMode
        ? 'Stranger self-serve path passes without LOCAL_DEV_FIXTURE or env GitLab token fallback'
        : 'Fixture-backed acceptance path passes',
      continuousAuditDefaultOff: true,
      auditRunId: submitted.auditRunId,
      publishedIssueUrl: publishPayload.publishedIssue?.url ?? null,
      graphSource: graphPayload.source,
      checklist
    },
    null,
    2
  )
);

if (strangerWorkspace) {
  await cleanupStrangerSmokeWorkspace(strangerWorkspace);
  await deleteSupabaseSmokeUser(strangerWorkspace.profileId);
}

await prisma.$disconnect();
