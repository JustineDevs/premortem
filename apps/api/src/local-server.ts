import './bootstrap-env.js';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureLocalDevelopmentFixture,
  getWorkspaceBundle,
  listOrganizationProjects,
  listRecentAuditRunsForOrganization,
  listReconciliationEvents
} from '@premortem/db';
import { isLocalAuthBypassEnabled, LOCAL_DEV_FIXTURE } from '@premortem/domain';
import { initServerObservability } from '@premortem/observability/server';
import type { AuditJob } from '@premortem/workflow';
import { appRouter } from './lib/router';
import type { AppEnv } from './lib/types';

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

let startupPromise: Promise<void> | null = null;

async function main() {
  if (startupPromise) return startupPromise;

  startupPromise = (async () => {
    const repoRoot = resolveRepoRoot();
    initServerObservability('premortem-api-local');

    await ensureLocalDevelopmentFixture();

    if (isLocalAuthBypassEnabled()) {
      await Promise.all([
        getWorkspaceBundle({
          organizationId: LOCAL_DEV_FIXTURE.organizationId,
          profileId: LOCAL_DEV_FIXTURE.profileId
        }),
        listOrganizationProjects(LOCAL_DEV_FIXTURE.organizationId),
        listRecentAuditRunsForOrganization(LOCAL_DEV_FIXTURE.organizationId, 12),
        listReconciliationEvents(LOCAL_DEV_FIXTURE.organizationId, 25)
      ]).catch((error) => {
        console.error('local-api.warmup-error', error);
      });
    }

    const host = process.env.PREMORTEM_API_HOST ?? '127.0.0.1';
    const port = Number.parseInt(process.env.PREMORTEM_API_PORT ?? process.env.PORT ?? '18787', 10);

    const env: AppEnv = {
      AUDIT_QUEUE: {
        async send(job: AuditJob) {
          const { executeAuditJob } = await import('@premortem/orchestrator');
          void executeAuditJob({
            job,
            rootDir: repoRoot
          }).catch((error) => {
            console.error('local-audit-queue.execution-error', {
              auditRunId: job.id,
              error: 'audit_job_failed'
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
              mode: isLocalAuthBypassEnabled() ? 'auth-bypass' : 'supabase',
              ...(isLocalAuthBypassEnabled() ? { fixture: LOCAL_DEV_FIXTURE } : {})
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
        const message = error instanceof Error ? error.message : String(error);
        console.error('local-api.request-error', { message, error });
        response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        response.end(
          JSON.stringify({
            error: message || 'Unknown local API error'
          })
        );
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(port, host, () => {
        console.log(
          JSON.stringify({
            service: 'premortem-local-api',
            url: `http://${host}:${port}`,
            auth: isLocalAuthBypassEnabled() ? 'bypass' : 'supabase'
          })
        );
        resolve();
      });
    });
  })();

  return startupPromise;
}

void main().catch((error) => {
  console.error('local-api.startup-error', error);
  process.exitCode = 1;
});
