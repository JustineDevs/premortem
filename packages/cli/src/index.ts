#!/usr/bin/env node

import { LOCAL_DEV_FIXTURE } from '@premortem/domain';
import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = process.env.PREMORTEM_API_BASE_URL ?? 'http://127.0.0.1:18787';
const FIXTURE = LOCAL_DEV_FIXTURE;

function resolveApiAuthHeaders(apiKey?: string) {
  const resolvedKey = apiKey?.trim() ?? process.env.PREMORTEM_API_KEY?.trim();
  if (resolvedKey) {
    return { 'x-premortem-api-key': resolvedKey } as Record<string, string>;
  }

  if (process.env.PREMORTEM_AUTH_DISABLED === '1') {
    return {
      'x-premortem-actor-id': FIXTURE.profileId,
      'x-premortem-organization-id': FIXTURE.organizationId,
      'x-premortem-user-email': FIXTURE.email
    } as Record<string, string>;
  }

  throw new Error(
    'Missing API auth. Set PREMORTEM_API_KEY for production access or PREMORTEM_AUTH_DISABLED=1 for local fixture mode.'
  );
}

async function api(path: string, init?: RequestInit, apiKey?: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...resolveApiAuthHeaders(apiKey)
    }
  });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function resolveSupabaseRealtimeConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase realtime watch requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key).'
    );
  }

  return { url: url.replace(/\/$/, ''), key };
}

function isTerminalAuditStatus(status?: string | null) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
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
  const apiKey = flags['api-key'] ?? process.env.PREMORTEM_API_KEY;
  const payload = await api('/api/audits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: flags.project ?? FIXTURE.projectId,
      branch: flags.branch ?? 'main',
      commitSha: flags.commit ?? `cli-${Date.now()}`,
      ...(process.env.PREMORTEM_AUTH_DISABLED === '1' ? { triggeredById: FIXTURE.profileId } : {})
    })
  }, apiKey);
  console.log(JSON.stringify(payload, null, 2));
}

async function watchAudit(auditRunId: string, apiKey?: string) {
  const { url, key } = resolveSupabaseRealtimeConfig();
  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const printSnapshot = async () => {
    const payload = await api(`/api/audits/${auditRunId}`, undefined, apiKey);
    const auditRun = payload.auditRun;
    console.log(
      JSON.stringify({
        auditRunId,
        runStatus: auditRun.runStatus,
        counts: auditRun.counts,
        latestEvent: auditRun.events.at(-1)?.eventType ?? null
      })
    );
    return auditRun;
  };

  const initialAuditRun = await printSnapshot();
  if (isTerminalAuditStatus(initialAuditRun.runStatus)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(async () => {
      if (settled) return;
      settled = true;
      await supabase.removeChannel(channel);
      reject(new Error(`Timed out waiting for audit ${auditRunId}`));
    }, 120000);

    const finish = async () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      await supabase.removeChannel(channel);
      resolve();
    };

    const fail = async (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      await supabase.removeChannel(channel);
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const channel = supabase
      .channel(`audit-run-watch:${auditRunId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'audit_runs',
          filter: `id=eq.${auditRunId}`
        },
        async () => {
          try {
            const auditRun = await printSnapshot();
            if (isTerminalAuditStatus(auditRun.runStatus)) {
              await finish();
            }
          } catch (error) {
            await fail(error);
          }
        }
      );

    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        void fail(error ?? new Error(`Supabase realtime channel ${status.toLowerCase()}`));
      }
    });
  });
}

async function approveIssue(issueId: string, apiKey?: string) {
  const payload = await api(`/api/issues/${issueId}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }, apiKey);
  console.log(JSON.stringify(payload, null, 2));
}

async function publishIssue(issueId: string, apiKey?: string) {
  const payload = await api(`/api/issues/${issueId}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }, apiKey);
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, subcommand, arg] = positional;
  const apiKey = flags['api-key'] ?? process.env.PREMORTEM_API_KEY;

  if (command === 'audit' && subcommand === 'submit') {
    await submitAudit(flags);
    return;
  }

  if (command === 'audit' && subcommand === 'watch' && arg) {
    await watchAudit(arg, apiKey);
    return;
  }

  if (command === 'issue' && subcommand === 'approve' && arg) {
    await approveIssue(arg, apiKey);
    return;
  }

  if (command === 'issue' && subcommand === 'publish' && arg) {
    await publishIssue(arg, apiKey);
    return;
  }

  console.log(`Premortem CLI

Usage:
  premortem audit submit [--project <id>] [--branch main]
  premortem audit watch <auditRunId>
  premortem issue approve <issueCandidateId>
  premortem issue publish <issueCandidateId>

Environment:
  PREMORTEM_API_KEY=<api key> to use production auth
  PREMORTEM_AUTH_DISABLED=1 to use local fixture headers
`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
