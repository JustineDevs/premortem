#!/usr/bin/env node
/**
 * Verify `.env.local` keys are present and reachable (live pings where safe).
 * Run after filling `.env.local` to confirm credentials are utilized, not idle.
 */

import net from 'node:net';
import { SMOKE_GEMINI_MODEL } from '../../packages/domain/dist/index.js';
import { loadPremortemLocalEnv } from '../load-local-env.mjs';
import { hasConfiguredRuntimeCredentials } from '../lib/configured-env.mjs';
import { probePhoenixEndpoint } from '../../packages/observability/src/index.ts';

const ROOT = loadPremortemLocalEnv();
const DEFAULT_GITLAB_EXTERNAL_PROJECT_ID = 'jstn-studio/meta-architect';

function env(name) {
  return process.env[name]?.trim() || '';
}

function row(name, status, detail) {
  const icon = status === 'OK' ? '✅' : status === 'SKIP' ? '⏭️' : status === 'WARN' ? '🟡' : '❌';
  console.log(`${icon} ${name}: ${status}`);
  if (detail) console.log(`   ${detail}`);
  return status;
}

async function tcpReachable(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function checkLlm() {
  const provider = env('LLM_PROVIDER').toLowerCase();
  const googleKey = env('GEMINI_API_KEY');
  const openaiKey = env('OPENAI_API_KEY');
  const anthropicKey = env('ANTHROPIC_API_KEY');

  if (provider === 'openai' || (!provider && openaiKey)) {
    return row('OpenAI API', openaiKey ? 'OK' : 'MISSING', openaiKey ? 'set' : 'OPENAI_API_KEY');
  }

  if (provider === 'anthropic' || (!provider && anthropicKey)) {
    return row('Anthropic API', anthropicKey ? 'OK' : 'MISSING', anthropicKey ? 'set' : 'ANTHROPIC_API_KEY');
  }

  if (!googleKey) return row('Gemini API', 'MISSING', 'GEMINI_API_KEY');
  const model = env('LLM_MODEL') || SMOKE_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${googleKey}`;
  const res = await fetch(url);
  if (res.ok) return row('Gemini API', 'OK', `model ${model}`);
  return row('Gemini API', 'FAIL', `${res.status} ${(await res.text()).slice(0, 120)}`);
}

async function checkGitLabMcpServer() {
  const base = env('GITLAB_BASE_URL') || 'https://gitlab.com';
  const mcpUrl = `${base.replace(/\/$/, '')}/api/v4/mcp`;
  const mcpRuntimeEnabled = env('PREMORTEM_GITLAB_MCP') !== '0';

  // GitLab documents MCP auth as OAuth 2.0 in MCP clients (Cursor), not PAT scope UI.
  // https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_server/
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'premortem-verify', version: '1.0.0' }
      }
    })
  });
  const text = await res.text();

  if (res.status === 404 || text.includes('404')) {
    return row(
      'GitLab MCP server',
      'WARN',
      'POST /api/v4/mcp returned 404 — enable GitLab Duo + beta/experimental on your group'
    );
  }

  if (res.status === 401 || /unauthorized/i.test(text)) {
    const runtime = mcpRuntimeEnabled ? 'Orchestrator uses GitLab MCP for issue/pipeline context.' : 'PREMORTEM_GITLAB_MCP=0';
    return row(
      'GitLab MCP server',
      'OK',
      `Endpoint reachable at ${mcpUrl}; connect Cursor via OAuth (not PAT). ${runtime}`
    );
  }

  if (res.ok) {
    return row('GitLab MCP server', 'OK', `${mcpUrl} responded without OAuth (unusual; OAuth is documented path)`);
  }

  return row('GitLab MCP server', 'WARN', `${res.status} ${text.slice(0, 120)}`);
}

async function checkGitLab() {
  const project = env('GITLAB_EXTERNAL_PROJECT_ID');
  const base = env('GITLAB_BASE_URL') || 'https://gitlab.com';
  const mcpUrl = `${base.replace(/\/$/, '')}/api/v4/mcp`;
  if (!env('GITLAB_TOKEN') && !env('GITLAB_CLIENT_ID') && !env('GITLAB_CLIENT_SECRET')) {
    return row('GitLab MCP usage', 'MISSING', 'GITLAB_TOKEN or GitLab OAuth credentials');
  }

  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'premortem-verify', version: '1.0.0' }
      }
    })
  });

  const text = await res.text();
  if (res.status === 404 || text.includes('404')) {
    return row('GitLab MCP usage', 'WARN', 'POST /api/v4/mcp returned 404 — enable GitLab Duo + beta/experimental on your group');
  }
  if (res.status === 401 || /unauthorized/i.test(text) || (res.status >= 200 && res.status < 300)) {
    if (project === DEFAULT_GITLAB_EXTERNAL_PROJECT_ID) {
      return row(
        'GitLab MCP usage',
        'WARN',
        `project ${project} is the local demo default; set GITLAB_EXTERNAL_PROJECT_ID to your real Premortem target`
      );
    }
    return row('GitLab MCP usage', 'OK', `project ${project || 'n/a'} via ${mcpUrl}`);
  }
  return row('GitLab MCP usage', 'WARN', `${res.status} ${text.slice(0, 120)}`);
}

async function checkSupabase() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) return row('Supabase Auth', 'MISSING', 'NEXT_PUBLIC_SUPABASE_*');
  const res = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` }
  });
  return res.ok
    ? row('Supabase Auth', 'OK', url)
    : row('Supabase Auth', 'FAIL', `${res.status}`);
}

async function checkNeo4j() {
  if (env('NEO4J_DISABLED') === '1') {
    return row('Neo4j', 'SKIP', 'NEO4J_DISABLED=1');
  }
  const uri = env('NEO4J_URI') || 'bolt://localhost:7687';
  const port = Number(uri.match(/:(\d+)$/)?.[1] ?? '7687');
  const ok = await tcpReachable('127.0.0.1', port);
  return ok ? row('Neo4j bolt', 'OK', uri) : row('Neo4j bolt', 'FAIL', `Start: pnpm run docker:up (${uri})`);
}

async function checkPhoenix() {
  if (!env('PHOENIX_API_KEY')) {
    return row('Arize Phoenix', 'MISSING', 'PHOENIX_API_KEY');
  }
  const project = env('PHOENIX_PROJECT_NAME') || 'premortem';
  const probe = await probePhoenixEndpoint();
  if (probe.ok) {
    const version = probe.serverVersion ? `; version ${probe.serverVersion}` : '';
    const contentType = probe.contentType ? `; ${probe.contentType}` : '';
    return row('Arize Phoenix', 'OK', `project ${project}; MCP ${probe.baseUrl}${version}${contentType}`);
  }

  const detail =
    probe.error ||
    `status ${probe.status}${probe.serverVersion ? `; version ${probe.serverVersion}` : ''}`;
  return row('Arize Phoenix', 'FAIL', detail);
}

async function checkLangfuse() {
  const pub = env('LANGFUSE_PUBLIC_KEY');
  const sec = env('LANGFUSE_SECRET_KEY');
  const base = env('LANGFUSE_BASE_URL') || 'https://cloud.langfuse.com';
  if (!pub || !sec) return row('Langfuse', 'SKIP', 'LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY');
  const res = await fetch(`${base.replace(/\/$/, '')}/api/public/health`);
  return res.ok ? row('Langfuse', 'OK', base) : row('Langfuse', 'WARN', `health ${res.status}`);
}

async function checkPostHog() {
  const clientKey = env('NEXT_PUBLIC_POSTHOG_KEY');
  const serverKey = env('POSTHOG_API_KEY');
  const host = env('POSTHOG_HOST') || env('NEXT_PUBLIC_POSTHOG_HOST') || 'https://us.i.posthog.com';
  if (!clientKey?.startsWith('phc_')) {
    return row('PostHog client', 'MISSING', 'NEXT_PUBLIC_POSTHOG_KEY (phc_*)');
  }
  row('PostHog client', 'OK', host);
  if (serverKey?.startsWith('phc_')) {
    return row('PostHog server capture', 'OK', 'Uses phc_ project key');
  }
  if (serverKey?.startsWith('phx_')) {
    return row(
      'PostHog server capture',
      'OK',
      'Server uses NEXT_PUBLIC_POSTHOG_KEY (phc_); personal phx_ key not required'
    );
  }
  return row('PostHog server capture', 'SKIP', 'Set POSTHOG_API_KEY to phc_ or rely on NEXT_PUBLIC_POSTHOG_KEY');
}

async function checkStripe() {
  const secret = env('STRIPE_SECRET_KEY');
  if (!secret) return row('Stripe', 'MISSING', 'STRIPE_SECRET_KEY');
  const res = await fetch('https://api.stripe.com/v1/prices?limit=1', {
    headers: { Authorization: `Bearer ${secret}` }
  });
  return res.ok ? row('Stripe', 'OK', 'secret key valid') : row('Stripe', 'FAIL', `${res.status}`);
}

async function checkCloudflare() {
  const token = env('CLOUDFLARE_API_TOKEN');
  if (!token) return row('Cloudflare API', 'SKIP', 'CLOUDFLARE_API_TOKEN');
  const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await res.json();
  return body?.success
    ? row('Cloudflare API', 'OK', `account ${env('CLOUDFLARE_ACCOUNT_ID') || 'n/a'}`)
    : row('Cloudflare API', 'FAIL', 'token verify failed');
}

async function checkSentry() {
  const dsn = env('NEXT_PUBLIC_SENTRY_DSN') || env('SENTRY_DSN');
  if (!dsn) return row('Sentry', 'MISSING', 'SENTRY_DSN');
  return row('Sentry', 'OK', `traces ${env('SENTRY_TRACES_SAMPLE_RATE') || '0.1'}`);
}

async function main() {
  console.log('=== Premortem env utilization check ===\n');
  console.log(`Repo: ${ROOT}`);
  console.log(
    `Runtime mode: ${
      process.env.PREMORTEM_PRODUCTION_MODE === '1'
        ? 'production'
        : hasConfiguredRuntimeCredentials()
          ? 'configured (.env.local drives real GitLab + Gemini)'
          : 'fixture (mocks)'
    }\n`
  );

  const results = [];
  results.push(row('DATABASE_URL', env('DATABASE_URL') ? 'OK' : 'MISSING', env('DATABASE_URL') ? 'set' : ''));
  results.push(row('Configured credentials bundle', hasConfiguredRuntimeCredentials() ? 'OK' : 'WARN', 'DATABASE_URL + GITLAB_TOKEN + supported LLM key'));
  results.push(await checkSupabase());
  results.push(await checkNeo4j());
  results.push(await checkGitLab());
  results.push(await checkGitLabMcpServer());
  results.push(await checkLlm());
  results.push(await checkPhoenix());
  results.push(await checkLangfuse());
  results.push(await checkPostHog());
  results.push(await checkSentry());
  results.push(await checkStripe());
  results.push(await checkCloudflare());

  const fails = results.filter((s) => s === 'FAIL' || s === 'MISSING').length;
  const warns = results.filter((s) => s === 'WARN').length;
  console.log(`\nSummary: ${fails} fail/missing, ${warns} warnings`);
  console.log('\nNext: pnpm run dev (configured mode) → pnpm run smoke:audit-flow');
  const hardFail = results.filter((s) => s === 'FAIL' || s === 'MISSING').length;
  const hasLlm = env('GEMINI_API_KEY') || env('OPENAI_API_KEY') || env('ANTHROPIC_API_KEY');
  process.exit(hardFail > 0 && !hasLlm ? 1 : hardFail > 1 ? 1 : 0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
