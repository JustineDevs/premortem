import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const FIXTURE = {
  profileId: '7f9458c3-1b8d-4f4d-a6e4-9f2333b3d821',
  organizationId: 'd86ad1f2-c720-4f54-8584-9e953dd527cb',
  projectId: 'f28e9bd2-5673-45d2-a97f-55a0b174e751'
};
const API_PORT = '28787';
const WEB_PORT = '23000';
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_BASE_URL = `http://127.0.0.1:${WEB_PORT}`;

async function waitFor(url, validate, timeoutMs = 60000) {
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

async function pollAuditCompleted(auditRunId, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${API_BASE_URL}/api/audits/${auditRunId}`);
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
  const dev = spawn('npx', ['-y', 'pnpm@9.12.0', 'run', 'dev'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PREMORTEM_API_PORT: API_PORT,
      PREMORTEM_WEB_PORT: WEB_PORT,
      PREMORTEM_API_BASE_URL: API_BASE_URL,
      HOSTNAME: '127.0.0.1',
      PORT: WEB_PORT
    },
    detached: true
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
    assert.match(landingHtml, /vendor\/premortem-landing\/index\.html/);

    const createResponse = await fetch(`${API_BASE_URL}/api/audits`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: FIXTURE.organizationId,
        projectId: FIXTURE.projectId,
        branch: 'main',
        commitSha: `local-stack-${Date.now()}`,
        triggeredById: FIXTURE.profileId
      })
    });

    assert.equal(createResponse.status, 202);
    const submission = await createResponse.json();
    assert.equal(submission.runStatus, 'queued');

    const completedAudit = await pollAuditCompleted(submission.auditRunId);
    assert.equal(completedAudit.runStatus, 'completed');

    const appConsole = await fetch(`${WEB_BASE_URL}/app`);
    const appConsoleHtml = await appConsole.text();
    assert.equal(appConsole.status, 200);
    assert.match(appConsoleHtml, /Premortem|Monitor Dashboard|layout-view/);

    const legacyReviews = await fetch(`${WEB_BASE_URL}/reviews`, { redirect: 'manual' });
    assert.ok(legacyReviews.status === 307 || legacyReviews.status === 308);
    assert.equal(new URL(legacyReviews.headers.get('location') || '', WEB_BASE_URL).pathname, '/app');

    const detail = await fetch(`${WEB_BASE_URL}/audits/${submission.auditRunId}`);
    const detailHtml = await detail.text();
    assert.equal(detail.status, 200);
    assert.match(detailHtml, /Rejected Validation Artifacts/);
    assert.match(detailHtml, /Traceability/);

    const apiList = await fetch(`${API_BASE_URL}/api/audits?limit=5`);
    const apiListPayload = await apiList.json();
    assert.equal(apiList.status, 200);
    assert.ok(Array.isArray(apiListPayload.auditRuns));
    assert.ok(apiListPayload.auditRuns.some((auditRun) => auditRun.auditRunId === submission.auditRunId));

    console.log(
      JSON.stringify({
        auditRunId: submission.auditRunId,
        runStatus: completedAudit.runStatus,
        renderedLandingPageBytes: landingHtml.length,
        renderedAppConsoleBytes: appConsoleHtml.length,
        renderedAuditDetailBytes: detailHtml.length,
        findings: completedAudit.counts.findings,
        issueCandidates: completedAudit.counts.issueCandidates
      })
    );
  } finally {
    try {
      process.kill(-dev.pid, 'SIGTERM');
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
