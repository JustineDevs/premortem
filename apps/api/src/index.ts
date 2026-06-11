import { buildWorkerRegisteredAgents, executeAuditJob } from '@premortem/orchestrator';
import { captureServerException, initServerObservability } from '@premortem/observability';
import type { RegisteredAgent } from '@premortem/agent-kit';
import type { AuditJob } from '@premortem/workflow';
import { appRouter } from './lib/router';
import type { AppEnv, ExecutionContextLike, QueueBatchLike } from './lib/types';

const MAX_AUDIT_QUEUE_ATTEMPTS = 3;

initServerObservability('premortem-api');

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

export default {
  fetch(request: Request, env: AppEnv, ctx: ExecutionContextLike) {
    return appRouter(request, env, ctx);
  },
  queue(batch: QueueBatchLike<AuditJob>, env: AppEnv, ctx: ExecutionContextLike) {
    return handleAuditQueue(batch, env, ctx);
  }
};
