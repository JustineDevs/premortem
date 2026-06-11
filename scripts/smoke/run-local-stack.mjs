import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPremortemLocalEnv } from '../load-local-env.mjs';

const FIXTURE = {
  profileId: '7f9458c3-1b8d-4f4d-a6e4-9f2333b3d821',
  organizationId: 'd86ad1f2-c720-4f54-8584-9e953dd527cb',
  projectId: 'f28e9bd2-5673-45d2-a97f-55a0b174e751'
};
async function findAvailablePort(startPort) {
  let port = startPort;

  while (true) {
    const isFree = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });

    if (isFree) {
      return String(port);
    }

    port += 1;
  }
}

async function waitFor(url, validate, timeoutMs = 180000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (await validate(response)) {
        return response;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${String(lastError)}` : ''}`);
}

async function pollAuditCompleted(webBaseUrl, auditRunId, timeoutMs = 300000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    let response;
    try {
      response = await fetch(`${webBaseUrl}/api/audits/${auditRunId}`);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    if (response.status === 404 || response.status === 502 || response.status === 503) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    assert.equal(response.status, 200);
    const payload = await response.json();

    if (payload.auditRun.runStatus === 'completed') {
      return payload.auditRun;
    }

    if (payload.auditRun.runStatus === 'failed') {
      throw new Error(`Audit ${auditRunId} failed: ${payload.auditRun.errorMessage ?? 'unknown error'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for audit ${auditRunId} to complete`);
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  loadPremortemLocalEnv(repoRoot);
  process.env.PREMORTEM_EXECUTOR ??= 'mock';
  const API_PORT = await findAvailablePort(28787);
  const WEB_PORT = await findAvailablePort(23000);
  const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
  const WEB_BASE_URL = `http://127.0.0.1:${WEB_PORT}`;

  const dev = spawn('node', ['./scripts/dev/run-local-stack.mjs'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PREMORTEM_API_PORT: API_PORT,
      PREMORTEM_WEB_PORT: WEB_PORT,
      PREMORTEM_API_BASE_URL: API_BASE_URL,
      PREMORTEM_SMOKE_USE_FIXTURE: '1',
      PREMORTEM_AUTH_DISABLED: '1',
      PREMORTEM_INGEST_LOCAL: '1',
      PREMORTEM_FORCE_LOCAL_INGEST: '1',
      PREMORTEM_PUBLISH_DRY_RUN: '1',
      PREMORTEM_EXECUTOR: process.env.PREMORTEM_EXECUTOR,
      HOSTNAME: '127.0.0.1',
      PORT: WEB_PORT
    },
    cwd: repoRoot
  });

  let logs = '';
  dev.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    logs += text;
    process.stdout.write(text);
  });
  dev.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    logs += text;
    process.stderr.write(text);
  });

  try {
    const apiHealth = await waitFor(`${API_BASE_URL}/health`, async (response) => response.ok);
    const webHealth = await waitFor(`${WEB_BASE_URL}/health`, async (response) => response.ok);

    assert.equal(apiHealth.status, 200);
    assert.equal(webHealth.status, 200);

    const landing = await fetch(`${WEB_BASE_URL}/`);
    const landingHtml = await landing.text();
    assert.equal(landing.status, 200);
    assert.match(landingHtml, /Run on your repo before it breaks production\./);
    assert.match(landingHtml, /landing-root/);
    assert.match(landingHtml, /Connect GitLab|Connect to/);

    const sandboxResponse = await fetch(`${WEB_BASE_URL}/api/audits/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customSnippet:
          'const q = "SELECT * FROM users WHERE id = " + userId; console.log("pw:", password);'
      })
    });

    assert.equal(sandboxResponse.status, 200);
    const sandboxPayload = await sandboxResponse.json();
    assert.equal(sandboxPayload.success, true);
    assert.ok(sandboxPayload.audit?.findings?.length > 0);

    const dbModule = await import('@premortem/db');
    const orchestratorModule = await import('@premortem/orchestrator');
    const { ensureLocalDevelopmentFixture } = dbModule;
    const { buildWorkerRegisteredAgents, executeAuditJob, submitAudit } = orchestratorModule;
    const smokeBranch = 'main';

    await ensureLocalDevelopmentFixture();

    const submitted = await submitAudit({
      organizationId: FIXTURE.organizationId,
      projectId: FIXTURE.projectId,
      branch: smokeBranch,
      commitSha: `local-stack-${Date.now()}`,
      triggeredById: FIXTURE.profileId
    });

    const completedAudit = await executeAuditJob({
      job: submitted.job,
      rootDir: repoRoot,
      registryAgents: buildWorkerRegisteredAgents(repoRoot)
    });

    const appConsole = await fetch(`${WEB_BASE_URL}/app`);
    const appConsoleHtml = await appConsole.text();
    assert.equal(appConsole.status, 200);
    assert.match(appConsoleHtml, /Premortem|Monitor Dashboard|layout-view/);

    const legacyReviews = await fetch(`${WEB_BASE_URL}/reviews`, { redirect: 'manual' });
    assert.ok(legacyReviews.status === 307 || legacyReviews.status === 308);
    assert.equal(new URL(legacyReviews.headers.get('location') || '', WEB_BASE_URL).pathname, '/app');

    const detail = await fetch(`${WEB_BASE_URL}/audits/${submitted.auditRunId}`);
    const detailHtml = await detail.text();
    assert.equal(detail.status, 200);
    assert.match(detailHtml, /Rejected Validation Artifacts/);
    assert.match(detailHtml, /Traceability/);

    const apiList = await fetch(`${WEB_BASE_URL}/api/audits?limit=5`);
    const apiListPayload = await apiList.json();
    assert.equal(apiList.status, 200);
    const auditRuns = Array.isArray(apiListPayload) ? apiListPayload : apiListPayload.auditRuns;
    assert.ok(Array.isArray(auditRuns));
    assert.ok(auditRuns.length > 0);

    console.log(
      JSON.stringify({
        auditRunId: submitted.auditRunId,
        runStatus: completedAudit.runStatus,
        renderedLandingPageBytes: landingHtml.length,
        renderedAppConsoleBytes: appConsoleHtml.length,
        renderedAuditDetailBytes: detailHtml.length,
        findings: completedAudit.findingsCount,
        issueCandidates: completedAudit.issueCandidateCount
      })
    );
  } finally {
    try {
      dev.kill('SIGTERM');
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') {
        throw error;
      }
    }

    dev.stdout.destroy();
    dev.stderr.destroy();
    dev.stdin.end();
    dev.unref();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (dev.exitCode && dev.exitCode !== 0) {
      console.error(logs);
    }
  }
}

void main().catch((error) => {
  console.error('local-stack-smoke-error', error);
  process.exitCode = 1;
});
