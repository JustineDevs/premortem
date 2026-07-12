import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_DEV_FIXTURE } from '@premortem/domain';
import { resolveDevLlmRuntimeState } from '../lib/local-llm-runtime.ts';
import { createSupabaseSmokeSession } from './smoke-supabase-session.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEB_PORT = process.env.PREMORTEM_WEB_PORT ?? '13000';
const WEB_BASE = `http://127.0.0.1:${WEB_PORT}`;

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

async function waitForOk(url: string, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the route is online.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  loadLocalEnv();
  const { hasRealLlm } = await resolveDevLlmRuntimeState();
  process.env.PREMORTEM_EXECUTOR ??= hasRealLlm ? 'llm' : 'mock';

  await waitForOk(`${WEB_BASE}/api/health`);

  const password = `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const session = await createSupabaseSmokeSession({
    userId: LOCAL_DEV_FIXTURE.profileId,
    email: LOCAL_DEV_FIXTURE.email,
    password,
    fullName: 'Premortem Smoke',
    username: 'premortem-smoke'
  });

  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${session.accessToken}`,
    'content-type': 'application/json'
  };

  const submitResponse = await fetch(`${WEB_BASE}/api/audits/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: LOCAL_DEV_FIXTURE.projectId,
      branch: 'main'
    })
  });

  const submitBody = await submitResponse.text();
  assert.equal(submitResponse.status, 202, submitBody);
  const submission = JSON.parse(submitBody) as {
    auditRunId: string;
    runStatus: string;
    message?: string;
  };
  assert.ok(submission.auditRunId, 'auditRunId should be returned');

  const deadline = Date.now() + 300000;
  let snapshot: { runStatus?: string; issueCandidates?: Array<{ id: string }> } | null = null;
  while (Date.now() < deadline) {
    const snapshotResponse = await fetch(`${WEB_BASE}/api/audits/${submission.auditRunId}`, {
      headers: { accept: 'application/json', authorization: `Bearer ${session.accessToken}` }
    });
    if (!snapshotResponse.ok) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    const payload = (await snapshotResponse.json()) as {
      snapshot?: { runStatus?: string; issueCandidates?: Array<{ id: string }> };
      auditRun?: { runStatus?: string; issueCandidates?: Array<{ id: string }> };
    };
    snapshot = payload.snapshot ?? payload.auditRun ?? null;
    if (snapshot?.runStatus === 'completed') break;
    if (snapshot?.runStatus === 'failed') {
      throw new Error(`Audit ${submission.auditRunId} failed`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!snapshot || snapshot.runStatus !== 'completed') {
    throw new Error(`Timed out waiting for audit ${submission.auditRunId} to complete`);
  }

  assert.ok(Array.isArray(snapshot.issueCandidates) && snapshot.issueCandidates.length > 0);

  console.log(
    JSON.stringify(
      {
        ok: true,
        auditRunId: submission.auditRunId,
        runStatus: snapshot.runStatus,
        issueCandidateCount: snapshot.issueCandidates.length,
        localProviderMode: hasRealLlm ? 'real' : 'mock'
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error('audit-flow-smoke-error', error);
  process.exitCode = 1;
});
