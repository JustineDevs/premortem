import { buildWorkerRegisteredAgents, executeAuditJob, submitAudit } from '@premortem/orchestrator';
import { captureServerException, initServerObservability } from '@premortem/observability';
import type { RegisteredAgent } from '@premortem/agent-kit';
import type { AuditJob } from '@premortem/workflow';
import { validateProductionBootEnv } from '@premortem/domain';
import { prisma, recordActivityEvent } from '@premortem/db';
import { appRouter } from './lib/router';
import type {
  AppEnv,
  ExecutionContextLike,
  QueueBatchLike,
  ScheduledControllerLike
} from './lib/types';
export { RateLimiter } from './rate-limiter';

const MAX_AUDIT_QUEUE_ATTEMPTS = 3;

initServerObservability('premortem-api');

const productionBootEnvIssues = validateProductionBootEnv();
if (productionBootEnvIssues.length > 0) {
  throw new Error(
    `Invalid production boot environment: ${productionBootEnvIssues.join(', ')}`
  );
}

function isAuditJob(value: unknown): value is AuditJob {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<AuditJob>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.organizationId === 'string' &&
    typeof candidate.projectId === 'string' &&
    typeof candidate.branch === 'string' &&
    typeof candidate.idempotencyKey === 'string' &&
    typeof candidate.attempt === 'number'
  );
}

function isContinuousAuditEnabled(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const runtime = (metadata as Record<string, unknown>).runtime;
  if (!runtime || typeof runtime !== 'object') return false;
  return (runtime as Record<string, unknown>).continuousAuditEnabled === true;
}

async function runContinuousAuditSweep(env: AppEnv, controller?: ScheduledControllerLike) {
  if (!env.AUDIT_QUEUE) return;

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      metadata: true,
      projects: {
        where: { status: 'active' },
        select: {
          id: true,
          defaultBranch: true,
          updatedAt: true,
          settings: true
        },
        orderBy: { updatedAt: 'asc' }
      }
    }
  });

  for (const organization of organizations) {
    if (!isContinuousAuditEnabled(organization.metadata)) continue;

    const project = organization.projects.find((candidate) => {
      if (!candidate.settings || typeof candidate.settings !== 'object') return true;
      const settings = candidate.settings as Record<string, unknown>;
      return settings.autoRunOnPush !== false;
    });

    if (!project) continue;

    try {
      const submission = await submitAudit({
        organizationId: organization.id,
        projectId: project.id,
        branch: project.defaultBranch ?? 'main',
        triggeredById: undefined,
        triggerSource: 'scheduled'
      });

      if (!submission.reusedActiveRun) {
        await env.AUDIT_QUEUE.send(submission.job);
      }

      await recordActivityEvent({
        organizationId: organization.id,
        eventType: 'runtime.continuous_audit_scheduled',
        objectType: 'organization',
        objectId: organization.id,
        projectId: project.id,
        summary: `Continuous audit scheduled for ${project.id}${controller ? ` at ${new Date(controller.scheduledTime).toISOString()}` : ''}`
      });
    } catch (error) {
      captureServerException(error, {
        organizationId: organization.id,
        projectId: project.id,
        stage: 'continuous_audit_sweep'
      });
      console.error('continuous-audit.sweep-error', {
        organizationId: organization.id,
        projectId: project.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export async function handleAuditQueue(
  batch: QueueBatchLike<AuditJob>,
  _env: AppEnv = {},
  _ctx?: ExecutionContextLike,
  options?: { registryAgents?: RegisteredAgent[] }
) {
  const registryAgents = options?.registryAgents ?? buildWorkerRegisteredAgents();

  for (const message of batch.messages) {
    if (!isAuditJob(message.body)) {
      console.error('audit-queue.invalid-payload', { queue: batch.queue, messageId: message.id });
      message.ack();
      continue;
    }

    try {
      await executeAuditJob({
        job: message.body,
        registryAgents
      });
      message.ack();
    } catch (error) {
      const attempts = message.attempts ?? 0;
      console.error('audit-queue.execution-error', {
        queue: batch.queue,
        messageId: message.id,
        attempts,
        error: error instanceof Error ? error.message : String(error)
      });
      captureServerException(error, { queue: batch.queue, messageId: message.id, attempts });

      if (attempts >= MAX_AUDIT_QUEUE_ATTEMPTS) {
        message.ack();
        continue;
      }

      message.retry({ delaySeconds: Math.max(15, attempts * 30) });
    }
  }
}

export async function scheduled(
  controller: ScheduledControllerLike,
  env: AppEnv,
  _ctx?: ExecutionContextLike
) {
  await runContinuousAuditSweep(env, controller);
}

export default {
  fetch(request: Request, env: AppEnv, ctx: ExecutionContextLike) {
    return appRouter(request, env, ctx);
  },
  queue(batch: QueueBatchLike<AuditJob>, env: AppEnv, ctx: ExecutionContextLike) {
    return handleAuditQueue(batch, env, ctx);
  },
  scheduled(controller: ScheduledControllerLike, env: AppEnv, ctx: ExecutionContextLike) {
    return scheduled(controller, env, ctx);
  }
};
