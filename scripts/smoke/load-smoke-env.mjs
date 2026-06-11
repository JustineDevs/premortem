import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import net from 'node:net';

import { applySupabaseDatabaseEnv } from '../../packages/db/supabase-database-url.mjs';
import {
  applyConfiguredDevDefaults,
  hasConfiguredRuntimeCredentials
} from '../lib/configured-env.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadSmokeEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const absolutePath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(absolutePath)) continue;

    for (const line of fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^"/, '').replace(/"$/, '');
    }
  }

  applySupabaseDatabaseEnv(process.env);

  // Three smoke tiers: production (no mocks), fixture (CI mock ingest), configured (.env.local real paths).
  const productionMode = process.env.PREMORTEM_PRODUCTION_MODE === '1';
  const fixtureMode = process.env.PREMORTEM_SMOKE_USE_FIXTURE === '1';
  const configuredMode = hasConfiguredRuntimeCredentials(process.env);

  if (productionMode) {
    delete process.env.PREMORTEM_AUTH_DISABLED;
    delete process.env.PREMORTEM_INGEST_LOCAL;
    delete process.env.PREMORTEM_PUBLISH_DRY_RUN;
    delete process.env.PREMORTEM_EXECUTOR;
    process.env.PREMORTEM_SMOKE_SKIP_LLM_SPECIALISTS = '1';
    process.env.NEO4J_DISABLED ??= '0';
  } else if (fixtureMode) {
    process.env.PREMORTEM_AUTH_DISABLED ??= '1';
    process.env.PREMORTEM_INGEST_LOCAL ??= '1';
    process.env.PREMORTEM_PUBLISH_DRY_RUN ??= '1';
    process.env.PREMORTEM_EXECUTOR ??= 'mock';
    process.env.PREMORTEM_RECONCILE_DRY_RUN ??= '1';
  } else if (configuredMode) {
    applyConfiguredDevDefaults(process.env);
    if (process.env.PREMORTEM_PUBLISH_DRY_RUN === undefined) {
      delete process.env.PREMORTEM_PUBLISH_DRY_RUN;
    }
  } else {
    process.env.PREMORTEM_RECONCILE_DRY_RUN ??= '1';
    if (!process.env.GEMINI_API_KEY && !process.env.AZURE_OPENAI_API_KEY) {
      process.env.PREMORTEM_EXECUTOR ??= 'mock';
    }
  }

  return {
    rootDir: ROOT_DIR,
    productionMode,
    fixtureMode,
    configuredMode: configuredMode && !productionMode && !fixtureMode
  };
}

export function assertProductionSmokePrerequisites() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.GITLAB_TOKEN && !process.env.GITLAB_SMOKE_PUBLISH_TOKEN) {
    missing.push('GITLAB_TOKEN or GITLAB_SMOKE_PUBLISH_TOKEN (issue publish probe; MCP read tokens are not enough)');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!process.env.GEMINI_API_KEY && !process.env.AZURE_OPENAI_API_KEY) {
    missing.push('GEMINI_API_KEY or AZURE_OPENAI_*');
  }
  if (process.env.NEO4J_DISABLED === '1') missing.push('NEO4J must be enabled (unset NEO4J_DISABLED)');
  if (missing.length > 0) {
    throw new Error(
      `Production smoke requires real credentials: ${missing.join(', ')}. Set PREMORTEM_SMOKE_USE_FIXTURE=1 for mock-only CI.`
    );
  }
}

export async function assertNeo4jReachable() {
  const port = Number(process.env.PREMORTEM_DOCKER_NEO4J_BOLT_PORT ?? '7687');
  const reachable = await new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(2000);
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

  if (!reachable) {
    throw new Error(
      `Neo4j is not reachable on bolt://127.0.0.1:${port}. Run pnpm run docker:up or start Neo4j before production smoke.`
    );
  }
}
