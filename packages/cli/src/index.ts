#!/usr/bin/env node

import { LOCAL_DEV_FIXTURE } from '@premortem/db';

const API_BASE_URL = process.env.PREMORTEM_API_BASE_URL ?? 'http://127.0.0.1:18787';
const FIXTURE = LOCAL_DEV_FIXTURE;

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = args[index + 1];
      if (value && !value.startsWith('--')) {
        flags[key] = value;
        index += 1;
      } else {
        flags[key] = 'true';
      }
    } else {
      positional.push(token);
    }
  }

  return { positional, flags };
}

async function submitAudit(flags: Record<string, string>) {
  const payload = await api('/api/audits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationId: FIXTURE.organizationId,
      projectId: flags.project ?? FIXTURE.projectId,
      branch: flags.branch ?? 'main',
      commitSha: flags.commit ?? `cli-${Date.now()}`,
      triggeredById: FIXTURE.profileId
    })
  });
  console.log(JSON.stringify(payload, null, 2));
}

async function watchAudit(auditRunId: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    const payload = await api(`/api/audits/${auditRunId}`);
    const auditRun = payload.auditRun;
    console.log(
      JSON.stringify({
        auditRunId,
        runStatus: auditRun.runStatus,
        counts: auditRun.counts,
        latestEvent: auditRun.events.at(-1)?.eventType ?? null
      })
    );
    if (auditRun.runStatus === 'completed' || auditRun.runStatus === 'failed') {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for audit ${auditRunId}`);
}

async function approveIssue(issueId: string) {
  const payload = await api(`/api/issues/${issueId}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });
  console.log(JSON.stringify(payload, null, 2));
}

async function publishIssue(issueId: string) {
  const payload = await api(`/api/issues/${issueId}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const { positional } = parseArgs(process.argv.slice(2));
  const [command, subcommand, arg] = positional;

  if (command === 'audit' && subcommand === 'submit') {
    await submitAudit(parseArgs(process.argv.slice(4)).flags);
    return;
  }

  if (command === 'audit' && subcommand === 'watch' && arg) {
    await watchAudit(arg);
    return;
  }

  if (command === 'issue' && subcommand === 'approve' && arg) {
    await approveIssue(arg);
    return;
  }

  if (command === 'issue' && subcommand === 'publish' && arg) {
    await publishIssue(arg);
    return;
  }

  console.log(`Premortem CLI

Usage:
  premortem audit submit [--project <id>] [--branch main]
  premortem audit watch <auditRunId>
  premortem issue approve <issueCandidateId>
  premortem issue publish <issueCandidateId>
`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
