#!/usr/bin/env node
/**
 * Run one configured-mode audit against GITLAB_EXTERNAL_PROJECT_ID using the
 * real GitLab REST ingest path and LLM executor (no mock ingest).
 */

import { loadSmokeEnv, assertNeo4jReachable } from '../smoke/load-smoke-env.mjs';
import { applyPremortemLocalEnvFileOverrides } from '../load-local-env.mjs';
import { LOCAL_DEV_FIXTURE } from '@premortem/domain';

const { rootDir, configuredMode, fixtureMode } = loadSmokeEnv();
applyPremortemLocalEnvFileOverrides(['GITLAB_EXTERNAL_PROJECT_ID'], rootDir);

if (fixtureMode) {
  console.error('Refusing mock fixture audit. Unset PREMORTEM_SMOKE_USE_FIXTURE.');
  process.exit(1);
}

if (!configuredMode) {
  console.error(
    'Configured credentials required: DATABASE_URL, GITLAB_TOKEN, and GEMINI_API_KEY (or Azure OpenAI).'
  );
  process.exit(1);
}

await assertNeo4jReachable();

const { ensureLocalDevelopmentFixture, prisma } = await import('@premortem/db');
const { buildWorkerRegisteredAgents, executeAuditJob, getAuditRunSnapshot, submitAudit } =
  await import('@premortem/orchestrator');

await ensureLocalDevelopmentFixture();

const project = await prisma.project.findUnique({
  where: { id: LOCAL_DEV_FIXTURE.projectId },
  select: { externalProjectId: true, defaultBranch: true }
});

if (!project?.externalProjectId) {
  throw new Error('Dev project row missing externalProjectId');
}

console.log(`Submitting audit for ${project.externalProjectId} (${project.defaultBranch})…`);

const submitted = await submitAudit({
  organizationId: LOCAL_DEV_FIXTURE.organizationId,
  projectId: LOCAL_DEV_FIXTURE.projectId,
  branch: project.defaultBranch || 'main',
  triggeredById: LOCAL_DEV_FIXTURE.profileId
});

console.log(`  auditRunId: ${submitted.auditRunId}`);

await executeAuditJob({
  job: submitted.job,
  rootDir,
  registryAgents: buildWorkerRegisteredAgents()
});

const snapshot = await getAuditRunSnapshot(submitted.auditRunId);
if (!snapshot) {
  throw new Error('Audit finished without snapshot');
}

console.log('\nReal audit completed.');
console.log(`  status: ${snapshot.runStatus}`);
console.log(`  findings: ${snapshot.findings.length}`);
console.log(`  issue candidates: ${snapshot.issueCandidates.length}`);
console.log(`  graph nodes: ${snapshot.graphSnapshot?.nodeCount ?? 0}`);
console.log(`  open in /app with audit id ${submitted.auditRunId}`);

await prisma.$disconnect();
