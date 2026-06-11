import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPremortemLocalEnv } from '../load-local-env.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadPremortemLocalEnv(repoRoot);

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr || stdout}`));
    });
  });
}

async function canUseDocker() {
  const preferSudo = process.env.PREMORTEM_DOCKER_SUDO === '1';

  for (const useSudo of preferSudo ? [true, false] : [false, true]) {
    try {
      await dockerInfo(useSudo);
      return { ok: true, useSudo };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const permissionDenied =
        message.includes('permission denied') && message.includes('docker.sock');

      if (!permissionDenied && !preferSudo) {
        return { ok: false, reason: message };
      }

      if (!useSudo && !preferSudo) {
        continue;
      }

      return {
        ok: false,
        reason:
          'Docker permission denied. Fix once: sudo usermod -aG docker $USER && newgrp docker. ' +
          'Or run: PREMORTEM_DOCKER_SUDO=1 pnpm run docker:up'
      };
    }
  }

  return {
    ok: false,
    reason: 'Docker is not available. Install Docker or set PREMORTEM_SKIP_DOCKER=1.'
  };
}

function requireDockerStrict() {
  return process.env.PREMORTEM_REQUIRE_DOCKER === '1';
}

async function isPortOpen(host, port) {
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

async function dockerInfo(useSudo = false) {
  const command = useSudo ? 'sudo' : 'docker';
  const args = useSudo ? ['docker', 'info'] : ['info'];
  await runCommand(command, args);
}

async function dockerComposeUp(services, useSudo = false) {
  const command = useSudo ? 'sudo' : 'docker';
  const args = useSudo
    ? ['docker', 'compose', 'up', '-d', ...services]
    : ['compose', 'up', '-d', ...services];
  await runCommand(command, args, { stdio: 'inherit' });
}

async function waitForPort(host, port, timeoutMs = 120_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const isOpen = await new Promise((resolve) => {
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

    if (isOpen) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${host}:${port}`);
}

function neo4jDisabled() {
  return process.env.NEO4J_DISABLED === '1';
}

function dockerSkipped() {
  return process.env.PREMORTEM_SKIP_DOCKER === '1';
}

function usesLocalDockerPostgres() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  return (
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1') ||
    /@postgres:5432\//.test(databaseUrl)
  );
}

/**
 * Start docker compose services required by the current env profile and wait until healthy.
 * @param {{ strict?: boolean }} [options]
 */
export async function ensureDockerServices(options = {}) {
  const strict = options.strict ?? requireDockerStrict();

  if (dockerSkipped()) {
    console.log(JSON.stringify({ service: 'docker', status: 'skipped', reason: 'PREMORTEM_SKIP_DOCKER=1' }));
    return { started: [], skipped: ['all'] };
  }

  const boltPort = Number(process.env.PREMORTEM_DOCKER_NEO4J_BOLT_PORT ?? '7687');
  const postgresPort = Number(process.env.PREMORTEM_DOCKER_POSTGRES_PORT ?? '5432');

  const neo4jNeeded = !neo4jDisabled();
  const postgresNeeded = usesLocalDockerPostgres();

  if (neo4jNeeded && (await isPortOpen('127.0.0.1', boltPort))) {
    console.log(
      JSON.stringify({
        service: 'docker',
        status: 'ready',
        note: 'Neo4j already listening',
        neo4jBolt: `bolt://127.0.0.1:${boltPort}`
      })
    );
    return { started: ['neo4j'], skipped: [], alreadyRunning: true };
  }

  const docker = await canUseDocker();
  if (!docker.ok) {
    const message = docker.reason ?? 'Docker unavailable';
    if (strict && neo4jNeeded) {
      throw new Error(message);
    }
    console.warn(JSON.stringify({ service: 'docker', status: 'unavailable', warning: message }));
    return { started: [], skipped: ['all'], unavailable: true };
  }

  const services = [];
  if (neo4jNeeded) {
    services.push('neo4j');
  }
  if (postgresNeeded) {
    services.push('postgres');
  }

  if (services.length === 0) {
    console.log(JSON.stringify({ service: 'docker', status: 'skipped', reason: 'no local services required' }));
    return { started: [], skipped: services };
  }

  console.log(JSON.stringify({ service: 'docker', action: 'up', services, useSudo: docker.useSudo ?? false }));
  await dockerComposeUp(services, docker.useSudo);

  if (services.includes('neo4j')) {
    await waitForPort('127.0.0.1', boltPort);
  }
  if (services.includes('postgres')) {
    await waitForPort('127.0.0.1', postgresPort);
  }

  console.log(
    JSON.stringify({
      service: 'docker',
      status: 'ready',
      neo4jBolt: services.includes('neo4j') ? `bolt://127.0.0.1:${boltPort}` : null,
      postgres: services.includes('postgres') ? `127.0.0.1:${postgresPort}` : null
    })
  );

  return { started: services, skipped: [] };
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  ensureDockerServices({ strict: true }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
