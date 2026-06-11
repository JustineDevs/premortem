import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const absolutePath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(absolutePath)) continue;

    const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      const value = rawValue.replace(/^"/, '').replace(/"$/, '');
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

async function importBuiltModule(candidates) {
  for (const candidate of candidates) {
    const absolutePath = path.resolve(ROOT_DIR, candidate);
    if (fs.existsSync(absolutePath)) {
      return import(pathToFileURL(absolutePath).href);
    }
  }

  throw new Error(`Unable to resolve built module from candidates:\n${candidates.join('\n')}`);
}

const apiModule = await importBuiltModule([
  'apps/api/dist/apps/api/src/index.js',
  'apps/api/dist/src/index.js'
]);
const routerModule = await importBuiltModule([
  'apps/api/dist/apps/api/src/lib/router.js',
  'apps/api/dist/src/lib/router.js'
]);
const dbModule = await importBuiltModule([
  'packages/db/dist/index.js',
  'packages/db/dist/src/index.js'
]);
const orchestratorModule = await importBuiltModule([
  'services/orchestrator/dist/services/orchestrator/src/index.js',
  'services/orchestrator/dist/src/index.js'
]);
const dashboardApiModule = await importBuiltModule([
  'apps/dashboard/dist/apps/dashboard/src/lib/audit-api.js',
  'apps/dashboard/dist/src/lib/audit-api.js'
]);
const dashboardRenderModule = await importBuiltModule([
  'apps/dashboard/dist/apps/dashboard/src/components/audit-detail-page.js',
  'apps/dashboard/dist/src/components/audit-detail-page.js'
]);
const dashboardHomeModule = await importBuiltModule([
  'apps/dashboard/dist/apps/dashboard/src/components/dashboard-home-page.js',
  'apps/dashboard/dist/src/components/dashboard-home-page.js'
]);
const landingPageModule = await importBuiltModule([
  'apps/dashboard/dist/apps/dashboard/src/components/landing-page.js',
  'apps/dashboard/dist/src/components/landing-page.js'
]);

const { default: workerEntrypoint, handleAuditQueue } = apiModule;
const { appRouter } = routerModule;
const { prisma } = dbModule;
const { buildWorkerRegisteredAgents } = orchestratorModule;
const { loadAuditRunSnapshot, loadRecentAuditRuns } = dashboardApiModule;
const { renderAuditDetailHtml } = dashboardRenderModule;
const { renderDashboardHomeHtml } = dashboardHomeModule;
const { renderLandingPageHtml } = landingPageModule;

const FIXTURE = {
  profileId: '7f9458c3-1b8d-4f4d-a6e4-9f2333b3d821',
  organizationId: 'd86ad1f2-c720-4f54-8584-9e953dd527cb',
  projectId: 'f28e9bd2-5673-45d2-a97f-55a0b174e751',
  email: 'smoke-runner@premortem.local',
  username: 'premortem-smoke',
  organizationSlug: 'jstn-studio-local',
  projectSlug: 'meta-architect'
};

const GITLAB_EXTERNAL_PROJECT_ID =
  process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim() || 'jstn-studio/meta-architect';

function createFakeQueue() {
  const jobs = [];

  return {
    binding: {
      async send(job) {
        jobs.push(job);
      }
    },
    takeOne() {
      assert.equal(jobs.length, 1, `expected exactly one queued job, found ${jobs.length}`);
      return jobs.shift();
    }
  };
}

function createQueueMessage(job) {
  let acked = false;
  let retryOptions = null;

  return {
    body: job,
    attempts: job.attempt,
    ack() {
      acked = true;
    },
    retry(options) {
      retryOptions = options ?? {};
    },
    getState() {
      return {
        acked,
        retried: retryOptions !== null,
        retryOptions
      };
    }
  };
}

function createAppFetch(env) {
  return async function fetchImpl(input, init = {}) {
    const request = input instanceof Request ? input : new Request(input, init);
    return appRouter(request, env);
  };
}

function buildRegistryWithRejectedArtifact() {
  return buildWorkerRegisteredAgents().map((agent) => {
    if (agent.name !== 'finding_synthesizer_agent' || agent.executor.kind !== 'synthesizer') {
      return agent;
    }

    return {
      ...agent,
      executor: {
        kind: 'synthesizer',
        run: async (context, findings) => {
          const issues = await agent.executor.run(context, findings);
          return [
            ...issues,
            {
              title: 'Generic deployment concern',
              category: 'release_safety',
              severity: 'high',
              confidence: 0.91,
              predicted_failure_summary: 'A deployment could fail without a strong recovery story.',
              why_it_matters: 'The failure surface is broad but this artifact is intentionally under-specified.',
              trigger_conditions: ['A deployment starts'],
              evidence: [
                {
                  kind: 'file',
                  ref: 'README.md',
                  reason: 'Single evidence ref to force validation failure in smoke coverage.'
                }
              ],
              recommended_action_summary: 'Tighten release controls.',
              implementation_steps: ['Add one control'],
              done_criteria: ['Check one control'],
              affected_assets: ['production'],
              source_agents: ['release_safety_agent'],
              source_findings: findings.length > 0 ? [findings[0].finding_id] : []
            }
          ];
        }
      }
    };
  });
}

async function ensureFixture() {
  await prisma.profile.upsert({
    where: { id: FIXTURE.profileId },
    update: {
      email: FIXTURE.email,
      username: FIXTURE.username,
      fullName: 'Local Dev Operator'
    },
    create: {
      id: FIXTURE.profileId,
      email: FIXTURE.email,
      username: FIXTURE.username,
      fullName: 'Local Dev Operator'
    }
  });

  await prisma.organization.upsert({
    where: { id: FIXTURE.organizationId },
    update: {
      name: 'Premortem Local Dev',
      slug: FIXTURE.organizationSlug,
      createdById: FIXTURE.profileId
    },
    create: {
      id: FIXTURE.organizationId,
      name: 'Premortem Local Dev',
      slug: FIXTURE.organizationSlug,
      createdById: FIXTURE.profileId
    }
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: FIXTURE.organizationId,
        userId: FIXTURE.profileId
      }
    },
    update: { role: 'owner' },
    create: {
      organizationId: FIXTURE.organizationId,
      userId: FIXTURE.profileId,
      role: 'owner'
    }
  });

  await prisma.project.upsert({
    where: { id: FIXTURE.projectId },
    update: {
      organizationId: FIXTURE.organizationId,
      provider: 'gitlab',
      externalProjectId: GITLAB_EXTERNAL_PROJECT_ID,
      name: GITLAB_EXTERNAL_PROJECT_ID.split('/').pop() ?? 'meta-architect',
      slug: FIXTURE.projectSlug,
      defaultBranch: 'main',
      createdById: FIXTURE.profileId
    },
    create: {
      id: FIXTURE.projectId,
      organizationId: FIXTURE.organizationId,
      provider: 'gitlab',
      externalProjectId: GITLAB_EXTERNAL_PROJECT_ID,
      name: GITLAB_EXTERNAL_PROJECT_ID.split('/').pop() ?? 'meta-architect',
      slug: FIXTURE.projectSlug,
      defaultBranch: 'main',
      createdById: FIXTURE.profileId
    }
  });
}

async function submitAudit(commitSha) {
  const queue = createFakeQueue();
  const env = { AUDIT_QUEUE: queue.binding };
  const request = new Request('http://premortem.local/api/audits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationId: FIXTURE.organizationId,
      projectId: FIXTURE.projectId,
      branch: 'main',
      commitSha,
      triggeredById: FIXTURE.profileId
    })
  });

  const response = await workerEntrypoint.fetch(request, env, {});
  assert.equal(response.status, 202);
  const payload = await response.json();
  assert.equal(payload.runStatus, 'queued');
  assert.ok(payload.auditRunId);
  assert.ok(payload.job);

  return {
    env,
    queue,
    submission: payload
  };
}

async function readAudit(env, auditRunId) {
  const response = await appRouter(new Request(`http://premortem.local/api/audits/${auditRunId}`, { method: 'GET' }), env);
  assert.equal(response.status, 200);
  return response.json();
}

async function runQueuedAudit({ env, queue, submission, registryAgents }) {
  const job = queue.takeOne();
  const message = createQueueMessage(job);

  await handleAuditQueue(
    {
      queue: 'premortem-audit-jobs-dev',
      messages: [message]
    },
    env,
    {},
    registryAgents ? { registryAgents } : undefined
  );

  const messageState = message.getState();
  assert.equal(messageState.acked, true);
  assert.equal(messageState.retried, false);

  return readAudit(env, submission.auditRunId);
}

async function main() {
  await ensureFixture();

  const standardRun = await submitAudit('smoke-main-queue-0001');
  const standardSnapshot = await runQueuedAudit(standardRun);

  assert.equal(standardSnapshot.auditRun.runStatus, 'completed');
  assert.ok(standardSnapshot.auditRun.counts.findings > 0);
  assert.ok(standardSnapshot.auditRun.counts.clusters > 0);
  assert.ok(standardSnapshot.auditRun.counts.issueCandidates > 0);
  assert.equal(standardSnapshot.auditRun.counts.rejectedIssueCandidateArtifacts, 0);

  const rejectedRun = await submitAudit('smoke-main-queue-0002');
  const rejectedSnapshot = await runQueuedAudit({
    ...rejectedRun,
    registryAgents: buildRegistryWithRejectedArtifact()
  });

  assert.equal(rejectedSnapshot.auditRun.runStatus, 'completed');
  assert.ok(rejectedSnapshot.auditRun.counts.issueCandidates > 0);
  assert.ok(rejectedSnapshot.auditRun.counts.rejectedIssueCandidateArtifacts > 0);
  assert.ok(rejectedSnapshot.auditRun.rejectedIssueCandidates.length > 0);

  const eventTypes = rejectedSnapshot.auditRun.events.map((event) => event.eventType);
  for (const required of [
    'audit.enqueued',
    'audit.started',
    'audit.ingestion_completed',
    'audit.graph_built',
    'audit.completed',
    'audit.issue_validation_rejected'
  ]) {
    assert.ok(eventTypes.includes(required), `missing audit event ${required}`);
  }

  assert.ok(rejectedSnapshot.auditRun.graphSnapshot, 'expected graph snapshot on completed audit');
  assert.ok(rejectedSnapshot.auditRun.graphSnapshot.nodeCount > 0, 'expected graph nodes');
  assert.ok(rejectedSnapshot.auditRun.agentRuns.length > 1, 'expected parallel specialist agent runs');
  assert.ok(rejectedSnapshot.auditRun.lineage.length > 0, 'expected lineage entries');

  const fetchImpl = createAppFetch(rejectedRun.env);
  const apiBackedSnapshot = await loadAuditRunSnapshot(rejectedRun.submission.auditRunId, {
    apiBaseUrl: 'http://premortem.local',
    fetchImpl
  });
  const reviewHtml = renderAuditDetailHtml(apiBackedSnapshot);
  const recentAuditRuns = await loadRecentAuditRuns({
    apiBaseUrl: 'http://premortem.local',
    fetchImpl,
    limit: 5
  });
  const dashboardHomeHtml = renderDashboardHomeHtml(recentAuditRuns);
  const landingPageHtml = renderLandingPageHtml();

  assert.match(reviewHtml, /Reviewer Audit Detail/);
  assert.match(reviewHtml, /Rejected Validation Artifacts/);
  assert.match(reviewHtml, /Generic deployment concern/);
  assert.match(dashboardHomeHtml, /Recent audits ready for reviewer triage/);
  assert.match(dashboardHomeHtml, new RegExp(rejectedRun.submission.auditRunId));
  assert.match(landingPageHtml, /Turn repository risk into reviewable, publishable GitLab issues/);
  assert.match(landingPageHtml, /Open Reviewer Console/);
  assert.match(landingPageHtml, /Traceability is the product contract/);

  console.log(
    JSON.stringify(
      {
        standardAuditRunId: standardRun.submission.auditRunId,
        rejectedAuditRunId: rejectedRun.submission.auditRunId,
        runStatus: apiBackedSnapshot.runStatus,
        counts: apiBackedSnapshot.counts,
        eventTypes,
        recentAuditRunIds: recentAuditRuns.map((auditRun) => auditRun.auditRunId),
        renderedAuditDetailBytes: Buffer.byteLength(reviewHtml),
        renderedDashboardHomeBytes: Buffer.byteLength(dashboardHomeHtml),
        renderedLandingPageBytes: Buffer.byteLength(landingPageHtml)
      },
      null,
      2
    )
  );
}

let exitCode = 0;

try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  await prisma.$disconnect();
  process.exit(exitCode);
}
