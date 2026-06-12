import type { AuditJob } from '@premortem/workflow';

export interface QueueRetryOptions {
  delaySeconds?: number;
}

export interface AuditQueueBinding {
  send(message: AuditJob): Promise<void>;
}

export interface RateLimiterStubLike {
  fetch(request: Request): Promise<Response>;
}

export interface RateLimiterNamespaceBinding {
  idFromName(name: string): unknown;
  get(id: unknown): RateLimiterStubLike;
}

export interface QueueMessageLike<T> {
  id?: string;
  body: T;
  attempts?: number;
  ack(): void;
  retry(options?: QueueRetryOptions): void;
}

export interface QueueBatchLike<T> {
  queue: string;
  messages: Array<QueueMessageLike<T>>;
}

export interface ExecutionContextLike {
  waitUntil?(promise: Promise<unknown>): void;
}

export interface ScheduledControllerLike {
  scheduledTime: number;
}

export interface AppEnv {
  APP_ENV?: string;
  AUDIT_QUEUE?: AuditQueueBinding;
  RATE_LIMITER?: RateLimiterNamespaceBinding;
}
