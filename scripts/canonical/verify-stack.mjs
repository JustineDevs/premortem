#!/usr/bin/env node
/**
 * Verify canonical stack SDK/env readiness (ADR §7).
 * Complements scripts/mcp/verify-all.mjs (MCP connectivity).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function hasEnv(...keys) {
  return keys.some((key) => Boolean(process.env[key]?.trim()));
}

const checks = [
  {
    name: 'Next.js (web app)',
    status: () => (existsSync(resolve(ROOT, 'apps/web/package.json')) ? 'OK' : 'FAIL'),
    detail: 'apps/web'
  },
  {
    name: 'Supabase Auth',
    status: () => (hasEnv('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY') ? 'OK' : 'MISSING'),
    detail: 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
  },
  {
    name: 'Supabase Postgres + Prisma',
    status: () => (hasEnv('DATABASE_URL') ? 'OK' : 'MISSING'),
    detail: 'DATABASE_URL (+ DIRECT_URL for migrations)'
  },
  {
    name: 'Supabase Storage',
    status: () =>
      hasEnv('SUPABASE_STORAGE_BUCKET', 'SUPABASE_SERVICE_ROLE_KEY') ? 'OK' : 'PARTIAL',
    detail: 'SUPABASE_STORAGE_BUCKET, SUPABASE_SERVICE_ROLE_KEY'
  },
  {
    name: 'Cloudflare Queues (Worker API)',
    status: () =>
      existsSync(resolve(ROOT, 'apps/api/wrangler.toml')) ? 'OK' : 'FAIL',
    detail: 'apps/api/wrangler.toml: use pnpm --filter @premortem/api dev:worker for queue path'
  },
  {
    name: 'TanStack Query',
    status: () =>
      existsSync(resolve(ROOT, 'apps/web/src/providers/os-providers.tsx')) ? 'OK' : 'FAIL',
    detail: 'OsProviders + use-os-console-data hooks'
  },
  {
    name: 'Sentry',
    status: () => (hasEnv('NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_DSN') ? 'OK' : 'MISSING'),
    detail: 'NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN'
  },
  {
    name: 'PostHog',
    status: () => (hasEnv('NEXT_PUBLIC_POSTHOG_KEY', 'POSTHOG_API_KEY') ? 'OK' : 'MISSING'),
    detail: 'NEXT_PUBLIC_POSTHOG_KEY (client), POSTHOG_API_KEY (server)'
  },
  {
    name: 'Stripe',
    status: () =>
      hasEnv('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET') ? 'OK' : 'PARTIAL',
    detail: 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO/TEAM (+ _ANNUAL for yearly checkout)'
  },
  {
    name: 'Neo4j graph store',
    status: () =>
      process.env.NEO4J_DISABLED === '1'
        ? 'PARTIAL'
        : hasEnv('NEO4J_URI', 'NEO4J_PASSWORD')
          ? 'OK'
          : 'MISSING',
    detail: 'docker compose neo4j + NEO4J_URI (bolt://localhost:7687); pnpm run docker:status'
  },
  {
    name: 'GitLab',
    status: () =>
      hasEnv('GITLAB_CLIENT_ID', 'GITLAB_CLIENT_SECRET') || hasEnv('GITLAB_TOKEN') ? 'OK' : 'MISSING',
    detail: 'OAuth: GITLAB_CLIENT_ID/SECRET or PAT: GITLAB_TOKEN'
  }
];

loadEnv();

console.log('=== Canonical Stack Verification (ADR §7) ===\n');

let ok = 0;
let partial = 0;
let missing = 0;

for (const check of checks) {
  const status = check.status();
  const icon = status === 'OK' ? '✅' : status === 'PARTIAL' ? '🟡' : status === 'MISSING' ? '⚙️' : '❌';
  console.log(`${icon} ${check.name}: ${status}`);
  console.log(`   ${check.detail}`);
  if (status === 'OK') ok += 1;
  else if (status === 'PARTIAL') partial += 1;
  else missing += 1;
}

console.log(`\nSummary: ${ok} ready, ${partial} partial, ${missing} missing/failed`);
console.log('\nMCP servers (Cursor plugins + mcp.local.json):');
console.log('  - Run: node scripts/mcp/verify-all.mjs');
console.log('  - Cursor plugins: Sentry, PostHog, Stripe, Prisma (enable in Cursor MCP settings)');

process.exit(missing > 0 ? 1 : 0);
