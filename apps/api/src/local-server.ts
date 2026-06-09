import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLocalDevelopmentFixture, LOCAL_DEV_FIXTURE } from '@premortem/db';
import { executeAuditJob } from '@premortem/orchestrator';
import type { AuditJob } from '@premortem/workflow';
import { appRouter } from './lib/router';
import type { AppEnv } from './lib/types';

function loadLocalEnv(repoRoot: string) {
  for (const fileName of ['.env.local', '.env']) {
    const absolutePath = path.join(repoRoot, fileName);
    if (!fs.existsSync(absolutePath)) continue;

    const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^"/, '').replace(/"$/, '');
    }
  }
}

function resolveRepoRoot() {
  let current = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string };
      if (packageJson.name === 'premortem') return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Unable to locate Premortem repository root.');
    }

    current = parent;
  }
}

async function readBody(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

async function main() {
  const repoRoot = resolveRepoRoot();
  loadLocalEnv(repoRoot);

  await ensureLocalDevelopmentFixture();

  const host = process.env.PREMORTEM_API_HOST ?? '127.0.0.1';
  const port = Number.parseInt(process.env.PREMORTEM_API_PORT ?? process.env.PORT ?? '18787', 10);

  const env: AppEnv = {
    AUDIT_QUEUE: {
      async send(job: AuditJob) {
        void executeAuditJob({
          job,
          rootDir: repoRoot
        }).catch((error) => {
          console.error('local-audit-queue.execution-error', {
            auditRunId: job.id,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
    }
  };

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url ?? '/',
        `http://${request.headers.host ?? `${host}:${port}`}`
      );

      if (request.method === 'GET' && requestUrl.pathname === '/health') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        response.end(
          JSON.stringify({
            ok: true,
            service: 'premortem-local-api',
            mode: 'node-local',
            fixture: LOCAL_DEV_FIXTURE
          })
        );
        return;
      }

      const body = await readBody(request);
      const upstreamResponse = await appRouter(
        new Request(requestUrl, {
          method: request.method,
          headers: request.headers as Record<string, string>,
          body
        }),
        env,
        {
          waitUntil(promise) {
            void promise.catch((error) => {
              console.error('local-api.waitUntil-error', error);
            });
          }
        }
      );

      response.statusCode = upstreamResponse.status;
      upstreamResponse.headers.forEach((value, key) => response.setHeader(key, value));
      const payload = Buffer.from(await upstreamResponse.arrayBuffer());
      response.end(payload);
    } catch (error) {
      console.error('local-api.request-error', error);
      response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown local API error'
        })
      );
    }
  });

  server.listen(port, host, () => {
    console.log(
      JSON.stringify({
        service: 'premortem-local-api',
        url: `http://${host}:${port}`,
        fixture: LOCAL_DEV_FIXTURE
      })
    );
  });
}

void main().catch((error) => {
  console.error('local-api.startup-error', error);
  process.exitCode = 1;
});
