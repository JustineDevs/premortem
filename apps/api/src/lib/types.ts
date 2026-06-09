import type { AuditJob } from '@premortem/workflow';

export interface QueueRetryOptions {
  delaySeconds?: number;
}

export interface AuditQueueBinding {
  send(message: AuditJob): Promise<void>;
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

export interface AppEnv {
  APP_ENV?: string;
  AUDIT_QUEUE?: AuditQueueBinding;
}
