import type { AuditJob } from '@premortem/workflow';

export interface QueueRetryOptions {
  delaySeconds?: number;
}

export interface AuditQueueBinding {
  send(message: AuditJob): Promise<void>;
}

export interface RateLimiterBindingLike {
  limit(input: { key: string; limit?: number; windowMs?: number }): Promise<{ allowed?: boolean; success?: boolean }>;
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
  RATE_LIMITER?: RateLimiterBindingLike;
}
