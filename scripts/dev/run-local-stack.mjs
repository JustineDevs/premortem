import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPremortemLocalEnv } from '../load-local-env.mjs';
import { ensureDockerServices } from '../docker/ensure-services.mjs';
import {
  applyConfiguredDevDefaults,
  hasConfiguredRuntimeCredentials
} from '../lib/configured-env.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadPremortemLocalEnv(repoRoot);

const rootCommand = ['npx', '-y', 'pnpm@9.12.0'];

function spawnProcess(label, args, envOverrides = {}) {
  const child = spawn(rootCommand[0], [...rootCommand.slice(1), ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...envOverrides
    }
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`${label} exited from signal ${signal}`);
    } else if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

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

    if (isFree) return port;
    port += 1;
  }
}

async function runStep(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(rootCommand[0], [...rootCommand.slice(1), ...args], {
      stdio: 'inherit',
      env: process.env
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  const dockerResult = await ensureDockerServices({ strict: false });
  if (dockerResult.unavailable && process.env.PREMORTEM_PRODUCTION_MODE === '1') {
    console.warn(
      '[premortem] Neo4j/Docker unavailable — dev will start, but graph writes need Docker. ' +
        'Run PREMORTEM_DOCKER_SUDO=1 pnpm run docker:up or fix docker group membership.'
    );
  }

  await runStep(['run', 'db:generate']);
  await runStep(['--filter', '@premortem/db', 'build']);
  await runStep(['run', 'db:migrate']);

  applyConfiguredDevDefaults(process.env);

  const requestedApiPort = process.env.PREMORTEM_API_PORT;
  const requestedWebPort = process.env.PREMORTEM_WEB_PORT;
  const apiPort = requestedApiPort ?? String(await findAvailablePort(18787));
  const webPort = requestedWebPort ?? String(await findAvailablePort(13000));
  const useFixtureDefaults =
    process.env.PREMORTEM_PRODUCTION_MODE !== '1' && !hasConfiguredRuntimeCredentials(process.env);

  const sharedEnv = {
    PREMORTEM_API_PORT: apiPort,
    PREMORTEM_WEB_PORT: webPort,
    PREMORTEM_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    ...(useFixtureDefaults
      ? {
          PREMORTEM_AUTH_DISABLED: process.env.PREMORTEM_AUTH_DISABLED ?? '1',
          PREMORTEM_INGEST_LOCAL: process.env.PREMORTEM_INGEST_LOCAL ?? '1',
          PREMORTEM_FORCE_LOCAL_INGEST: process.env.PREMORTEM_FORCE_LOCAL_INGEST ?? '1'
        }
      : {}),
    PREMORTEM_EXECUTOR:
      process.env.PREMORTEM_EXECUTOR ??
      (process.env.GEMINI_API_KEY || process.env.AZURE_OPENAI_API_KEY ? 'llm' : undefined),
    ...(useFixtureDefaults
      ? { PREMORTEM_PUBLISH_DRY_RUN: process.env.PREMORTEM_PUBLISH_DRY_RUN ?? '1' }
      : process.env.PREMORTEM_PUBLISH_DRY_RUN
        ? { PREMORTEM_PUBLISH_DRY_RUN: process.env.PREMORTEM_PUBLISH_DRY_RUN }
        : {}),
    HOSTNAME: '127.0.0.1',
    PORT: webPort
  };

  console.log(
    JSON.stringify({
      service: 'premortem-local-stack',
      mode: useFixtureDefaults ? 'fixture' : hasConfiguredRuntimeCredentials(process.env) ? 'configured' : 'production',
      apiUrl: sharedEnv.PREMORTEM_API_BASE_URL,
      webUrl: `http://127.0.0.1:${webPort}`
    })
  );

  const api = spawnProcess('api', ['--filter', '@premortem/api', 'run', 'dev'], sharedEnv);
  const web = spawnProcess('web', ['--filter', '@premortem/web', 'run', 'dev'], sharedEnv);

  const shutdown = () => {
    api.kill('SIGTERM');
    web.kill('SIGTERM');
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await Promise.race([once(api, 'exit'), once(web, 'exit')]);
}

void main().catch((error) => {
  console.error('local-stack.startup-error', error);
  process.exitCode = 1;
});
