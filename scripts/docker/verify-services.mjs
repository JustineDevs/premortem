import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPremortemLocalEnv } from '../load-local-env.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadPremortemLocalEnv(repoRoot);

function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(2_000);
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

async function main() {
  const neo4jDisabled = process.env.NEO4J_DISABLED === '1';
  const boltPort = Number(process.env.PREMORTEM_DOCKER_NEO4J_BOLT_PORT ?? '7687');
  const httpPort = Number(process.env.PREMORTEM_DOCKER_NEO4J_HTTP_PORT ?? '7474');
  const postgresPort = Number(process.env.PREMORTEM_DOCKER_POSTGRES_PORT ?? '5432');

  const databaseUrl = process.env.DATABASE_URL ?? '';
  const usesLocalPostgres =
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1') ||
    /@postgres:5432\//.test(databaseUrl);

  const checks = [];

  if (!neo4jDisabled) {
    checks.push({
      name: 'Neo4j Bolt',
      ok: await checkPort('127.0.0.1', boltPort),
      detail: `bolt://127.0.0.1:${boltPort} (browser :${httpPort})`
    });
  }

  if (usesLocalPostgres) {
    checks.push({
      name: 'Docker Postgres',
      ok: await checkPort('127.0.0.1', postgresPort),
      detail: `127.0.0.1:${postgresPort}/premortem`
    });
  }

  console.log('=== Docker Services ===\n');
  for (const check of checks) {
    console.log(`${check.ok ? '✅' : '❌'} ${check.name}: ${check.ok ? 'OK' : 'DOWN'}`);
    console.log(`   ${check.detail}`);
  }

  if (checks.length === 0) {
    console.log('No local Docker services required for the current env profile.');
    console.log('Neo4j: set NEO4J_URI (default bolt://localhost:7687) unless NEO4J_DISABLED=1');
    console.log('Postgres: use Supabase DATABASE_URL, or local docker URLs documented in .env.example');
  }

  const failed = checks.some((check) => !check.ok);
  process.exit(failed ? 1 : 0);
}

void main();
