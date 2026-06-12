import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuditEvent, ConsoleReviewAction, LOCAL_DEV_FIXTURE } from '@premortem/domain';
import { loadSmokeEnv } from './load-smoke-env.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Prefer configured mode (real GitLab + LLM) when .env.local is complete; mock only as fallback.
const { configuredMode, fixtureMode } = loadSmokeEnv();
if (!configuredMode && !fixtureMode) {
  process.env.PREMORTEM_INGEST_LOCAL ??= '1';
  process.env.PREMORTEM_FORCE_LOCAL_INGEST ??= '1';
  process.env.PREMORTEM_EXECUTOR ??= 'mock';
}

const dbModule = await import('@premortem/db');
const orchestratorModule = await import('@premortem/orchestrator');

const { ensureLocalDevelopmentFixture, prisma, recordReviewAction } = dbModule;
const { buildWorkerRegisteredAgents, executeAuditJob, getAuditRunSnapshot, submitAudit } =
  orchestratorModule;

await ensureLocalDevelopmentFixture();

const submitted = await submitAudit({
  organizationId: LOCAL_DEV_FIXTURE.organizationId,
  projectId: LOCAL_DEV_FIXTURE.projectId,
  branch: 'main',
  commitSha: `verify-${Date.now()}`,
  triggeredById: LOCAL_DEV_FIXTURE.profileId
});

await executeAuditJob({
  job: submitted.job,
  rootDir: ROOT_DIR,
  registryAgents: buildWorkerRegisteredAgents(ROOT_DIR)
});

const snapshot = await getAuditRunSnapshot(submitted.auditRunId);
if (!snapshot) throw new Error('Missing snapshot');

const eventTypes = snapshot.events.map((event) => event.eventType);
for (const required of [
  AuditEvent.STARTED,
  AuditEvent.INGESTION_COMPLETED,
  AuditEvent.GRAPH_BUILT,
  AuditEvent.COMPLETED
]) {
  if (!eventTypes.includes(required)) {
    throw new Error(`Missing event ${required}`);
  }
}

if (!snapshot.graphSnapshot || snapshot.graphSnapshot.nodeCount <= 0) {
  throw new Error('Expected graph snapshot nodes');
}

if (snapshot.agentRuns.length <= 1) {
  throw new Error('Expected multiple agent runs from parallel fan-out');
}

if (snapshot.lineage.length <= 0) {
  throw new Error('Expected lineage entries');
}

const issueId = snapshot.issueCandidates[0]?.id;
if (issueId) {
  await recordReviewAction({
    issueCandidateId: issueId,
    actorId: LOCAL_DEV_FIXTURE.profileId,
    actionType: 'approve'
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      auditRunId: submitted.auditRunId,
      runStatus: snapshot.runStatus,
      eventTypes,
      graphNodeCount: snapshot.graphSnapshot.nodeCount,
      agentRunCount: snapshot.agentRuns.length,
      lineageCount: snapshot.lineage.length,
      approvedIssueId: issueId ?? null
    },
    null,
    2
  )
);

await prisma.$disconnect();
